namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Payments;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsMediumControlsEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsMediumControlsEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/portfolio-risk", GetPortfolioRiskAsync)
        .RequireTenantMlsPermission("mls.portfolio-risk.view", MlsModuleCodePortfolioRiskDashboard);

    tenantApi.MapGet("/mls/loan-approvals", GetLoanApprovalsAsync)
        .RequireTenantMlsPermission("mls.loan-approvals.view", MlsModuleCodeLoanApprovalWorkflow);

    tenantApi.MapPost("/mls/loan-approvals/service-invoices/{invoiceId:guid}/approve", ApproveServiceInvoiceLoanApprovalAsync)
        .RequireTenantMlsPermission("mls.loan-approvals.manage", MlsModuleCodeLoanApprovalWorkflow);

    tenantApi.MapPost("/mls/loan-approvals/service-invoices/{invoiceId:guid}/reject", RejectServiceInvoiceLoanApprovalAsync)
        .RequireTenantMlsPermission("mls.loan-approvals.manage", MlsModuleCodeLoanApprovalWorkflow);

    tenantApi.MapPost("/mls/loan-approvals/standalone-loans/{microLoanId:guid}/approve", ApproveStandaloneLoanApprovalAsync)
        .RequireTenantMlsPermission("mls.loan-approvals.manage", MlsModuleCodeLoanApprovalWorkflow);

    tenantApi.MapPost("/mls/loan-approvals/standalone-loans/{microLoanId:guid}/reject", RejectStandaloneLoanApprovalAsync)
        .RequireTenantMlsPermission("mls.loan-approvals.manage", MlsModuleCodeLoanApprovalWorkflow);

    tenantApi.MapGet("/mls/finance-policy", GetFinancePolicyAsync)
        .RequireTenantMlsPermission("mls.finance-policy.view", MlsModuleCodeFinancePolicyControl);

    return tenantApi;
  }

  private static async Task<IResult> GetPortfolioRiskAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var todayUtc = DateTime.UtcNow.Date;
    var weekEndUtc = todayUtc.AddDays(7);
    var lateFeePolicy = await TenantMlsLoanMath.LoadLateFeePolicyAsync(dbContext, cancellationToken);
    var activeLoans = await dbContext.MicroLoans
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.Invoice)
        .Include(entity => entity.AmortizationSchedules)
        .Where(entity => entity.LoanStatus != "Paid" && entity.LoanStatus != "Pending Approval" && entity.LoanStatus != "Rejected")
        .ToListAsync(cancellationToken);

    var rows = activeLoans
        .Select(loan => BuildPortfolioRiskRow(loan, todayUtc, lateFeePolicy))
        .OrderByDescending(row => row.DaysPastDue)
        .ThenByDescending(row => row.OverdueAmount)
        .ThenBy(row => row.CustomerName)
        .ToArray();

    var outstandingBalance = RoundCurrency(rows.Sum(row => row.OutstandingBalance));
    var overdueBalance = RoundCurrency(rows.Sum(row => row.OverdueAmount));
    var dueThisWeekBalance = RoundCurrency(activeLoans.Sum(loan => loan.AmortizationSchedules
        .Where(schedule => TenantMlsLoanMath.GetInstallmentOutstandingBalance(schedule, lateFeePolicy, todayUtc) > 0m &&
            schedule.DueDate.Date >= todayUtc &&
            schedule.DueDate.Date <= weekEndUtc)
        .Sum(schedule => TenantMlsLoanMath.GetInstallmentOutstandingBalance(schedule, lateFeePolicy, todayUtc))));

    return Results.Ok(new {
      Summary = new {
        ActiveLoans = rows.Length,
        PortfolioBalance = outstandingBalance,
        OverdueLoans = rows.Count(row => row.OverdueAmount > 0m),
        OverdueBalance = overdueBalance,
        DueThisWeekBalance = dueThisWeekBalance,
        PortfolioAtRiskRate = outstandingBalance <= 0m
            ? 0m
            : RoundCurrency(overdueBalance / outstandingBalance * 100m)
      },
      AgingBuckets = BuildPortfolioAgingBuckets(rows),
      Rows = rows
    });
  }

  private static async Task<IResult> GetLoanApprovalsAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var invoices = await dbContext.Invoices
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.ServiceRequest)
        .Include(entity => entity.MicroLoan)
        .Include(entity => entity.PaymentSubmissions)
        .Include(entity => entity.LoanApprovalRequestedByUser)
        .Include(entity => entity.LoanApprovalReviewedByUser)
        .Where(entity => entity.InvoiceStatus == ServiceInvoiceFinancePolicy.FinalizedStatus ||
            entity.InvoiceStatus == ServiceInvoiceFinancePolicy.CheckoutPendingStatus ||
            entity.InvoiceStatus == ServiceInvoiceFinancePolicy.PaymentSubmittedStatus ||
            entity.InvoiceStatus == ServiceInvoiceFinancePolicy.LegacyPendingReviewStatus ||
            entity.InvoiceStatus == ServiceInvoiceFinancePolicy.PartiallyPaidStatus ||
            entity.MicroLoan != null)
        .OrderByDescending(entity => entity.InvoiceDateUtc)
        .Take(80)
        .ToListAsync(cancellationToken);

    var standaloneLoans = await dbContext.MicroLoans
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.ApprovalRequestedByUser)
        .Include(entity => entity.ApprovalReviewedByUser)
        .Where(entity => entity.InvoiceId == null)
        .OrderByDescending(entity => entity.CreatedAtUtc)
        .Take(20)
        .ToListAsync(cancellationToken);

    var invoiceRows = invoices.Select(BuildApprovalInvoiceRow);
    var standaloneRows = standaloneLoans.Select(BuildApprovalStandaloneLoanRow);
    var rows = invoiceRows
        .Concat(standaloneRows)
        .OrderBy(row => GetApprovalStatePriority(row.ReadinessState))
        .ThenByDescending(row => row.Amount)
        .ThenByDescending(row => row.CreatedAtUtc)
        .ToArray();
    var readyRows = rows.Where(row => row.ReadinessState == "Ready for approval").ToArray();

    return Results.Ok(new {
      Summary = new {
        ServiceLinkedCandidates = readyRows.Count(row => row.SourceType == "Service invoice"),
        StandaloneLoansCreated = standaloneLoans.Count,
        NeedsReview = rows.Count(row => row.CanApprove || row.ReadinessState == "Payment review required"),
        BlockedCandidates = rows.Count(row => row.ReadinessState == "Blocked"),
        AverageCandidateAmount = readyRows.Length == 0
            ? 0m
            : RoundCurrency(readyRows.Average(row => row.Amount))
      },
      Rows = rows
    });
  }

  private static Task<IResult> ApproveServiceInvoiceLoanApprovalAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      Guid invoiceId,
      [FromBody] ReviewTenantMlsLoanApprovalRequest request,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) =>
    ReviewServiceInvoiceLoanApprovalAsync(
        httpContext,
        tenantDomainSlug,
        invoiceId,
        request,
        approved: true,
        dbContext,
        auditLogService,
        cancellationToken);

  private static Task<IResult> RejectServiceInvoiceLoanApprovalAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      Guid invoiceId,
      [FromBody] ReviewTenantMlsLoanApprovalRequest request,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) =>
    ReviewServiceInvoiceLoanApprovalAsync(
        httpContext,
        tenantDomainSlug,
        invoiceId,
        request,
        approved: false,
        dbContext,
        auditLogService,
        cancellationToken);

  private static Task<IResult> ApproveStandaloneLoanApprovalAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      Guid microLoanId,
      [FromBody] ReviewTenantMlsLoanApprovalRequest request,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) =>
    ReviewStandaloneLoanApprovalAsync(
        httpContext,
        tenantDomainSlug,
        microLoanId,
        request,
        approved: true,
        dbContext,
        auditLogService,
        cancellationToken);

  private static Task<IResult> RejectStandaloneLoanApprovalAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      Guid microLoanId,
      [FromBody] ReviewTenantMlsLoanApprovalRequest request,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) =>
    ReviewStandaloneLoanApprovalAsync(
        httpContext,
        tenantDomainSlug,
        microLoanId,
        request,
        approved: false,
        dbContext,
        auditLogService,
        cancellationToken);

  private static async Task<IResult> ReviewServiceInvoiceLoanApprovalAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      Guid invoiceId,
      ReviewTenantMlsLoanApprovalRequest request,
      bool approved,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var accessResult = await RequireTenantMlsAccessAsync(
        httpContext,
        tenantDomainSlug,
        dbContext,
        cancellationToken,
        MlsModuleCodeLoanApprovalWorkflow);
    if (accessResult is not null) {
      return accessResult;
    }

    if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
      return Results.Unauthorized();
    }

    var remarks = TenantMlsLoanApprovalPolicy.NormalizeRemarks(request.Remarks);
    if (!approved && remarks is null) {
      return Results.BadRequest(new { error = "Review remarks are required when rejecting a loan approval request." });
    }

    if ((remarks?.Length ?? 0) > TenantMlsLoanApprovalPolicy.RemarksMaxLength) {
      return Results.BadRequest(new { error = $"Review remarks must be {TenantMlsLoanApprovalPolicy.RemarksMaxLength} characters or fewer." });
    }

    var invoice = await dbContext.Invoices
        .Include(entity => entity.Customer)
        .Include(entity => entity.ServiceRequest)
        .Include(entity => entity.MicroLoan)
        .Include(entity => entity.PaymentSubmissions)
        .FirstOrDefaultAsync(entity => entity.Id == invoiceId, cancellationToken);
    var blockReason = TenantMlsLoanApprovalPolicy.GetServiceLinkedApprovalBlockReason(invoice);
    if (blockReason is not null) {
      return Results.BadRequest(new { error = blockReason });
    }

    if (!TenantMlsLoanApprovalPolicy.IsPending(invoice!)) {
      return Results.BadRequest(new { error = "Only pending loan approval requests can be reviewed." });
    }

    if (invoice!.LoanApprovalRequestedByUserId == currentUserId) {
      return Results.BadRequest(new { error = "Maker-checker review requires another MLS operator to approve or reject this request." });
    }

    var now = DateTime.UtcNow;
    invoice.LoanApprovalStatus = approved
      ? TenantMlsLoanApprovalPolicy.ApprovedStatus
      : TenantMlsLoanApprovalPolicy.RejectedStatus;
    invoice.LoanApprovalReviewedByUserId = currentUserId;
    invoice.LoanApprovalReviewedAtUtc = now;
    invoice.LoanApprovalRemarks = remarks ?? invoice.LoanApprovalRemarks;

    await dbContext.SaveChangesAsync(cancellationToken);

    var outcome = approved ? "Approved" : "Rejected";
    await TenantMlsAuditLogging.WriteSystemAuditAsync(
        auditLogService,
        httpContext,
        invoice.TenantId,
        "LoanApprovalReview",
        outcome,
        "Invoice",
        invoice.Id,
        invoice.InvoiceNumber,
        $"{outcome} loan approval request for service invoice {invoice.InvoiceNumber}.");

    return Results.Ok(new { message = $"Loan approval request {outcome.ToLowerInvariant()}." });
  }

  private static async Task<IResult> ReviewStandaloneLoanApprovalAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      Guid microLoanId,
      ReviewTenantMlsLoanApprovalRequest request,
      bool approved,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var accessResult = await RequireTenantMlsAccessAsync(
        httpContext,
        tenantDomainSlug,
        dbContext,
        cancellationToken,
        MlsModuleCodeLoanApprovalWorkflow);
    if (accessResult is not null) {
      return accessResult;
    }

    if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
      return Results.Unauthorized();
    }

    var remarks = TenantMlsLoanApprovalPolicy.NormalizeRemarks(request.Remarks);
    if (!approved && remarks is null) {
      return Results.BadRequest(new { error = "Review remarks are required when rejecting a standalone loan request." });
    }

    if ((remarks?.Length ?? 0) > TenantMlsLoanApprovalPolicy.RemarksMaxLength) {
      return Results.BadRequest(new { error = $"Review remarks must be {TenantMlsLoanApprovalPolicy.RemarksMaxLength} characters or fewer." });
    }

    var loan = await dbContext.MicroLoans
        .Include(entity => entity.Customer)
        .Include(entity => entity.AmortizationSchedules)
        .Include(entity => entity.Transactions)
        .FirstOrDefaultAsync(entity => entity.Id == microLoanId && entity.InvoiceId == null, cancellationToken);
    if (loan is null) {
      return Results.NotFound(new { error = "The selected standalone loan request was not found." });
    }

    if (!TenantMlsLoanApprovalPolicy.IsPending(loan) || loan.LoanStatus != "Pending Approval") {
      return Results.BadRequest(new { error = "Only pending standalone loan requests can be reviewed." });
    }

    if (loan.ApprovalRequestedByUserId == currentUserId || loan.CreatedByUserId == currentUserId) {
      return Results.BadRequest(new { error = "Maker-checker review requires another MLS operator to approve or reject this request." });
    }

    if (!approved) {
      loan.ApprovalStatus = TenantMlsLoanApprovalPolicy.RejectedStatus;
      loan.ApprovalReviewedByUserId = currentUserId;
      loan.ApprovalReviewedAtUtc = DateTime.UtcNow;
      loan.ApprovalRemarks = remarks;
      loan.LoanStatus = "Rejected";

      await dbContext.SaveChangesAsync(cancellationToken);
      await TenantMlsAuditLogging.WriteSystemAuditAsync(
          auditLogService,
          httpContext,
          loan.TenantId,
          "StandaloneLoanApproval",
          "Rejected",
          "MicroLoan",
          loan.Id,
          loan.Customer?.FullName ?? "Standalone loan",
          $"Rejected standalone loan request for {loan.Customer?.FullName ?? "borrower"}.");

      return Results.Ok(new { message = "Standalone loan request rejected." });
    }

    if (loan.AmortizationSchedules.Count > 0 || loan.Transactions.Count > 0) {
      return Results.Conflict(new { error = "This standalone loan request already has release records. Refresh the approvals workspace." });
    }

    var loanStartDate = DateOnly.FromDateTime(loan.LoanStartDate);
    var computation = TenantMlsLoanMath.Build(loan.PrincipalAmount, loan.AnnualInterestRate, loan.TermMonths, loanStartDate);
    foreach (var row in computation.Schedule) {
      dbContext.AmortizationSchedules.Add(new AmortizationSchedule {
        Id = Guid.NewGuid(),
        MicroLoanId = loan.Id,
        InstallmentNumber = row.InstallmentNumber,
        DueDate = row.DueDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
        BeginningBalance = row.BeginningBalance,
        PrincipalPortion = row.PrincipalPortion,
        InterestPortion = row.InterestPortion,
        InstallmentAmount = row.InstallmentAmount,
        EndingBalance = row.EndingBalance,
        PaidAmount = 0m,
        InstallmentStatus = "Pending"
      });
    }

    var runningBalance = await dbContext.Transactions
        .Where(entity => entity.CustomerId == loan.CustomerId)
        .OrderByDescending(entity => entity.TransactionDateUtc)
        .ThenByDescending(entity => entity.Id)
        .Select(entity => entity.RunningBalance)
        .FirstOrDefaultAsync(cancellationToken);
    var referenceNumber = string.IsNullOrWhiteSpace(loan.ReferenceNumber)
      ? GenerateReferenceCode("MLS-STDLN")
      : loan.ReferenceNumber;

    loan.ReferenceNumber = referenceNumber;
    loan.ApprovalStatus = TenantMlsLoanApprovalPolicy.ApprovedStatus;
    loan.ApprovalReviewedByUserId = currentUserId;
    loan.ApprovalReviewedAtUtc = DateTime.UtcNow;
    loan.ApprovalRemarks = remarks ?? loan.ApprovalRemarks;
    loan.LoanStatus = "Active";

    dbContext.Transactions.Add(new LedgerTransaction {
      Id = Guid.NewGuid(),
      CustomerId = loan.CustomerId,
      InvoiceId = null,
      MicroLoanId = loan.Id,
      TransactionDateUtc = DateTime.UtcNow,
      TransactionType = "StandaloneLoanCreation",
      ReferenceNumber = referenceNumber,
      DebitAmount = computation.Summary.PrincipalAmount,
      CreditAmount = 0m,
      RunningBalance = TenantMlsLoanMath.RoundCurrency(runningBalance + computation.Summary.PrincipalAmount),
      Remarks = string.IsNullOrWhiteSpace(loan.Remarks)
        ? $"Standalone loan approved and released for {loan.Customer?.FullName ?? "borrower"}"
        : loan.Remarks,
      CreatedByUserId = currentUserId
    });

    await dbContext.SaveChangesAsync(cancellationToken);
    await TenantMlsAuditLogging.WriteSystemAuditAsync(
        auditLogService,
        httpContext,
        loan.TenantId,
        "StandaloneLoanApproval",
        "Approved",
        "MicroLoan",
        loan.Id,
        loan.Customer?.FullName ?? "Standalone loan",
        $"Approved and released standalone loan for {loan.Customer?.FullName ?? "borrower"}.");

    return Results.Ok(new { message = "Standalone loan request approved and released." });
  }

  private static async Task<IResult> GetFinancePolicyAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var lateFeePolicy = await TenantMlsLoanMath.LoadLateFeePolicyAsync(dbContext, cancellationToken);
    var todayUtc = DateTime.UtcNow.Date;
    var loans = await dbContext.MicroLoans
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.Invoice)
        .Include(entity => entity.AmortizationSchedules)
        .OrderByDescending(entity => entity.CreatedAtUtc)
        .ToListAsync(cancellationToken);

    var rows = loans
        .Select(BuildFinancePolicyRow)
        .OrderByDescending(row => row.PolicyState == "Policy exception")
        .ThenByDescending(row => row.PrincipalAmount)
        .ThenBy(row => row.CustomerName)
        .ToArray();
    var rates = rows.Select(row => row.AnnualInterestRate).ToArray();

    return Results.Ok(new {
      Summary = new {
        LoanCount = rows.Length,
        AverageInterestRate = rates.Length == 0 ? (decimal?)null : RoundCurrency(rates.Average()),
        MinimumInterestRate = rates.Length == 0 ? (decimal?)null : RoundCurrency(rates.Min()),
        MaximumInterestRate = rates.Length == 0 ? (decimal?)null : RoundCurrency(rates.Max()),
        AverageTermMonths = rows.Length == 0 ? 0 : (int)Math.Round(rows.Average(row => row.TermMonths), MidpointRounding.AwayFromZero),
        PolicyExceptionCount = rows.Count(row => row.PolicyState == "Policy exception")
      },
      LateFeePolicy = new {
        IsEnabled = lateFeePolicy.IsEnabled,
        GracePeriodDays = lateFeePolicy.GracePeriodDays,
        FlatAmount = lateFeePolicy.FlatAmount,
        RatePercent = lateFeePolicy.RatePercent,
        AssessedInstallments = loans.Sum(loan => loan.AmortizationSchedules.Count(schedule =>
            TenantMlsLoanMath.GetEffectiveLateFeeAmount(schedule, lateFeePolicy, todayUtc) > 0m)),
        AssessedAmount = RoundCurrency(loans.Sum(loan => loan.AmortizationSchedules.Sum(schedule =>
            TenantMlsLoanMath.GetEffectiveLateFeeAmount(schedule, lateFeePolicy, todayUtc))))
      },
      PolicyBands = BuildPolicyBands(rows),
      Rows = rows
    });
  }

  private static PortfolioRiskRow BuildPortfolioRiskRow(
      MicroLoan loan,
      DateTime todayUtc,
      TenantMlsLateFeePolicySnapshot lateFeePolicy) {
    var unpaidSchedules = loan.AmortizationSchedules
        .Where(schedule => TenantMlsLoanMath.GetInstallmentOutstandingBalance(schedule, lateFeePolicy, todayUtc) > 0m)
        .ToArray();
    var overdueSchedules = unpaidSchedules
        .Where(schedule => schedule.DueDate.Date < todayUtc)
        .ToArray();
    var outstandingBalance = TenantMlsLoanMath.GetOutstandingBalance(loan, lateFeePolicy, todayUtc);
    var overdueAmount = RoundCurrency(overdueSchedules.Sum(schedule =>
        TenantMlsLoanMath.GetInstallmentOutstandingBalance(schedule, lateFeePolicy, todayUtc)));
    var daysPastDue = overdueSchedules.Length == 0
        ? 0
        : overdueSchedules.Max(schedule => (todayUtc - schedule.DueDate.Date).Days);

    return new PortfolioRiskRow(
        loan.Id,
        loan.Customer?.FullName ?? "Unknown borrower",
        GetLoanLabel(loan),
        loan.LoanStatus,
        outstandingBalance,
        overdueAmount,
        daysPastDue,
        unpaidSchedules
            .OrderBy(schedule => schedule.DueDate)
            .Select(schedule => (DateTime?)schedule.DueDate)
            .FirstOrDefault(),
        ResolveRiskState(daysPastDue, overdueAmount));
  }

  private static ApprovalWorkspaceRow BuildApprovalInvoiceRow(Invoice invoice) {
    var hasMicroLoan = invoice.MicroLoan is not null;
    var derivedStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);
    var readinessState = ResolveApprovalReadiness(invoice, hasMicroLoan, derivedStatus);

    return new ApprovalWorkspaceRow(
        invoice.Id.ToString(),
        "service-invoice",
        invoice.ServiceRequest?.RequestNumber ?? "Service invoice",
        invoice.Customer?.FullName ?? "Unknown customer",
        invoice.InvoiceNumber,
        RoundCurrency(invoice.OutstandingAmount),
        "Service invoice",
        readinessState,
        ResolveApprovalRiskFlag(invoice, readinessState, derivedStatus),
        invoice.InvoiceDateUtc,
        ResolveApprovalReason(invoice, readinessState, derivedStatus),
        TenantMlsLoanApprovalPolicy.IsPending(invoice),
        TenantMlsLoanApprovalPolicy.IsPending(invoice),
        invoice.LoanApprovalRequestedByUser?.FullName,
        invoice.LoanApprovalRequestedAtUtc,
        invoice.LoanApprovalReviewedByUser?.FullName,
        invoice.LoanApprovalReviewedAtUtc,
        invoice.LoanApprovalRemarks);
  }

  private static ApprovalWorkspaceRow BuildApprovalStandaloneLoanRow(MicroLoan loan) {
    var approvalStatus = TenantMlsLoanApprovalPolicy.NormalizeMicroLoanApprovalStatus(loan);
    var readinessState = approvalStatus switch {
      TenantMlsLoanApprovalPolicy.PendingReviewStatus => "Ready for approval",
      TenantMlsLoanApprovalPolicy.RejectedStatus => "Rejected",
      _ => loan.LoanStatus == "Pending Approval" ? "Ready for approval" : "Released"
    };

    return new ApprovalWorkspaceRow(
        loan.Id.ToString(),
        "standalone-loan",
        "Standalone loan",
        loan.Customer?.FullName ?? "Unknown borrower",
        GetLoanLabel(loan),
        RoundCurrency(loan.PrincipalAmount),
        "Standalone loan",
        readinessState,
        ResolvePolicyState(loan) == "Policy exception" ? "Policy exception" : "Normal",
        loan.CreatedAtUtc,
        ResolveStandaloneApprovalReason(loan, readinessState),
        TenantMlsLoanApprovalPolicy.IsPending(loan),
        TenantMlsLoanApprovalPolicy.IsPending(loan),
        loan.ApprovalRequestedByUser?.FullName,
        loan.ApprovalRequestedAtUtc,
        loan.ApprovalReviewedByUser?.FullName,
        loan.ApprovalReviewedAtUtc,
        loan.ApprovalRemarks);
  }

  private static FinancePolicyRow BuildFinancePolicyRow(MicroLoan loan) =>
    new(
        loan.Id,
        loan.Customer?.FullName ?? "Unknown borrower",
        GetLoanLabel(loan),
        RoundCurrency(loan.AnnualInterestRate),
        loan.TermMonths,
        RoundCurrency(loan.PrincipalAmount),
        loan.LoanStatus,
        ResolvePolicyState(loan),
        loan.CreatedAtUtc);

  private static object[] BuildPortfolioAgingBuckets(IReadOnlyList<PortfolioRiskRow> rows) {
    var current = rows.Where(row => row.DaysPastDue <= 0).ToArray();
    var oneToThirty = rows.Where(row => row.DaysPastDue is > 0 and <= 30).ToArray();
    var thirtyOneToSixty = rows.Where(row => row.DaysPastDue is > 30 and <= 60).ToArray();
    var sixtyOneToNinety = rows.Where(row => row.DaysPastDue is > 60 and <= 90).ToArray();
    var ninetyPlus = rows.Where(row => row.DaysPastDue > 90).ToArray();

    return [
      CreatePortfolioBucket("Current", current),
      CreatePortfolioBucket("1-30 days", oneToThirty),
      CreatePortfolioBucket("31-60 days", thirtyOneToSixty),
      CreatePortfolioBucket("61-90 days", sixtyOneToNinety),
      CreatePortfolioBucket("90+ days", ninetyPlus)
    ];
  }

  private static object CreatePortfolioBucket(string label, IReadOnlyList<PortfolioRiskRow> rows) =>
    new {
      Label = label,
      LoanCount = rows.Count,
      OutstandingBalance = RoundCurrency(rows.Sum(row => row.OutstandingBalance)),
      OverdueAmount = RoundCurrency(rows.Sum(row => row.OverdueAmount))
    };

  private static object[] BuildPolicyBands(IReadOnlyList<FinancePolicyRow> rows) {
    var shortTerm = rows.Where(row => row.TermMonths <= 3).ToArray();
    var standardTerm = rows.Where(row => row.TermMonths is > 3 and <= 12).ToArray();
    var longTerm = rows.Where(row => row.TermMonths > 12).ToArray();
    var highRate = rows.Where(row => row.AnnualInterestRate > 36m).ToArray();

    return [
      CreatePolicyBand("Short term", shortTerm),
      CreatePolicyBand("Standard term", standardTerm),
      CreatePolicyBand("Long term", longTerm),
      CreatePolicyBand("High-rate review", highRate)
    ];
  }

  private static object CreatePolicyBand(string label, IReadOnlyList<FinancePolicyRow> rows) =>
    new {
      Label = label,
      LoanCount = rows.Count,
      PrincipalAmount = RoundCurrency(rows.Sum(row => row.PrincipalAmount))
    };

  private static string ResolveRiskState(int daysPastDue, decimal overdueAmount) {
    if (daysPastDue > 90) {
      return "Severe";
    }

    if (daysPastDue > 60) {
      return "High";
    }

    if (daysPastDue > 0 || overdueAmount > 0m) {
      return "Watch";
    }

    return "Current";
  }

  private static string ResolveApprovalReadiness(Invoice invoice, bool hasMicroLoan, string derivedStatus) {
    if (hasMicroLoan) {
      return "Released";
    }

    if (invoice.PaymentSubmissions.Any(submission => ServiceInvoiceFinancePolicy.IsManualReviewPendingStatus(submission.Status))) {
      return "Payment review required";
    }

    if (invoice.PaymentSubmissions.Any(submission =>
        string.Equals(submission.Status, ServiceInvoiceFinancePolicy.CheckoutPendingStatus, StringComparison.OrdinalIgnoreCase))) {
      return "Blocked";
    }

    if (!ServiceInvoiceFinancePolicy.CanConvertToLoan(
        hasInvoice: true,
        hasMicroLoan: false,
        outstandingAmount: invoice.OutstandingAmount,
        interestableAmount: invoice.InterestableAmount,
        invoiceStatus: derivedStatus)) {
      return "Blocked";
    }

    return TenantMlsLoanApprovalPolicy.NormalizeInvoiceApprovalStatus(invoice) switch {
      TenantMlsLoanApprovalPolicy.PendingReviewStatus => "Ready for approval",
      TenantMlsLoanApprovalPolicy.ApprovedStatus => "Approved for release",
      TenantMlsLoanApprovalPolicy.RejectedStatus => "Rejected",
      _ => "Approval request needed"
    };
  }

  private static string ResolveApprovalRiskFlag(Invoice invoice, string readinessState, string derivedStatus) {
    if (readinessState == "Released") {
      return "Released";
    }

    if (readinessState == "Payment review required") {
      return "Settlement pending";
    }

    if (readinessState is "Approved for release" or "Ready for approval") {
      return "Maker-checker";
    }

    if (readinessState == "Rejected") {
      return "Rejected";
    }

    if (invoice.OutstandingAmount <= 0m) {
      return "Paid";
    }

    if (invoice.InterestableAmount <= 0m) {
      return "Non-interestable";
    }

    if (derivedStatus != ServiceInvoiceFinancePolicy.FinalizedStatus) {
      return derivedStatus;
    }

    return "Normal";
  }

  private static string ResolveApprovalReason(Invoice invoice, string readinessState, string derivedStatus) {
    if (readinessState == "Ready for approval") {
      return "Maker submitted this finance-ready invoice for checker approval.";
    }

    if (readinessState == "Approved for release") {
      return "Checker approved this invoice. A different operator can now release it as a loan.";
    }

    if (readinessState == "Approval request needed") {
      return "Finance-ready service invoice still needs a maker to submit it for loan approval.";
    }

    if (readinessState == "Rejected") {
      return "Checker rejected the latest loan approval request.";
    }

    if (readinessState == "Released") {
      return "Invoice has already been converted into an MLS loan account.";
    }

    if (readinessState == "Payment review required") {
      return "A customer settlement proof needs finance review before loan conversion.";
    }

    if (invoice.PaymentSubmissions.Any(submission =>
        string.Equals(submission.Status, ServiceInvoiceFinancePolicy.CheckoutPendingStatus, StringComparison.OrdinalIgnoreCase))) {
      return "A hosted checkout session is still pending for this invoice.";
    }

    if (invoice.OutstandingAmount <= 0m) {
      return "Invoice has no unpaid balance to finance.";
    }

    if (invoice.InterestableAmount <= 0m) {
      return "Invoice has no interestable amount to convert.";
    }

    return $"Current derived invoice status is {derivedStatus}.";
  }

  private static string ResolveStandaloneApprovalReason(MicroLoan loan, string readinessState) =>
    readinessState switch {
      "Ready for approval" => "Maker submitted this standalone loan for checker approval before ledger release.",
      "Rejected" => "Checker rejected this standalone loan request before release.",
      _ => loan.ApprovalReviewedAtUtc.HasValue
        ? "Standalone loan has already passed approval and was released into the ledger."
        : "Standalone loan existed before persisted maker-checker approval was introduced."
    };

  private static int GetApprovalStatePriority(string readinessState) =>
    readinessState switch {
      "Ready for approval" => 0,
      "Payment review required" => 1,
      "Approval request needed" => 2,
      "Approved for release" => 3,
      "Blocked" => 4,
      "Rejected" => 5,
      "Released" => 6,
      _ => 4
    };

  private static string ResolvePolicyState(MicroLoan loan) =>
    loan.AnnualInterestRate is < 1m or > 60m ||
    loan.TermMonths is < 1 or > 36 ||
    loan.PrincipalAmount > 250000m
      ? "Policy exception"
      : "Inside policy";

  private static string GetLoanLabel(MicroLoan loan) =>
    loan.Invoice?.InvoiceNumber ?? $"ML-{loan.Id.ToString()[..8].ToUpperInvariant()}";

  private static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);

  private sealed record PortfolioRiskRow(
      Guid MicroLoanId,
      string CustomerName,
      string LoanLabel,
      string LoanStatus,
      decimal OutstandingBalance,
      decimal OverdueAmount,
      int DaysPastDue,
      DateTime? NextDueDate,
      string RiskState);

  private sealed record ApprovalWorkspaceRow(
      string CandidateId,
      string CandidateKind,
      string ServiceRequestNumber,
      string CustomerName,
      string InvoiceNumber,
      decimal Amount,
      string SourceType,
      string ReadinessState,
      string RiskFlag,
      DateTime CreatedAtUtc,
      string Reason,
      bool CanApprove,
      bool CanReject,
      string? RequestedByUserName,
      DateTime? RequestedAtUtc,
      string? ReviewedByUserName,
      DateTime? ReviewedAtUtc,
      string? ReviewRemarks);

  private sealed record FinancePolicyRow(
      Guid MicroLoanId,
      string CustomerName,
      string LoanLabel,
      decimal AnnualInterestRate,
      int TermMonths,
      decimal PrincipalAmount,
      string LoanStatus,
      string PolicyState,
      DateTime CreatedAtUtc);
}

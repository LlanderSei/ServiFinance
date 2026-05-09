namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Payments;
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

    tenantApi.MapGet("/mls/finance-policy", GetFinancePolicyAsync)
        .RequireTenantMlsPermission("mls.finance-policy.view", MlsModuleCodeFinancePolicyControl);

    return tenantApi;
  }

  private static async Task<IResult> GetPortfolioRiskAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var todayUtc = DateTime.UtcNow.Date;
    var weekEndUtc = todayUtc.AddDays(7);
    var activeLoans = await dbContext.MicroLoans
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.Invoice)
        .Include(entity => entity.AmortizationSchedules)
        .Where(entity => entity.LoanStatus != "Paid")
        .ToListAsync(cancellationToken);

    var rows = activeLoans
        .Select(loan => BuildPortfolioRiskRow(loan, todayUtc))
        .OrderByDescending(row => row.DaysPastDue)
        .ThenByDescending(row => row.OverdueAmount)
        .ThenBy(row => row.CustomerName)
        .ToArray();

    var outstandingBalance = RoundCurrency(rows.Sum(row => row.OutstandingBalance));
    var overdueBalance = RoundCurrency(rows.Sum(row => row.OverdueAmount));
    var dueThisWeekBalance = RoundCurrency(activeLoans.Sum(loan => loan.AmortizationSchedules
        .Where(schedule => schedule.InstallmentStatus != "Paid" &&
            schedule.DueDate.Date >= todayUtc &&
            schedule.DueDate.Date <= weekEndUtc)
        .Sum(schedule => Math.Max(0m, schedule.InstallmentAmount - schedule.PaidAmount))));

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
        NeedsReview = rows.Count(row => row.ReadinessState is "Ready for approval" or "Payment review required"),
        BlockedCandidates = rows.Count(row => row.ReadinessState == "Blocked"),
        AverageCandidateAmount = readyRows.Length == 0
            ? 0m
            : RoundCurrency(readyRows.Average(row => row.Amount))
      },
      Rows = rows
    });
  }

  private static async Task<IResult> GetFinancePolicyAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var loans = await dbContext.MicroLoans
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.Invoice)
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
      PolicyBands = BuildPolicyBands(rows),
      Rows = rows
    });
  }

  private static PortfolioRiskRow BuildPortfolioRiskRow(MicroLoan loan, DateTime todayUtc) {
    var unpaidSchedules = loan.AmortizationSchedules
        .Where(schedule => schedule.InstallmentStatus != "Paid")
        .ToArray();
    var overdueSchedules = unpaidSchedules
        .Where(schedule => schedule.DueDate.Date < todayUtc)
        .ToArray();
    var outstandingBalance = RoundCurrency(Math.Max(
        0m,
        loan.TotalRepayableAmount - loan.AmortizationSchedules.Sum(schedule => schedule.PaidAmount)));
    var overdueAmount = RoundCurrency(overdueSchedules.Sum(schedule => Math.Max(
        0m,
        schedule.InstallmentAmount - schedule.PaidAmount)));
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
        invoice.ServiceRequest?.RequestNumber ?? "Service invoice",
        invoice.Customer?.FullName ?? "Unknown customer",
        invoice.InvoiceNumber,
        RoundCurrency(invoice.OutstandingAmount),
        "Service invoice",
        readinessState,
        ResolveApprovalRiskFlag(invoice, readinessState, derivedStatus),
        invoice.InvoiceDateUtc,
        ResolveApprovalReason(invoice, readinessState, derivedStatus));
  }

  private static ApprovalWorkspaceRow BuildApprovalStandaloneLoanRow(MicroLoan loan) =>
    new(
        loan.Id.ToString(),
        "Standalone loan",
        loan.Customer?.FullName ?? "Unknown borrower",
        GetLoanLabel(loan),
        RoundCurrency(loan.PrincipalAmount),
        "Standalone loan",
        "Released",
        ResolvePolicyState(loan) == "Policy exception" ? "Policy exception" : "Normal",
        loan.CreatedAtUtc,
        "Standalone loan is already released. Dedicated approval-state persistence is a future workflow hardening slice.");

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

    return ServiceInvoiceFinancePolicy.CanConvertToLoan(
        hasInvoice: true,
        hasMicroLoan: false,
        outstandingAmount: invoice.OutstandingAmount,
        interestableAmount: invoice.InterestableAmount,
        invoiceStatus: derivedStatus)
      ? "Ready for approval"
      : "Blocked";
  }

  private static string ResolveApprovalRiskFlag(Invoice invoice, string readinessState, string derivedStatus) {
    if (readinessState == "Released") {
      return "Released";
    }

    if (readinessState == "Payment review required") {
      return "Settlement pending";
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
      return "Finance-ready service invoice with an unpaid interestable balance.";
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

  private static int GetApprovalStatePriority(string readinessState) =>
    readinessState switch {
      "Ready for approval" => 0,
      "Payment review required" => 1,
      "Blocked" => 2,
      "Released" => 3,
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
      string ServiceRequestNumber,
      string CustomerName,
      string InvoiceNumber,
      decimal Amount,
      string SourceType,
      string ReadinessState,
      string RiskFlag,
      DateTime CreatedAtUtc,
      string Reason);

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

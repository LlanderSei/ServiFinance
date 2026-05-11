namespace ServiFinance.Api.Endpoints.TenantMls;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Payments;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsLoanConversionEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsLoanConversionEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/loan-conversion", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeServiceLinkedLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          var candidates = await QueryConvertibleInvoices(dbContext)
              .ToListAsync(cancellationToken);

          return Results.Ok(new TenantMlsLoanConversionWorkspaceResponse(
              candidates.Select(BuildLoanConversionCandidate).ToArray()));
        })
        .RequireTenantMlsPermission("mls.loan-conversion.manage", MlsModuleCodeServiceLinkedLoans);

    tenantApi.MapPost("/mls/loan-conversion/{invoiceId:guid}/approval-request", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid invoiceId,
        [FromBody] RequestTenantMlsLoanApprovalRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuditLogService auditLogService,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeServiceLinkedLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var remarks = TenantMlsLoanApprovalPolicy.NormalizeRemarks(request.Remarks);
          if ((remarks?.Length ?? 0) > TenantMlsLoanApprovalPolicy.RemarksMaxLength) {
            return Results.BadRequest(new { error = $"Approval remarks must be {TenantMlsLoanApprovalPolicy.RemarksMaxLength} characters or fewer." });
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

          if (TenantMlsLoanApprovalPolicy.IsApproved(invoice!)) {
            return Results.BadRequest(new { error = "This invoice is already approved for loan release." });
          }

          if (TenantMlsLoanApprovalPolicy.IsPending(invoice!) && invoice!.LoanApprovalRequestedByUserId == currentUserId) {
            return Results.Conflict(new { error = "This invoice is already waiting for another MLS operator to approve it." });
          }

          invoice!.LoanApprovalStatus = TenantMlsLoanApprovalPolicy.PendingReviewStatus;
          invoice.LoanApprovalRequestedByUserId = currentUserId;
          invoice.LoanApprovalRequestedAtUtc = DateTime.UtcNow;
          invoice.LoanApprovalReviewedByUserId = null;
          invoice.LoanApprovalReviewedAtUtc = null;
          invoice.LoanApprovalRemarks = remarks;

          await dbContext.SaveChangesAsync(cancellationToken);
          await TenantMlsAuditLogging.WriteSystemAuditAsync(
              auditLogService,
              httpContext,
              invoice.TenantId,
              "LoanApprovalRequest",
              "Requested",
              "Invoice",
              invoice.Id,
              invoice.InvoiceNumber,
              $"Requested maker-checker approval for service invoice {invoice.InvoiceNumber}.");

          return Results.Ok(new { message = "Loan approval request submitted." });
        })
        .RequireTenantMlsPermission("mls.loan-conversion.manage", MlsModuleCodeServiceLinkedLoans);

    tenantApi.MapGet("/mls/loan-conversion/{invoiceId:guid}/preview", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid invoiceId,
        [AsParameters] TenantMlsLoanConversionTermsRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeServiceLinkedLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          var invoice = await QueryConvertibleInvoices(dbContext)
              .FirstOrDefaultAsync(entity => entity.Id == invoiceId, cancellationToken);
          if (invoice is null) {
            return Results.NotFound(new { error = "The selected invoice is not available for loan conversion." });
          }

          var validationError = ValidateTerms(request.AnnualInterestRate, request.TermMonths);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var preview = BuildLoanPreview(invoice, request.AnnualInterestRate, request.TermMonths, request.LoanStartDate);
          return Results.Ok(preview);
        })
        .RequireTenantMlsPermission("mls.loan-conversion.manage", MlsModuleCodeServiceLinkedLoans);

    tenantApi.MapPost("/mls/loan-conversion", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] CreateTenantMlsLoanConversionRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuditLogService auditLogService,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeServiceLinkedLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var validationError = ValidateTerms(request.AnnualInterestRate, request.TermMonths);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var invoice = await dbContext.Invoices
              .Include(entity => entity.Customer)
              .Include(entity => entity.ServiceRequest)
              .Include(entity => entity.MicroLoan)
              .Include(entity => entity.PaymentSubmissions)
              .FirstOrDefaultAsync(entity => entity.Id == request.InvoiceId, cancellationToken);
          var conversionBlockReason = GetConversionBlockReason(invoice, currentUserId);
          if (conversionBlockReason is not null) {
            return Results.BadRequest(new { error = conversionBlockReason });
          }

          if (request.LoanStartDate < DateOnly.FromDateTime(invoice!.InvoiceDateUtc)) {
            return Results.BadRequest(new { error = "Loan start date cannot be earlier than the source invoice date." });
          }

          if (await dbContext.MicroLoans.AnyAsync(entity => entity.InvoiceId == request.InvoiceId, cancellationToken)) {
            return Results.BadRequest(new { error = "The selected invoice can no longer be converted into a loan." });
          }

          var preview = BuildLoanPreview(invoice, request.AnnualInterestRate, request.TermMonths, request.LoanStartDate);
          var runningBalance = await dbContext.Transactions
              .Where(entity => entity.CustomerId == invoice.CustomerId)
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Select(entity => entity.RunningBalance)
              .FirstOrDefaultAsync(cancellationToken);

          var microLoanId = Guid.NewGuid();
          var microLoan = new MicroLoan {
            Id = microLoanId,
            InvoiceId = invoice.Id,
            CustomerId = invoice.CustomerId,
            PrincipalAmount = preview.Summary.PrincipalAmount,
            AnnualInterestRate = preview.Summary.AnnualInterestRate,
            TermMonths = preview.Summary.TermMonths,
            MonthlyInstallment = preview.Summary.MonthlyInstallment,
            TotalInterestAmount = preview.Summary.TotalInterestAmount,
            TotalRepayableAmount = preview.Summary.TotalRepayableAmount,
            LoanStartDate = preview.Summary.LoanStartDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            MaturityDate = preview.Summary.MaturityDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            LoanStatus = "Active",
            ApprovalStatus = TenantMlsLoanApprovalPolicy.ApprovedStatus,
            ApprovalRequestedByUserId = invoice!.LoanApprovalRequestedByUserId,
            ApprovalRequestedAtUtc = invoice.LoanApprovalRequestedAtUtc,
            ApprovalReviewedByUserId = invoice.LoanApprovalReviewedByUserId,
            ApprovalReviewedAtUtc = invoice.LoanApprovalReviewedAtUtc,
            ApprovalRemarks = invoice.LoanApprovalRemarks,
            CreatedByUserId = currentUserId,
            CreatedAtUtc = DateTime.UtcNow
          };

          dbContext.MicroLoans.Add(microLoan);

          foreach (var row in preview.Schedule) {
            dbContext.AmortizationSchedules.Add(new AmortizationSchedule {
              Id = Guid.NewGuid(),
              MicroLoanId = microLoanId,
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

          var loanTransaction = new LedgerTransaction {
            Id = Guid.NewGuid(),
            CustomerId = invoice.CustomerId,
            InvoiceId = invoice.Id,
            MicroLoanId = microLoanId,
            TransactionDateUtc = DateTime.UtcNow,
            TransactionType = "LoanCreation",
            ReferenceNumber = GenerateReferenceCode("MLS-LOAN"),
            DebitAmount = preview.Summary.PrincipalAmount,
            CreditAmount = 0m,
            RunningBalance = TenantMlsLoanMath.RoundCurrency(runningBalance + preview.Summary.PrincipalAmount),
            Remarks = $"Loan created from invoice {invoice.InvoiceNumber}",
            CreatedByUserId = currentUserId
          };

          dbContext.Transactions.Add(loanTransaction);

          try {
            await dbContext.SaveChangesAsync(cancellationToken);
          }
          catch (DbUpdateException) {
            var wasConvertedByAnotherRequest = await dbContext.MicroLoans
                .AsNoTracking()
                .AnyAsync(entity => entity.InvoiceId == request.InvoiceId, cancellationToken);
            if (wasConvertedByAnotherRequest) {
              return Results.Conflict(new { error = "This invoice was already converted into an MLS loan. Refresh the loan conversion queue." });
            }

            throw;
          }

          await TenantMlsAuditLogging.WriteSystemAuditAsync(
              auditLogService,
              httpContext,
              invoice.TenantId,
              "LoanCreation",
              "Created",
              "MicroLoan",
              microLoanId,
              invoice.InvoiceNumber,
              $"Created a loan for {invoice.Customer!.FullName} from invoice {invoice.InvoiceNumber}.");

          return Results.Ok(new TenantMlsLoanCreatedResponse(
              microLoanId,
              invoice.InvoiceNumber,
              invoice.Customer!.FullName,
              preview.Summary));
        })
        .RequireTenantMlsPermission("mls.loan-conversion.manage", MlsModuleCodeServiceLinkedLoans);

    return tenantApi;
  }

  private static IQueryable<Invoice> QueryConvertibleInvoices(ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext) =>
    dbContext.Invoices
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.ServiceRequest)
        .Include(entity => entity.MicroLoan)
        .Include(entity => entity.PaymentSubmissions)
        .Include(entity => entity.LoanApprovalRequestedByUser)
        .Include(entity => entity.LoanApprovalReviewedByUser)
        .Where(entity => entity.InvoiceStatus == ServiceInvoiceFinancePolicy.FinalizedStatus)
        .Where(entity => entity.MicroLoan == null)
        .Where(entity => entity.OutstandingAmount > 0m)
        .Where(entity => entity.InterestableAmount > 0m)
        .Where(entity => !entity.PaymentSubmissions.Any(submission =>
            submission.Status == ServiceInvoiceFinancePolicy.PaymentSubmittedStatus ||
            submission.Status == ServiceInvoiceFinancePolicy.LegacyPendingReviewStatus ||
            submission.Status == ServiceInvoiceFinancePolicy.CheckoutPendingStatus))
        .OrderByDescending(entity => entity.InvoiceDateUtc);

  private static string? GetConversionBlockReason(Invoice? invoice, Guid currentUserId) {
    if (invoice is null) {
      return "The selected invoice can no longer be converted into a loan.";
    }

    if (invoice.MicroLoan is not null) {
      return "This invoice has already been converted into an MLS loan account.";
    }

    if (invoice.PaymentSubmissions.Any(entity => ServiceInvoiceFinancePolicy.IsManualReviewPendingStatus(entity.Status))) {
      return "This invoice has a customer payment proof pending finance review. Review or reject the proof before converting it into a loan.";
    }

    if (invoice.PaymentSubmissions.Any(entity => string.Equals(entity.Status, ServiceInvoiceFinancePolicy.CheckoutPendingStatus, StringComparison.OrdinalIgnoreCase))) {
      return "This invoice has a Stripe checkout session still in progress. Resolve the checkout before converting it into a loan.";
    }

    var derivedInvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);
    if (!CanConvertToLoan(true, false, invoice.OutstandingAmount, invoice.InterestableAmount, derivedInvoiceStatus)) {
      return $"Only finalized invoices with unpaid interestable balances can be converted. Current invoice status: {derivedInvoiceStatus}.";
    }

    var approvalStatus = TenantMlsLoanApprovalPolicy.NormalizeInvoiceApprovalStatus(invoice);
    if (!string.Equals(approvalStatus, TenantMlsLoanApprovalPolicy.ApprovedStatus, StringComparison.OrdinalIgnoreCase)) {
      return approvalStatus switch {
        TenantMlsLoanApprovalPolicy.PendingReviewStatus => "This invoice is still waiting for maker-checker approval before release.",
        TenantMlsLoanApprovalPolicy.RejectedStatus => "This invoice was rejected for loan release. Submit a new approval request if it should be reconsidered.",
        _ => "Submit this invoice for maker-checker approval before converting it into a loan."
      };
    }

    if (invoice.LoanApprovalReviewedByUserId == currentUserId) {
      return "The checker who approved this invoice cannot also release it as a loan.";
    }

    return null;
  }

  private static string? ValidateTerms(decimal annualInterestRate, int termMonths) {
    if (annualInterestRate < 0m || annualInterestRate > 120m) {
      return "Annual interest rate must stay between 0 and 120 percent.";
    }

    if (termMonths is < 1 or > 60) {
      return "Term months must stay between 1 and 60.";
    }

    return null;
  }

  private static TenantMlsLoanConversionPreviewResponse BuildLoanPreview(
    Invoice invoice,
    decimal annualInterestRate,
    int termMonths,
    DateOnly loanStartDate) {
    var computation = TenantMlsLoanMath.Build(invoice.OutstandingAmount, annualInterestRate, termMonths, loanStartDate);

    return new TenantMlsLoanConversionPreviewResponse(
        BuildLoanConversionCandidate(invoice),
        computation.Summary,
        computation.Schedule);
  }

  private static TenantMlsLoanConversionCandidateResponse BuildLoanConversionCandidate(Invoice invoice) =>
    new(
        invoice.Id,
        invoice.ServiceRequestId,
        invoice.CustomerId,
        invoice.Customer!.FullName,
        invoice.ServiceRequest != null ? invoice.ServiceRequest.RequestNumber : "Standalone finance record",
        invoice.InvoiceNumber,
        invoice.InvoiceDateUtc,
        invoice.OutstandingAmount,
        invoice.InterestableAmount,
        TenantMlsLoanApprovalPolicy.NormalizeInvoiceApprovalStatus(invoice),
        invoice.LoanApprovalRemarks,
        invoice.LoanApprovalRequestedAtUtc,
        invoice.LoanApprovalRequestedByUser?.FullName,
        invoice.LoanApprovalReviewedAtUtc,
        invoice.LoanApprovalReviewedByUser?.FullName);
}

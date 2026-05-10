namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Payments;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsCustomerFinanceEndpointMappings {
  private const int EmailMaxLength = 50;
  private const int AddressMaxLength = 500;
  private const int AddressDetailsMaxLength = 500;
  private const int ReviewRemarksMaxLength = 1000;

  public static RouteGroupBuilder MapTenantMlsCustomerFinanceEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/customers", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeFinancialRecords);
          if (accessResult is not null) {
            return accessResult;
          }

          var lateFeePolicy = await TenantMlsLoanMath.LoadLateFeePolicyAsync(dbContext, cancellationToken);

          var customers = await dbContext.Customers
              .AsNoTracking()
              .AsSplitQuery()
              .Include(entity => entity.MicroLoans)
                .ThenInclude(entity => entity!.AmortizationSchedules)
              .Include(entity => entity.Transactions)
              .Include(entity => entity.Invoices)
                .ThenInclude(entity => entity!.MicroLoan)
              .Include(entity => entity.Invoices)
                .ThenInclude(entity => entity!.PaymentSubmissions)
              .OrderBy(entity => entity.FullName)
              .ToListAsync(cancellationToken);

          var rows = customers
              .Select(entity => CreateCustomerFinanceRow(entity, lateFeePolicy, DateTime.UtcNow))
              .ToArray();

          return Results.Ok(new TenantMlsCustomerFinanceWorkspaceResponse(
              new TenantMlsCustomerFinanceSummaryResponse(
                  rows.Length,
                  rows.Count(entity => entity.OutstandingBalance > 0m || entity.ActiveLoanCount > 0),
                  rows.Sum(entity => entity.OutstandingBalance),
                  rows.Sum(entity => entity.TotalCollectedAmount)),
              rows));
        })
        .RequireTenantMlsPermission("mls.customer-finance.view", MlsModuleCodeFinancialRecords);

    tenantApi.MapPost("/mls/customers", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] CreateCustomerRecordRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeStandaloneLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          if (string.IsNullOrWhiteSpace(request.FullName)) {
            return Results.BadRequest(new { error = "Customer full name is required." });
          }

          if (request.Email.Trim().Length > EmailMaxLength) {
            return Results.BadRequest(new { error = $"Customer email must be {EmailMaxLength} characters or fewer." });
          }

          if (request.Address.Trim().Length > AddressMaxLength) {
            return Results.BadRequest(new { error = $"Customer address must be {AddressMaxLength} characters or fewer." });
          }

          if ((request.AddressDetails?.Trim().Length ?? 0) > AddressDetailsMaxLength) {
            return Results.BadRequest(new { error = $"Address details must be {AddressDetailsMaxLength} characters or fewer." });
          }

          var customer = new Customer {
            CustomerCode = GenerateReferenceCode("CUS"),
            FullName = request.FullName.Trim(),
            MobileNumber = request.MobileNumber.Trim(),
            Email = request.Email.Trim(),
            Address = request.Address.Trim(),
            AddressDetails = NormalizeOptionalText(request.AddressDetails),
            CreatedAtUtc = DateTime.UtcNow
          };

          dbContext.Customers.Add(customer);
          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(CreateCustomerFinanceRow(customer, TenantMlsLoanMath.CreateLateFeePolicy(null), DateTime.UtcNow));
        })
        .RequireTenantMlsPermission("mls.standalone-loans.manage", MlsModuleCodeStandaloneLoans);

    tenantApi.MapGet("/mls/customers/{customerId:guid}", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid customerId,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeFinancialRecords);
          if (accessResult is not null) {
            return accessResult;
          }

          var lateFeePolicy = await TenantMlsLoanMath.LoadLateFeePolicyAsync(dbContext, cancellationToken);

          var customer = await dbContext.Customers
              .AsNoTracking()
              .AsSplitQuery()
              .Include(entity => entity.MicroLoans)
                .ThenInclude(entity => entity!.Invoice)
              .Include(entity => entity.MicroLoans)
                .ThenInclude(entity => entity!.AmortizationSchedules)
              .Include(entity => entity.Transactions)
              .Include(entity => entity.Invoices)
                .ThenInclude(entity => entity!.ServiceRequest)
              .Include(entity => entity.Invoices)
                .ThenInclude(entity => entity!.MicroLoan)
              .Include(entity => entity.Invoices)
                .ThenInclude(entity => entity!.PaymentSubmissions)
                  .ThenInclude(entity => entity.ReviewedByUser)
              .FirstOrDefaultAsync(entity => entity.Id == customerId, cancellationToken);
          if (customer is null) {
            return Results.NotFound(new { error = "The selected borrower record was not found." });
          }

          var loans = customer.MicroLoans
              .OrderByDescending(entity => entity.CreatedAtUtc)
              .Select(entity => CreateLoanAccountRow(entity, customer.FullName, lateFeePolicy, DateTime.UtcNow))
              .ToArray();

          var ledger = customer.Transactions
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Take(30)
              .Select(entity => new TenantMlsLedgerRowResponse(
                  entity.Id,
                  entity.TransactionDateUtc,
                  entity.TransactionType,
                  entity.ReferenceNumber,
                  customer.FullName,
                  entity.InvoiceId != null
                    ? customer.MicroLoans.FirstOrDefault(item => item.InvoiceId == entity.InvoiceId)?.Invoice?.InvoiceNumber ?? "Invoice-linked loan"
                    : entity.MicroLoanId != null
                      ? "Standalone loan"
                      : "General ledger",
                  entity.DebitAmount,
                  entity.CreditAmount,
                  entity.RunningBalance,
                  entity.Remarks))
              .ToArray();

          var serviceInvoices = customer.Invoices
              .OrderByDescending(entity => entity.InvoiceDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Select(CreateServiceInvoiceRow)
              .ToArray();

          return Results.Ok(new TenantMlsCustomerFinanceDetailResponse(
              CreateCustomerFinanceRow(customer, lateFeePolicy, DateTime.UtcNow),
              loans,
              ledger,
              serviceInvoices));
        })
        .RequireTenantMlsPermission("mls.customer-finance.view", MlsModuleCodeFinancialRecords);

    tenantApi.MapPost("/mls/invoice-settlements/{submissionId:guid}/approve", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid submissionId,
        [FromBody] ApproveTenantMlsInvoicePaymentSubmissionRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuditLogService auditLogService,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeFinancialRecords);
          if (accessResult is not null) {
            return accessResult;
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var reviewRemarks = NormalizeOptionalText(request.ReviewRemarks);
          if ((reviewRemarks?.Length ?? 0) > ReviewRemarksMaxLength) {
            return Results.BadRequest(new { error = $"Review remarks must be {ReviewRemarksMaxLength} characters or fewer." });
          }

          var approvedAmount = RoundCurrency(request.ApprovedAmount);
          if (approvedAmount <= 0m) {
            return Results.BadRequest(new { error = "Approved amount must be greater than zero." });
          }

          var submission = await dbContext.InvoicePaymentSubmissions
              .Include(entity => entity.Invoice)
                .ThenInclude(entity => entity!.PaymentSubmissions)
              .Include(entity => entity.Invoice)
                .ThenInclude(entity => entity!.MicroLoan)
              .Include(entity => entity.Invoice)
                .ThenInclude(entity => entity!.ServiceRequest)
              .FirstOrDefaultAsync(entity => entity.Id == submissionId, cancellationToken);
          if (submission is null || submission.Invoice is null) {
            return Results.NotFound(new { error = "The selected settlement proof could not be found." });
          }

          if (!ServiceInvoiceFinancePolicy.IsManualReviewPendingStatus(submission.Status)) {
            return Results.BadRequest(new { error = "Only pending settlement proofs can be approved." });
          }

          if (submission.Invoice.MicroLoan is not null) {
            return Results.BadRequest(new { error = "This invoice has already been converted into an MLS loan account." });
          }

          if (approvedAmount > submission.AmountSubmitted) {
            return Results.BadRequest(new { error = "Approved amount cannot be greater than the customer's submitted amount." });
          }

          if (approvedAmount > submission.Invoice.OutstandingAmount) {
            return Results.BadRequest(new { error = "Approved amount cannot be greater than the invoice's outstanding balance." });
          }

          if (approvedAmount != submission.AmountSubmitted && string.IsNullOrWhiteSpace(reviewRemarks)) {
            return Results.BadRequest(new { error = "Add review remarks when the approved amount differs from the submitted amount." });
          }

          var now = DateTime.UtcNow;
          submission.Status = "Approved";
          submission.ApprovedAmount = approvedAmount;
          submission.ReviewRemarks = reviewRemarks;
          submission.ReviewedByUserId = currentUserId;
          submission.ReviewedAtUtc = now;

          submission.Invoice.OutstandingAmount = RoundCurrency(submission.Invoice.OutstandingAmount - approvedAmount);
          submission.Invoice.InvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(submission.Invoice);

          if (submission.Invoice.ServiceRequestId.HasValue) {
            dbContext.StatusLogs.Add(new StatusLog {
              ServiceRequestId = submission.Invoice.ServiceRequestId.Value,
              Status = submission.Invoice.ServiceRequest?.CurrentStatus ?? "Completed",
              Remarks = approvedAmount == submission.AmountSubmitted
                ? $"Tenant finance approved payment proof for invoice {submission.Invoice.InvoiceNumber} amounting to {approvedAmount:0.00}."
                : $"Tenant finance partially approved payment proof for invoice {submission.Invoice.InvoiceNumber}. Approved amount: {approvedAmount:0.00} from submitted amount {submission.AmountSubmitted:0.00}.",
              ChangedByUserId = currentUserId,
              ChangedAtUtc = now
            });
          }

          await dbContext.SaveChangesAsync(cancellationToken);
          await TenantMlsAuditLogging.WriteSystemAuditAsync(
              auditLogService,
              httpContext,
              submission.TenantId,
              "InvoiceSettlementApproval",
              "Approved",
              "InvoicePaymentSubmission",
              submission.Id,
              submission.ReferenceNumber,
              $"Approved {approvedAmount:F2} for service invoice {submission.Invoice.InvoiceNumber}.");

          return Results.NoContent();
        })
        .RequireTenantMlsPermission("mls.settlements.manage", MlsModuleCodeFinancialRecords);

    tenantApi.MapPost("/mls/invoice-settlements/{submissionId:guid}/reject", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid submissionId,
        [FromBody] RejectTenantMlsInvoicePaymentSubmissionRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuditLogService auditLogService,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeFinancialRecords);
          if (accessResult is not null) {
            return accessResult;
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var reviewRemarks = NormalizeOptionalText(request.ReviewRemarks);
          if (string.IsNullOrWhiteSpace(reviewRemarks)) {
            return Results.BadRequest(new { error = "Review remarks are required when rejecting a settlement proof." });
          }

          if (reviewRemarks.Length > ReviewRemarksMaxLength) {
            return Results.BadRequest(new { error = $"Review remarks must be {ReviewRemarksMaxLength} characters or fewer." });
          }

          var submission = await dbContext.InvoicePaymentSubmissions
              .Include(entity => entity.Invoice)
                .ThenInclude(entity => entity!.PaymentSubmissions)
              .Include(entity => entity.Invoice)
                .ThenInclude(entity => entity!.MicroLoan)
              .Include(entity => entity.Invoice)
                .ThenInclude(entity => entity!.ServiceRequest)
              .FirstOrDefaultAsync(entity => entity.Id == submissionId, cancellationToken);
          if (submission is null || submission.Invoice is null) {
            return Results.NotFound(new { error = "The selected settlement proof could not be found." });
          }

          if (!ServiceInvoiceFinancePolicy.IsManualReviewPendingStatus(submission.Status)) {
            return Results.BadRequest(new { error = "Only pending settlement proofs can be rejected." });
          }

          var now = DateTime.UtcNow;
          submission.Status = "Rejected";
          submission.ApprovedAmount = null;
          submission.ReviewRemarks = reviewRemarks;
          submission.ReviewedByUserId = currentUserId;
          submission.ReviewedAtUtc = now;

          submission.Invoice.InvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(submission.Invoice);

          if (submission.Invoice.ServiceRequestId.HasValue) {
            dbContext.StatusLogs.Add(new StatusLog {
              ServiceRequestId = submission.Invoice.ServiceRequestId.Value,
              Status = submission.Invoice.ServiceRequest?.CurrentStatus ?? "Completed",
              Remarks = $"Tenant finance rejected payment proof for invoice {submission.Invoice.InvoiceNumber}. Remarks: {reviewRemarks}",
              ChangedByUserId = currentUserId,
              ChangedAtUtc = now
            });
          }

          await dbContext.SaveChangesAsync(cancellationToken);
          await TenantMlsAuditLogging.WriteSystemAuditAsync(
              auditLogService,
              httpContext,
              submission.TenantId,
              "InvoiceSettlementRejection",
              "Rejected",
              "InvoicePaymentSubmission",
              submission.Id,
              submission.ReferenceNumber,
              $"Rejected settlement proof for service invoice {submission.Invoice.InvoiceNumber}. Remarks: {reviewRemarks}");

          return Results.NoContent();
        })
        .RequireTenantMlsPermission("mls.settlements.manage", MlsModuleCodeFinancialRecords);

    return tenantApi;
  }

  private static TenantMlsCustomerFinanceRowResponse CreateCustomerFinanceRow(
      Customer entity,
      TenantMlsLateFeePolicySnapshot lateFeePolicy,
      DateTime asOfUtc) {
    var activeLoanCount = entity.MicroLoans.Count(item => item.LoanStatus != "Paid");
    var settledLoanCount = entity.MicroLoans.Count(item => item.LoanStatus == "Paid");
    var serviceInvoiceOutstandingBalance = entity.Invoices
        .Where(item => item.MicroLoan == null)
        .Sum(item => item.OutstandingAmount);
    var outstandingBalance = entity.MicroLoans.Sum(item => TenantMlsLoanMath.GetOutstandingBalance(item, lateFeePolicy, asOfUtc)) + serviceInvoiceOutstandingBalance;
    var loanPaymentTransactions = GetActiveLoanPaymentTransactions(entity.Transactions);
    var totalCollectedAmount = loanPaymentTransactions.Sum(item => item.CreditAmount) + GetApprovedServiceInvoicePaymentTotal(entity.Invoices);
    var nextDueDate = entity.MicroLoans
        .SelectMany(item => item.AmortizationSchedules)
        .Where(item => TenantMlsLoanMath.GetInstallmentOutstandingBalance(item, lateFeePolicy, asOfUtc) > 0m)
        .OrderBy(item => item.DueDate)
        .Select(item => DateOnly.FromDateTime(item.DueDate))
        .FirstOrDefault();
    var lastLoanPaymentDateUtc = loanPaymentTransactions
        .OrderByDescending(item => item.TransactionDateUtc)
        .Select(item => (DateTime?)item.TransactionDateUtc)
        .FirstOrDefault();
    var lastServicePaymentDateUtc = entity.Invoices
        .SelectMany(item => item.PaymentSubmissions)
        .Where(item => item.Status == "Approved")
        .OrderByDescending(item => item.ReviewedAtUtc ?? item.SubmittedAtUtc)
        .Select(item => (DateTime?)(item.ReviewedAtUtc ?? item.SubmittedAtUtc))
        .FirstOrDefault();
    var lastPaymentDateUtc = GetLatestDate(lastLoanPaymentDateUtc, lastServicePaymentDateUtc);

    return new TenantMlsCustomerFinanceRowResponse(
        entity.Id,
        entity.CustomerCode,
        entity.FullName,
        entity.MobileNumber,
        entity.Email,
        entity.Address,
        entity.AddressDetails,
        activeLoanCount,
        settledLoanCount,
        RoundCurrency(outstandingBalance),
        RoundCurrency(totalCollectedAmount),
        nextDueDate == default ? null : nextDueDate,
        lastPaymentDateUtc);
  }

  private static TenantMlsLoanAccountRowResponse CreateLoanAccountRow(
      MicroLoan entity,
      string customerName,
      TenantMlsLateFeePolicySnapshot lateFeePolicy,
      DateTime asOfUtc) {
    var totalPaidAmount = entity.AmortizationSchedules.Sum(item => item.PaidAmount);
    var outstandingBalance = TenantMlsLoanMath.GetOutstandingBalance(entity, lateFeePolicy, asOfUtc);
    var nextDueDate = entity.AmortizationSchedules
        .Where(item => TenantMlsLoanMath.GetInstallmentOutstandingBalance(item, lateFeePolicy, asOfUtc) > 0m)
        .OrderBy(item => item.InstallmentNumber)
        .Select(item => DateOnly.FromDateTime(item.DueDate))
        .FirstOrDefault();

    return new TenantMlsLoanAccountRowResponse(
        entity.Id,
        entity.CustomerId,
        customerName,
        entity.Invoice != null ? entity.Invoice.InvoiceNumber : "Standalone loan",
        entity.PrincipalAmount,
        entity.TotalRepayableAmount,
        RoundCurrency(totalPaidAmount),
        outstandingBalance,
        TenantMlsLoanMath.GetPendingInstallmentCount(entity, lateFeePolicy, asOfUtc),
        nextDueDate == default ? null : nextDueDate,
        entity.LoanStatus,
        entity.CreatedAtUtc);
  }

  private static TenantMlsCustomerServiceInvoiceRowResponse CreateServiceInvoiceRow(Invoice entity) {
    var invoiceStatus = entity.MicroLoan is not null
      ? "Converted to MLS Loan"
      : entity.InvoiceStatus;

    return new TenantMlsCustomerServiceInvoiceRowResponse(
        entity.Id,
        entity.ServiceRequestId,
        entity.ServiceRequest?.RequestNumber,
        entity.InvoiceNumber,
        entity.InvoiceDateUtc,
        entity.TotalAmount,
        entity.OutstandingAmount,
        invoiceStatus,
        entity.MicroLoan is not null,
        entity.MicroLoan?.LoanStatus,
        entity.PaymentSubmissions
            .OrderByDescending(item => item.SubmittedAtUtc)
            .ThenByDescending(item => item.Id)
            .Select(item => CreateInvoicePaymentSubmissionRow(item, entity.ServiceRequest?.RequestNumber))
            .ToArray());
  }

  private static TenantMlsInvoicePaymentSubmissionRowResponse CreateInvoicePaymentSubmissionRow(
    InvoicePaymentSubmission entity,
    string? serviceRequestNumber) =>
    new(
        entity.Id,
        entity.InvoiceId,
        entity.ServiceRequestId,
        serviceRequestNumber,
        entity.AmountSubmitted,
        entity.ApprovedAmount,
        entity.PaymentMethod,
        entity.ReferenceNumber,
        entity.Status,
        entity.Note,
        entity.ReviewRemarks,
        entity.ProofOriginalFileName,
        entity.ProofRelativeUrl,
        entity.SubmittedAtUtc,
        entity.ReviewedAtUtc,
        entity.ReviewedByUser?.FullName);

  private static IReadOnlyList<LedgerTransaction> GetActiveLoanPaymentTransactions(IEnumerable<LedgerTransaction> transactions) {
    var reversedTransactionIds = transactions
        .Where(item => item.TransactionType == "LoanPaymentReversal" && item.ReversalOfTransactionId.HasValue)
        .Select(item => item.ReversalOfTransactionId!.Value)
        .ToHashSet();

    return transactions
        .Where(item => item.TransactionType == "LoanPayment" && !reversedTransactionIds.Contains(item.Id))
        .ToArray();
  }

  private static decimal GetApprovedServiceInvoicePaymentTotal(IEnumerable<Invoice> invoices) =>
    invoices
        .SelectMany(item => item.PaymentSubmissions)
        .Where(item => item.Status == "Approved")
        .Sum(item => item.ApprovedAmount ?? item.AmountSubmitted);

  private static DateTime? GetLatestDate(DateTime? first, DateTime? second) {
    if (!first.HasValue) {
      return second;
    }

    if (!second.HasValue) {
      return first;
    }

    return first.Value >= second.Value ? first : second;
  }

  private static string? NormalizeOptionalText(string? value) {
    var normalized = value?.Trim();
    return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
  }

  private static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

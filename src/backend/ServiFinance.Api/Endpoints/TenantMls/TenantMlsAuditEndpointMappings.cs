namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsAuditEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsAuditEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/audit", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        string? actionType,
        string? searchTerm,
        DateTime? dateFrom,
        DateTime? dateTo,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeAuditLogs);
          if (accessResult is not null) {
            return accessResult;
          }

          var normalizedActionType = string.IsNullOrWhiteSpace(actionType)
            ? null
            : actionType.Trim();
          var normalizedSearchTerm = string.IsNullOrWhiteSpace(searchTerm)
            ? null
            : searchTerm.Trim();
          var dateRange = ResolveDateRange(dateFrom, dateTo);
          if (dateRange.Error is not null) {
            return Results.BadRequest(new { error = dateRange.Error });
          }

          var includeLoanEvents = normalizedActionType is null or "LoanCreation" or "StandaloneLoanCreation";
          var includePaymentEvents = normalizedActionType is null or "LoanPayment" or "LoanPaymentReversal";

          IQueryable<MicroLoan>? loanQuery = null;
          if (includeLoanEvents) {
            loanQuery = dbContext.MicroLoans
                .AsNoTracking()
                .Include(entity => entity.Customer)
                .Include(entity => entity.Invoice)
                .Include(entity => entity.CreatedByUser)
                .AsQueryable();

            if (normalizedActionType == "LoanCreation") {
              loanQuery = loanQuery.Where(entity => entity.InvoiceId != null);
            } else if (normalizedActionType == "StandaloneLoanCreation") {
              loanQuery = loanQuery.Where(entity => entity.InvoiceId == null);
            }

            if (dateRange.DateFromUtc.HasValue) {
              loanQuery = loanQuery.Where(entity => entity.CreatedAtUtc >= dateRange.DateFromUtc.Value);
            }

            if (dateRange.DateToExclusiveUtc.HasValue) {
              loanQuery = loanQuery.Where(entity => entity.CreatedAtUtc < dateRange.DateToExclusiveUtc.Value);
            }

            if (!string.IsNullOrWhiteSpace(normalizedSearchTerm)) {
              loanQuery = loanQuery.Where(entity =>
                  (entity.CreatedByUser != null && entity.CreatedByUser.FullName.Contains(normalizedSearchTerm)) ||
                  (entity.Customer != null && entity.Customer.FullName.Contains(normalizedSearchTerm)) ||
                  (entity.Invoice != null && entity.Invoice.InvoiceNumber.Contains(normalizedSearchTerm)));
            }
          }

          var loanEvents = loanQuery is null
            ? []
            : await loanQuery
              .OrderByDescending(entity => entity.CreatedAtUtc)
              .Take(100)
              .Select(entity => new TenantMlsAuditRowResponse(
                  entity.Id,
                  entity.CreatedAtUtc,
                  entity.InvoiceId != null ? "LoanCreation" : "StandaloneLoanCreation",
                  entity.CreatedByUser != null ? entity.CreatedByUser.FullName : "Unknown operator",
                  entity.Customer != null ? entity.Customer.FullName : "Unknown borrower",
                  entity.Invoice != null ? entity.Invoice.InvoiceNumber : "Standalone loan",
                  entity.Invoice != null ? entity.Invoice.InvoiceNumber : entity.Id.ToString(),
                  entity.InvoiceId != null
                    ? "Created a loan from a finance-ready invoice."
                    : "Created a standalone MLS loan."))
              .ToListAsync(cancellationToken);

          IQueryable<LedgerTransaction>? paymentQuery = null;
          if (includePaymentEvents) {
            paymentQuery = dbContext.Transactions
                .AsNoTracking()
                .Include(entity => entity.Customer)
                .Include(entity => entity.Invoice)
                .Include(entity => entity.CreatedByUser)
                .Where(entity => entity.TransactionType == "LoanPayment" || entity.TransactionType == "LoanPaymentReversal");

            if (normalizedActionType is "LoanPayment" or "LoanPaymentReversal") {
              paymentQuery = paymentQuery.Where(entity => entity.TransactionType == normalizedActionType);
            }

            if (dateRange.DateFromUtc.HasValue) {
              paymentQuery = paymentQuery.Where(entity => entity.TransactionDateUtc >= dateRange.DateFromUtc.Value);
            }

            if (dateRange.DateToExclusiveUtc.HasValue) {
              paymentQuery = paymentQuery.Where(entity => entity.TransactionDateUtc < dateRange.DateToExclusiveUtc.Value);
            }

            if (!string.IsNullOrWhiteSpace(normalizedSearchTerm)) {
              paymentQuery = paymentQuery.Where(entity =>
                  entity.ReferenceNumber.Contains(normalizedSearchTerm) ||
                  entity.Remarks.Contains(normalizedSearchTerm) ||
                  (entity.CreatedByUser != null && entity.CreatedByUser.FullName.Contains(normalizedSearchTerm)) ||
                  (entity.Customer != null && entity.Customer.FullName.Contains(normalizedSearchTerm)) ||
                  (entity.Invoice != null && entity.Invoice.InvoiceNumber.Contains(normalizedSearchTerm)));
            }
          }

          var paymentEvents = paymentQuery is null
            ? []
            : await paymentQuery
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .Take(100)
              .Select(entity => new TenantMlsAuditRowResponse(
                  entity.Id,
                  entity.TransactionDateUtc,
                  entity.TransactionType,
                  entity.CreatedByUser != null ? entity.CreatedByUser.FullName : "Unknown operator",
                  entity.Customer != null ? entity.Customer.FullName : "Unknown borrower",
                  entity.Invoice != null ? entity.Invoice.InvoiceNumber : "Standalone loan",
                  entity.ReferenceNumber,
                  entity.Remarks != string.Empty
                    ? entity.Remarks
                    : entity.TransactionType == "LoanPaymentReversal"
                      ? "Payment reversal posted in the MLS ledger."
                      : "Payment posted in the MLS ledger."))
              .ToListAsync(cancellationToken);

          var events = loanEvents
              .Concat(paymentEvents)
              .OrderByDescending(entity => entity.OccurredAtUtc)
              .Take(100)
              .ToArray();

          return Results.Ok(new TenantMlsAuditWorkspaceResponse(
              new TenantMlsAuditSummaryResponse(
                  events.Length,
                  events.Count(entity => entity.ActionType == "LoanCreation"),
                  events.Count(entity => entity.ActionType == "StandaloneLoanCreation"),
                  events.Count(entity => entity.ActionType == "LoanPayment"),
                  events.Count(entity => entity.ActionType == "LoanPaymentReversal")),
              events));
        });

    return tenantApi;
  }

  private static DateRange ResolveDateRange(DateTime? dateFrom, DateTime? dateTo) {
    var dateFromUtc = dateFrom?.Date;
    var dateToExclusiveUtc = dateTo?.Date.AddDays(1);
    if (dateFromUtc.HasValue && dateToExclusiveUtc.HasValue && dateToExclusiveUtc.Value <= dateFromUtc.Value) {
      return new DateRange("Audit end date must be on or after the start date.", null, null);
    }

    return new DateRange(null, dateFromUtc, dateToExclusiveUtc);
  }

  private readonly record struct DateRange(
      string? Error,
      DateTime? DateFromUtc,
      DateTime? DateToExclusiveUtc);
}

namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsLedgerEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsLedgerEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/ledger", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        string? transactionType,
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
              MlsModuleCodeLedgerReports);
          if (accessResult is not null) {
            return accessResult;
          }

          var normalizedTransactionType = string.IsNullOrWhiteSpace(transactionType)
            ? null
            : transactionType.Trim();
          var normalizedSearchTerm = string.IsNullOrWhiteSpace(searchTerm)
            ? null
            : searchTerm.Trim();
          var dateRange = ResolveDateRange(dateFrom, dateTo);
          if (dateRange.Error is not null) {
            return Results.BadRequest(new { error = dateRange.Error });
          }

          var ledgerQuery = dbContext.Transactions
              .AsNoTracking()
              .Include(entity => entity.Customer)
              .Include(entity => entity.Invoice)
              .Include(entity => entity.MicroLoan)
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .AsQueryable();

          if (!string.IsNullOrWhiteSpace(normalizedTransactionType)) {
            ledgerQuery = ledgerQuery.Where(entity => entity.TransactionType == normalizedTransactionType);
          }

          if (dateRange.DateFromUtc.HasValue) {
            ledgerQuery = ledgerQuery.Where(entity => entity.TransactionDateUtc >= dateRange.DateFromUtc.Value);
          }

          if (dateRange.DateToExclusiveUtc.HasValue) {
            ledgerQuery = ledgerQuery.Where(entity => entity.TransactionDateUtc < dateRange.DateToExclusiveUtc.Value);
          }

          if (!string.IsNullOrWhiteSpace(normalizedSearchTerm)) {
            ledgerQuery = ledgerQuery.Where(entity =>
                entity.TransactionType.Contains(normalizedSearchTerm) ||
                entity.ReferenceNumber.Contains(normalizedSearchTerm) ||
                entity.Remarks.Contains(normalizedSearchTerm) ||
                (entity.Customer != null && entity.Customer.FullName.Contains(normalizedSearchTerm)) ||
                (entity.Invoice != null && entity.Invoice.InvoiceNumber.Contains(normalizedSearchTerm)));
          }

          var entries = await ledgerQuery
              .Take(100)
              .Select(entity => new TenantMlsLedgerRowResponse(
                  entity.Id,
                  entity.TransactionDateUtc,
                  entity.TransactionType,
                  entity.ReferenceNumber,
                  entity.Customer!.FullName,
                  entity.Invoice != null
                    ? entity.Invoice.InvoiceNumber
                    : entity.MicroLoanId != null
                      ? "Standalone loan"
                      : "General ledger",
                  entity.DebitAmount,
                  entity.CreditAmount,
                  entity.RunningBalance,
                  entity.Remarks))
              .ToListAsync(cancellationToken);

          var summaryBaseQuery = dbContext.Transactions.AsNoTracking().AsQueryable();
          if (!string.IsNullOrWhiteSpace(normalizedTransactionType)) {
            summaryBaseQuery = summaryBaseQuery.Where(entity => entity.TransactionType == normalizedTransactionType);
          }
          if (dateRange.DateFromUtc.HasValue) {
            summaryBaseQuery = summaryBaseQuery.Where(entity => entity.TransactionDateUtc >= dateRange.DateFromUtc.Value);
          }
          if (dateRange.DateToExclusiveUtc.HasValue) {
            summaryBaseQuery = summaryBaseQuery.Where(entity => entity.TransactionDateUtc < dateRange.DateToExclusiveUtc.Value);
          }
          if (!string.IsNullOrWhiteSpace(normalizedSearchTerm)) {
            summaryBaseQuery = summaryBaseQuery.Where(entity =>
                entity.TransactionType.Contains(normalizedSearchTerm) ||
                entity.ReferenceNumber.Contains(normalizedSearchTerm) ||
                entity.Remarks.Contains(normalizedSearchTerm) ||
                (entity.Customer != null && entity.Customer.FullName.Contains(normalizedSearchTerm)) ||
                (entity.Invoice != null && entity.Invoice.InvoiceNumber.Contains(normalizedSearchTerm)));
          }

          var totalEntries = await summaryBaseQuery.CountAsync(cancellationToken);
          var totalLoanDisbursed = await summaryBaseQuery
              .Where(entity => entity.TransactionType == "LoanCreation" || entity.TransactionType == "StandaloneLoanCreation")
              .SumAsync(entity => (decimal?)entity.DebitAmount, cancellationToken) ?? 0m;
          var totalCollections = await summaryBaseQuery
              .Where(entity => entity.TransactionType == "LoanPayment" || entity.TransactionType == "LoanPaymentReversal")
              .SumAsync(entity => (decimal?)(
                  entity.TransactionType == "LoanPayment"
                    ? entity.CreditAmount
                    : -entity.DebitAmount), cancellationToken) ?? 0m;
          var currentRunningBalance = await summaryBaseQuery
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Select(entity => (decimal?)entity.RunningBalance)
              .FirstOrDefaultAsync(cancellationToken) ?? 0m;

          return Results.Ok(new TenantMlsLedgerWorkspaceResponse(
              new TenantMlsLedgerSummaryResponse(
                  totalEntries,
                  totalLoanDisbursed,
                  totalCollections,
                  currentRunningBalance),
              entries));
        });

    return tenantApi;
  }

  private static DateRange ResolveDateRange(DateTime? dateFrom, DateTime? dateTo) {
    var dateFromUtc = dateFrom?.Date;
    var dateToExclusiveUtc = dateTo?.Date.AddDays(1);
    if (dateFromUtc.HasValue && dateToExclusiveUtc.HasValue && dateToExclusiveUtc.Value <= dateFromUtc.Value) {
      return new DateRange("Ledger end date must be on or after the start date.", null, null);
    }

    return new DateRange(null, dateFromUtc, dateToExclusiveUtc);
  }

  private readonly record struct DateRange(
      string? Error,
      DateTime? DateFromUtc,
      DateTime? DateToExclusiveUtc);
}

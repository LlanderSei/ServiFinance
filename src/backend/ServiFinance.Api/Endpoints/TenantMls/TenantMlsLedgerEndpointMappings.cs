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
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var normalizedTransactionType = string.IsNullOrWhiteSpace(transactionType)
            ? null
            : transactionType.Trim();

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

          var totalEntries = await summaryBaseQuery.CountAsync(cancellationToken);
          var totalLoanDisbursed = await summaryBaseQuery
              .Where(entity => entity.TransactionType == "LoanCreation" || entity.TransactionType == "StandaloneLoanCreation")
              .SumAsync(entity => (decimal?)entity.DebitAmount, cancellationToken) ?? 0m;
          var totalCollections = await summaryBaseQuery
              .Where(entity => entity.TransactionType == "LoanPayment")
              .SumAsync(entity => (decimal?)entity.CreditAmount, cancellationToken) ?? 0m;
          var currentRunningBalance = await dbContext.Transactions
              .AsNoTracking()
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
}

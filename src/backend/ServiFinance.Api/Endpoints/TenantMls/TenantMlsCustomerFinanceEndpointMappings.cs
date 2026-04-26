namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsCustomerFinanceEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsCustomerFinanceEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/customers", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var customers = await dbContext.Customers
              .AsNoTracking()
              .AsSplitQuery()
              .Include(entity => entity.MicroLoans)
                .ThenInclude(entity => entity!.AmortizationSchedules)
              .Include(entity => entity.Transactions)
              .OrderBy(entity => entity.FullName)
              .ToListAsync(cancellationToken);

          var rows = customers
              .Where(entity => entity.MicroLoans.Count > 0 || entity.Transactions.Count > 0)
              .Select(CreateCustomerFinanceRow)
              .ToArray();

          return Results.Ok(new TenantMlsCustomerFinanceWorkspaceResponse(
              new TenantMlsCustomerFinanceSummaryResponse(
                  rows.Length,
                  rows.Count(entity => entity.ActiveLoanCount > 0),
                  rows.Sum(entity => entity.OutstandingBalance),
                  rows.Sum(entity => entity.TotalCollectedAmount)),
              rows));
        });

    tenantApi.MapGet("/mls/customers/{customerId:guid}", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid customerId,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var customer = await dbContext.Customers
              .AsNoTracking()
              .AsSplitQuery()
              .Include(entity => entity.MicroLoans)
                .ThenInclude(entity => entity!.Invoice)
              .Include(entity => entity.MicroLoans)
                .ThenInclude(entity => entity!.AmortizationSchedules)
              .Include(entity => entity.Transactions)
              .FirstOrDefaultAsync(entity => entity.Id == customerId, cancellationToken);
          if (customer is null) {
            return Results.NotFound(new { error = "The selected borrower record was not found." });
          }

          var loans = customer.MicroLoans
              .OrderByDescending(entity => entity.CreatedAtUtc)
              .Select(entity => CreateLoanAccountRow(entity, customer.FullName))
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

          return Results.Ok(new TenantMlsCustomerFinanceDetailResponse(
              CreateCustomerFinanceRow(customer),
              loans,
              ledger));
        });

    return tenantApi;
  }

  private static TenantMlsCustomerFinanceRowResponse CreateCustomerFinanceRow(Customer entity) {
    var activeLoanCount = entity.MicroLoans.Count(item => item.LoanStatus != "Paid");
    var settledLoanCount = entity.MicroLoans.Count(item => item.LoanStatus == "Paid");
    var outstandingBalance = entity.MicroLoans.Sum(GetOutstandingBalance);
    var totalCollectedAmount = entity.Transactions
        .Where(item => item.TransactionType == "LoanPayment")
        .Sum(item => item.CreditAmount);
    var nextDueDate = entity.MicroLoans
        .SelectMany(item => item.AmortizationSchedules)
        .Where(item => item.InstallmentStatus != "Paid")
        .OrderBy(item => item.DueDate)
        .Select(item => DateOnly.FromDateTime(item.DueDate))
        .FirstOrDefault();
    var lastPaymentDateUtc = entity.Transactions
        .Where(item => item.TransactionType == "LoanPayment")
        .OrderByDescending(item => item.TransactionDateUtc)
        .Select(item => (DateTime?)item.TransactionDateUtc)
        .FirstOrDefault();

    return new TenantMlsCustomerFinanceRowResponse(
        entity.Id,
        entity.CustomerCode,
        entity.FullName,
        activeLoanCount,
        settledLoanCount,
        RoundCurrency(outstandingBalance),
        RoundCurrency(totalCollectedAmount),
        nextDueDate == default ? null : nextDueDate,
        lastPaymentDateUtc);
  }

  private static TenantMlsLoanAccountRowResponse CreateLoanAccountRow(MicroLoan entity, string customerName) {
    var totalPaidAmount = entity.AmortizationSchedules.Sum(item => item.PaidAmount);
    var outstandingBalance = GetOutstandingBalance(entity);
    var nextDueDate = entity.AmortizationSchedules
        .Where(item => item.InstallmentStatus != "Paid")
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
        entity.AmortizationSchedules.Count(item => item.InstallmentStatus != "Paid"),
        nextDueDate == default ? null : nextDueDate,
        entity.LoanStatus,
        entity.CreatedAtUtc);
  }

  private static decimal GetOutstandingBalance(MicroLoan entity) {
    var totalPaidAmount = entity.AmortizationSchedules.Sum(item => item.PaidAmount);
    return RoundCurrency(entity.TotalRepayableAmount - totalPaidAmount);
  }

  private static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

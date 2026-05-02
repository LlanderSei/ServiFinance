namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsDashboardEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsDashboardEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/dashboard", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(httpContext, tenantDomainSlug, dbContext, cancellationToken);
          if (accessResult is not null) {
            return accessResult;
          }

          var finalizedInvoices = await dbContext.Invoices
              .AsNoTracking()
              .Include(entity => entity.Customer)
              .Include(entity => entity.ServiceRequest)
              .Include(entity => entity.MicroLoan)
              .Where(entity => entity.InvoiceStatus == "Finalized")
              .OrderByDescending(entity => entity.InvoiceDateUtc)
              .ToListAsync(cancellationToken);

          var financeQueue = finalizedInvoices
              .Select(entity => new {
                entity.Id,
                entity.ServiceRequestId,
                entity.CustomerId,
                CustomerName = entity.Customer!.FullName,
                RequestNumber = entity.ServiceRequest?.RequestNumber ?? "Standalone finance record",
                entity.InvoiceNumber,
                entity.InvoiceDateUtc,
                entity.OutstandingAmount,
                entity.InterestableAmount,
                HasMicroLoan = entity.MicroLoan != null,
                FinanceHandoffStatus = DeriveFinanceHandoffStatus(
                    entity.ServiceRequest?.CurrentStatus ?? "Invoice finalized",
                    hasInvoice: true,
                    hasMicroLoan: entity.MicroLoan != null,
                    entity.OutstandingAmount,
                    entity.InterestableAmount)
              })
              .ToList();

          var readyFinanceQueue = financeQueue
              .Where(entity => CanConvertToLoan(
                  hasInvoice: true,
                  entity.HasMicroLoan,
                  entity.OutstandingAmount,
                  entity.InterestableAmount))
              .Select(entity => new TenantMlsFinanceQueueRowResponse(
                  entity.Id,
                  entity.ServiceRequestId,
                  entity.CustomerId,
                  entity.CustomerName,
                  entity.RequestNumber,
                  entity.InvoiceNumber,
                  entity.InvoiceDateUtc,
                  entity.OutstandingAmount,
                  entity.InterestableAmount,
                  entity.FinanceHandoffStatus,
                  entity.HasMicroLoan))
              .Take(8)
              .ToArray();

          var recentLoans = await dbContext.MicroLoans
              .AsNoTracking()
              .Include(entity => entity.Customer)
              .Include(entity => entity.Invoice)
              .OrderByDescending(entity => entity.CreatedAtUtc)
              .Take(8)
              .Select(entity => new TenantMlsLoanRowResponse(
                  entity.Id,
                  entity.CustomerId,
                  entity.Customer!.FullName,
                  entity.Invoice != null ? entity.Invoice.InvoiceNumber : "Standalone loan",
                  entity.PrincipalAmount,
                  entity.TotalRepayableAmount,
                  entity.LoanStatus,
                  entity.CreatedAtUtc))
              .ToListAsync(cancellationToken);

          var ledgerEntries = await dbContext.Transactions.CountAsync(cancellationToken);
          var summary = new TenantMlsDashboardSummaryResponse(
              financeQueue.Count(entity => CanConvertToLoan(true, entity.HasMicroLoan, entity.OutstandingAmount, entity.InterestableAmount)),
              finalizedInvoices.Count(entity => entity.MicroLoan != null),
              finalizedInvoices.Count,
              ledgerEntries,
              financeQueue
                  .Where(entity => CanConvertToLoan(true, entity.HasMicroLoan, entity.OutstandingAmount, entity.InterestableAmount))
                  .Sum(entity => entity.OutstandingAmount),
              await dbContext.MicroLoans.SumAsync(entity => entity.PrincipalAmount, cancellationToken));

          var handoffDistribution = financeQueue
              .GroupBy(entity => entity.FinanceHandoffStatus)
              .Select(group => new TenantMlsHandoffDistributionRowResponse(group.Key, group.Count()))
              .OrderByDescending(entity => entity.Count)
              .ThenBy(entity => entity.Label)
              .ToArray();

          return Results.Ok(new TenantMlsDashboardResponse(
              summary,
              readyFinanceQueue,
              recentLoans,
              handoffDistribution));
        });

    return tenantApi;
  }
}

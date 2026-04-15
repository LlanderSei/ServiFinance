namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsAuditEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsAuditEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/audit", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        string? actionType,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var normalizedActionType = string.IsNullOrWhiteSpace(actionType)
            ? null
            : actionType.Trim();

          var loanEvents = await dbContext.MicroLoans
              .AsNoTracking()
              .Include(entity => entity.Customer)
              .Include(entity => entity.Invoice)
              .Include(entity => entity.CreatedByUser)
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

          var paymentEvents = await dbContext.Transactions
              .AsNoTracking()
              .Include(entity => entity.Customer)
              .Include(entity => entity.Invoice)
              .Include(entity => entity.CreatedByUser)
              .Where(entity => entity.TransactionType == "LoanPayment")
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .Take(100)
              .Select(entity => new TenantMlsAuditRowResponse(
                  entity.Id,
                  entity.TransactionDateUtc,
                  "LoanPayment",
                  entity.CreatedByUser != null ? entity.CreatedByUser.FullName : "Unknown operator",
                  entity.Customer != null ? entity.Customer.FullName : "Unknown borrower",
                  entity.Invoice != null ? entity.Invoice.InvoiceNumber : "Standalone loan",
                  entity.ReferenceNumber,
                  entity.Remarks))
              .ToListAsync(cancellationToken);

          var events = loanEvents
              .Concat(paymentEvents)
              .Where(entity => normalizedActionType == null || entity.ActionType.Equals(normalizedActionType, StringComparison.OrdinalIgnoreCase))
              .OrderByDescending(entity => entity.OccurredAtUtc)
              .Take(100)
              .ToArray();

          return Results.Ok(new TenantMlsAuditWorkspaceResponse(
              new TenantMlsAuditSummaryResponse(
                  events.Length,
                  events.Count(entity => entity.ActionType == "LoanCreation"),
                  events.Count(entity => entity.ActionType == "StandaloneLoanCreation"),
                  events.Count(entity => entity.ActionType == "LoanPayment")),
              events));
        });

    return tenantApi;
  }
}

namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsCollectionsEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsCollectionsEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/collections", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        string? state,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var today = DateOnly.FromDateTime(DateTime.UtcNow);
          var weekEnd = today.AddDays(7);
          var normalizedState = string.IsNullOrWhiteSpace(state) ? string.Empty : state.Trim();

          var schedules = await dbContext.AmortizationSchedules
              .AsNoTracking()
              .Include(entity => entity.MicroLoan)
                .ThenInclude(entity => entity!.Customer)
              .Include(entity => entity.MicroLoan)
                .ThenInclude(entity => entity!.Invoice)
              .Where(entity => entity.InstallmentStatus != "Paid")
              .ToListAsync(cancellationToken);

          var entries = schedules
              .Select(entity => CreateCollectionRow(entity, today))
              .Where(entity => normalizedState.Length == 0 || entity.CollectionState.Equals(normalizedState, StringComparison.OrdinalIgnoreCase))
              .OrderByDescending(entity => entity.CollectionState == "Overdue")
              .ThenByDescending(entity => entity.DaysPastDue)
              .ThenBy(entity => entity.DueDate)
              .ThenBy(entity => entity.CustomerName)
              .ToArray();

          var overdueEntries = schedules
              .Select(entity => CreateCollectionRow(entity, today))
              .Where(entity => entity.CollectionState == "Overdue")
              .ToArray();
          var dueTodayEntries = schedules
              .Select(entity => CreateCollectionRow(entity, today))
              .Where(entity => entity.CollectionState == "DueToday")
              .ToArray();
          var dueThisWeekEntries = schedules
              .Select(entity => CreateCollectionRow(entity, today))
              .Where(entity => entity.CollectionState is "DueToday" or "DueThisWeek")
              .ToArray();

          return Results.Ok(new TenantMlsCollectionsWorkspaceResponse(
              new TenantMlsCollectionsSummaryResponse(
                  overdueEntries.Length,
                  dueTodayEntries.Length,
                  dueThisWeekEntries.Length,
                  overdueEntries.Sum(entity => entity.OutstandingAmount),
                  dueThisWeekEntries.Sum(entity => entity.OutstandingAmount)),
              entries));
        });

    return tenantApi;
  }

  private static TenantMlsCollectionRowResponse CreateCollectionRow(AmortizationSchedule entity, DateOnly today) {
    var dueDate = DateOnly.FromDateTime(entity.DueDate);
    var outstandingAmount = RoundCurrency(entity.InstallmentAmount - entity.PaidAmount);
    var daysPastDue = dueDate < today ? today.DayNumber - dueDate.DayNumber : 0;
    var collectionState = dueDate < today
      ? "Overdue"
      : dueDate == today
        ? "DueToday"
        : dueDate <= today.AddDays(7)
          ? "DueThisWeek"
          : "Upcoming";

    return new TenantMlsCollectionRowResponse(
        entity.MicroLoanId,
        entity.MicroLoan!.CustomerId,
        entity.MicroLoan.Customer!.FullName,
        entity.MicroLoan.Invoice != null ? entity.MicroLoan.Invoice.InvoiceNumber : "Standalone loan",
        entity.InstallmentNumber,
        dueDate,
        entity.InstallmentAmount,
        entity.PaidAmount,
        outstandingAmount,
        daysPastDue,
        collectionState,
        entity.MicroLoan.LoanStatus);
  }

  private static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

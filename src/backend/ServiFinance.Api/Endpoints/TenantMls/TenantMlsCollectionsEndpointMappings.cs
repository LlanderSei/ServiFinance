namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
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
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeCollectionsQueue);
          if (accessResult is not null) {
            return accessResult;
          }

          var today = DateOnly.FromDateTime(DateTime.UtcNow);
          var weekEnd = today.AddDays(7);
          var normalizedState = string.IsNullOrWhiteSpace(state) ? string.Empty : state.Trim();
          var lateFeePolicy = await TenantMlsLoanMath.LoadLateFeePolicyAsync(dbContext, cancellationToken);

          var schedules = await dbContext.AmortizationSchedules
              .AsNoTracking()
              .Include(entity => entity.MicroLoan)
                .ThenInclude(entity => entity!.Customer)
              .Include(entity => entity.MicroLoan)
                .ThenInclude(entity => entity!.Invoice)
              .Where(entity => entity.InstallmentStatus != "Paid")
              .Where(entity => entity.MicroLoan != null && entity.MicroLoan.LoanStatus != "Pending Approval" && entity.MicroLoan.LoanStatus != "Rejected")
              .ToListAsync(cancellationToken);

          var allEntries = schedules
              .Select(entity => CreateCollectionRow(entity, today, lateFeePolicy))
              .ToArray();
          var entries = allEntries
              .Where(entity => normalizedState.Length == 0 || entity.CollectionState.Equals(normalizedState, StringComparison.OrdinalIgnoreCase))
              .OrderByDescending(entity => entity.CollectionState == "Overdue")
              .ThenByDescending(entity => entity.DaysPastDue)
              .ThenBy(entity => entity.DueDate)
              .ThenBy(entity => entity.CustomerName)
              .ToArray();
          var overdueEntries = allEntries
              .Where(entity => entity.CollectionState == "Overdue")
              .ToArray();
          var dueTodayEntries = allEntries
              .Where(entity => entity.CollectionState == "DueToday")
              .ToArray();
          var dueThisWeekEntries = allEntries
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
        })
        .RequireTenantMlsPermission("mls.collections.manage", MlsModuleCodeCollectionsQueue);

    return tenantApi;
  }

  private static TenantMlsCollectionRowResponse CreateCollectionRow(
      AmortizationSchedule entity,
      DateOnly today,
      TenantMlsLateFeePolicySnapshot lateFeePolicy) {
    var dueDate = DateOnly.FromDateTime(entity.DueDate);
    var asOfUtc = today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
    var lateFeeAmount = TenantMlsLoanMath.GetEffectiveLateFeeAmount(entity, lateFeePolicy, asOfUtc);
    var outstandingAmount = TenantMlsLoanMath.GetInstallmentOutstandingBalance(entity, lateFeePolicy, asOfUtc);
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
        lateFeeAmount,
        outstandingAmount,
        daysPastDue,
        collectionState,
        entity.MicroLoan.LoanStatus);
  }
}

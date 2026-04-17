namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsReportsEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsReportsEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/reports", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        int? rangeDays,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var normalizedRangeDays = NormalizeRangeDays(rangeDays);
          var todayUtc = DateTime.UtcNow.Date;
          var dateFromUtc = todayUtc.AddDays(-(normalizedRangeDays - 1));
          var dateToUtc = todayUtc.AddDays(1).AddTicks(-1);
          var dateToExclusiveUtc = todayUtc.AddDays(1);

          var activeLoans = await dbContext.MicroLoans
              .AsNoTracking()
              .Include(entity => entity.Customer)
              .Include(entity => entity.AmortizationSchedules)
              .Where(entity => entity.LoanStatus != "Paid")
              .ToListAsync(cancellationToken);

          var outstandingPortfolioBalance = activeLoans
              .Sum(entity => RoundCurrency(entity.TotalRepayableAmount - entity.AmortizationSchedules.Sum(item => item.PaidAmount)));

          var overdueSchedules = await dbContext.AmortizationSchedules
              .AsNoTracking()
              .Include(entity => entity.MicroLoan)
                .ThenInclude(entity => entity!.Customer)
              .Where(entity => entity.InstallmentStatus != "Paid")
              .ToListAsync(cancellationToken);

          var overdueBalance = overdueSchedules
              .Where(entity => entity.DueDate.Date < todayUtc)
              .Sum(entity => RoundCurrency(entity.InstallmentAmount - entity.PaidAmount));

          var rangedTransactions = await dbContext.Transactions
              .AsNoTracking()
              .Where(entity => entity.TransactionDateUtc >= dateFromUtc && entity.TransactionDateUtc < dateToExclusiveUtc)
              .Include(entity => entity.Customer)
              .ToListAsync(cancellationToken);

          var collectionsInWindow = rangedTransactions
              .Where(entity => entity.TransactionType == "LoanPayment")
              .Sum(entity => entity.CreditAmount);
          var paymentCountInWindow = rangedTransactions.Count(entity => entity.TransactionType == "LoanPayment");
          var loanDisbursedInWindow = rangedTransactions
              .Where(entity => entity.TransactionType is "LoanCreation" or "StandaloneLoanCreation")
              .Sum(entity => entity.DebitAmount);

          var agingBuckets = BuildAgingBuckets(overdueSchedules, todayUtc);
          var collectionTrend = BuildCollectionTrend(rangedTransactions, normalizedRangeDays);
          var transactionMix = rangedTransactions
              .GroupBy(entity => entity.TransactionType)
              .Select(group => new TenantMlsReportsTransactionMixRowResponse(
                  group.Key,
                  group.Count(),
                  RoundCurrency(group.Sum(item => item.CreditAmount > 0m ? item.CreditAmount : item.DebitAmount))))
              .OrderByDescending(entity => entity.TotalAmount)
              .ThenBy(entity => entity.TransactionType)
              .ToArray();
          var topBorrowers = activeLoans
              .Select(entity => new TenantMlsReportsBorrowerRowResponse(
                  entity.CustomerId,
                  entity.Customer!.FullName,
                  1,
                  RoundCurrency(entity.TotalRepayableAmount - entity.AmortizationSchedules.Sum(item => item.PaidAmount)),
                  entity.AmortizationSchedules
                      .Where(item => item.InstallmentStatus != "Paid")
                      .OrderBy(item => item.InstallmentNumber)
                      .Select(item => (DateOnly?)DateOnly.FromDateTime(item.DueDate))
                      .FirstOrDefault()))
              .GroupBy(entity => new { entity.CustomerId, entity.CustomerName })
              .Select(group => new TenantMlsReportsBorrowerRowResponse(
                  group.Key.CustomerId,
                  group.Key.CustomerName,
                  group.Sum(item => item.ActiveLoanCount),
                  RoundCurrency(group.Sum(item => item.OutstandingBalance)),
                  group.Where(item => item.NextDueDate.HasValue)
                      .OrderBy(item => item.NextDueDate)
                      .Select(item => item.NextDueDate)
                      .FirstOrDefault()))
              .OrderByDescending(entity => entity.OutstandingBalance)
              .ThenBy(entity => entity.CustomerName)
              .Take(8)
              .ToArray();

          return Results.Ok(new TenantMlsReportsWorkspaceResponse(
              new TenantMlsReportsWindowResponse(
                  normalizedRangeDays,
                  DateTime.SpecifyKind(dateFromUtc, DateTimeKind.Utc),
                  DateTime.SpecifyKind(dateToUtc, DateTimeKind.Utc)),
              new TenantMlsReportsSummaryResponse(
                  activeLoans.Count,
                  RoundCurrency(outstandingPortfolioBalance),
                  RoundCurrency(collectionsInWindow),
                  paymentCountInWindow,
                  RoundCurrency(loanDisbursedInWindow),
                  RoundCurrency(overdueBalance)),
              agingBuckets,
              collectionTrend,
              transactionMix,
              topBorrowers));
        });

    return tenantApi;
  }

  private static int NormalizeRangeDays(int? rangeDays) {
    return rangeDays is 7 or 30 or 90 or 365
      ? rangeDays.Value
      : 30;
  }

  private static TenantMlsReportsAgingBucketRowResponse[] BuildAgingBuckets(
      IReadOnlyList<AmortizationSchedule> schedules,
      DateTime todayUtc) {
    var current = new List<AmortizationSchedule>();
    var oneToThirty = new List<AmortizationSchedule>();
    var thirtyOneToSixty = new List<AmortizationSchedule>();
    var sixtyOnePlus = new List<AmortizationSchedule>();

    foreach (var schedule in schedules) {
      var daysPastDue = (todayUtc - schedule.DueDate.Date).Days;

      if (daysPastDue <= 0) {
        current.Add(schedule);
      } else if (daysPastDue <= 30) {
        oneToThirty.Add(schedule);
      } else if (daysPastDue <= 60) {
        thirtyOneToSixty.Add(schedule);
      } else {
        sixtyOnePlus.Add(schedule);
      }
    }

    return [
      CreateAgingBucket("Current", current),
      CreateAgingBucket("1-30 days", oneToThirty),
      CreateAgingBucket("31-60 days", thirtyOneToSixty),
      CreateAgingBucket("61+ days", sixtyOnePlus)
    ];
  }

  private static TenantMlsReportsAgingBucketRowResponse CreateAgingBucket(
      string label,
      IReadOnlyList<AmortizationSchedule> schedules) {
    return new TenantMlsReportsAgingBucketRowResponse(
        label,
        schedules.Select(entity => entity.MicroLoanId).Distinct().Count(),
        schedules.Count,
        RoundCurrency(schedules.Sum(entity => entity.InstallmentAmount - entity.PaidAmount)));
  }

  private static TenantMlsReportsTrendRowResponse[] BuildCollectionTrend(
      IReadOnlyList<LedgerTransaction> transactions,
      int rangeDays) {
    var paymentRows = transactions
        .Where(entity => entity.TransactionType == "LoanPayment")
        .ToArray();

    if (rangeDays <= 31) {
      return paymentRows
          .GroupBy(entity => entity.TransactionDateUtc.Date)
          .OrderBy(group => group.Key)
          .Select(group => new TenantMlsReportsTrendRowResponse(
              group.Key.ToString("yyyy-MM-dd"),
              RoundCurrency(group.Sum(item => item.CreditAmount)),
              group.Count()))
          .ToArray();
    }

    return paymentRows
        .GroupBy(entity => new DateTime(entity.TransactionDateUtc.Year, entity.TransactionDateUtc.Month, 1))
        .OrderBy(group => group.Key)
        .Select(group => new TenantMlsReportsTrendRowResponse(
            group.Key.ToString("yyyy-MM"),
            RoundCurrency(group.Sum(item => item.CreditAmount)),
            group.Count()))
        .ToArray();
  }

  private static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

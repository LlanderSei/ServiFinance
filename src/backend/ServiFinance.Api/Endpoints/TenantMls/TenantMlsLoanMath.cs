namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;

internal static class TenantMlsLoanMath {
  private const int DefaultLateFeeGracePeriodDays = 3;
  private const decimal DefaultLateFeeFlatAmount = 100m;
  private const decimal DefaultLateFeeRatePercent = 2m;

  public static TenantMlsLoanComputationResult Build(decimal principalAmount, decimal annualInterestRate, int termMonths, DateOnly loanStartDate) {
    var roundedPrincipalAmount = RoundCurrency(principalAmount);
    var monthlyRate = annualInterestRate / 100m / 12m;
    var monthlyInstallment = CalculateMonthlyInstallment(roundedPrincipalAmount, monthlyRate, termMonths);
    var remainingBalance = roundedPrincipalAmount;
    var schedule = new List<TenantMlsAmortizationScheduleRowResponse>(termMonths);
    var totalInterestAmount = 0m;

    for (var installmentNumber = 1; installmentNumber <= termMonths; installmentNumber += 1) {
      var beginningBalance = remainingBalance;
      var interestPortion = monthlyRate == 0m
        ? 0m
        : RoundCurrency(beginningBalance * monthlyRate);
      var principalPortion = installmentNumber == termMonths
        ? beginningBalance
        : RoundCurrency(monthlyInstallment - interestPortion);

      if (principalPortion > beginningBalance) {
        principalPortion = beginningBalance;
      }

      var installmentAmount = installmentNumber == termMonths
        ? RoundCurrency(principalPortion + interestPortion)
        : monthlyInstallment;
      var endingBalance = installmentNumber == termMonths
        ? 0m
        : RoundCurrency(beginningBalance - principalPortion);

      totalInterestAmount += interestPortion;
      remainingBalance = endingBalance;

      schedule.Add(new TenantMlsAmortizationScheduleRowResponse(
          installmentNumber,
          loanStartDate.AddMonths(installmentNumber),
          beginningBalance,
          principalPortion,
          interestPortion,
          installmentAmount,
          endingBalance));
    }

    var summary = new TenantMlsLoanConversionSummaryResponse(
        roundedPrincipalAmount,
        RoundCurrency(annualInterestRate),
        termMonths,
        monthlyInstallment,
        RoundCurrency(totalInterestAmount),
        RoundCurrency(roundedPrincipalAmount + totalInterestAmount),
        loanStartDate,
        schedule[^1].DueDate);

    return new TenantMlsLoanComputationResult(summary, schedule);
  }

  public static async Task<TenantMlsLateFeePolicySnapshot> LoadLateFeePolicyAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var policy = await dbContext.TenantCostingPolicies
        .AsNoTracking()
        .SingleOrDefaultAsync(cancellationToken);

    return CreateLateFeePolicy(policy);
  }

  public static TenantMlsLateFeePolicySnapshot CreateLateFeePolicy(TenantCostingPolicy? policy) =>
    new(
        policy?.LoanLateFeeEnabled ?? true,
        Math.Max(0, policy?.LoanLateFeeGracePeriodDays ?? DefaultLateFeeGracePeriodDays),
        RoundCurrency(Math.Max(0m, policy?.LoanLateFeeFlatAmount ?? DefaultLateFeeFlatAmount)),
        RoundCurrency(Math.Max(0m, policy?.LoanLateFeeRatePercent ?? DefaultLateFeeRatePercent)));

  public static bool EnsureLateFeesApplied(
      IEnumerable<AmortizationSchedule> schedules,
      TenantMlsLateFeePolicySnapshot lateFeePolicy,
      DateTime asOfUtc) {
    var normalizedAsOfUtc = DateTime.SpecifyKind(asOfUtc, DateTimeKind.Utc);
    var changesApplied = false;

    foreach (var schedule in schedules) {
      if (!ShouldApplyLateFee(schedule, lateFeePolicy, normalizedAsOfUtc)) {
        continue;
      }

      var lateFeeAmount = CalculateLateFeeAmount(schedule, lateFeePolicy);
      if (lateFeeAmount <= 0m) {
        continue;
      }

      schedule.LateFeeAmount = lateFeeAmount;
      schedule.LateFeeAppliedAtUtc = normalizedAsOfUtc;
      changesApplied = true;
    }

    return changesApplied;
  }

  public static decimal GetInstallmentOutstandingBalance(
      AmortizationSchedule schedule,
      TenantMlsLateFeePolicySnapshot lateFeePolicy,
      DateTime asOfUtc) =>
    RoundCurrency(Math.Max(0m, schedule.InstallmentAmount + GetEffectiveLateFeeAmount(schedule, lateFeePolicy, asOfUtc) - schedule.PaidAmount));

  public static decimal GetOutstandingBalance(
      MicroLoan loan,
      TenantMlsLateFeePolicySnapshot lateFeePolicy,
      DateTime asOfUtc) =>
    RoundCurrency(loan.AmortizationSchedules.Sum(schedule => GetInstallmentOutstandingBalance(schedule, lateFeePolicy, asOfUtc)));

  public static int GetPendingInstallmentCount(
      MicroLoan loan,
      TenantMlsLateFeePolicySnapshot lateFeePolicy,
      DateTime asOfUtc) =>
    loan.AmortizationSchedules.Count(schedule => GetInstallmentOutstandingBalance(schedule, lateFeePolicy, asOfUtc) > 0m);

  public static decimal GetEffectiveLateFeeAmount(
      AmortizationSchedule schedule,
      TenantMlsLateFeePolicySnapshot lateFeePolicy,
      DateTime asOfUtc) {
    if (schedule.LateFeeAmount > 0m) {
      return RoundCurrency(schedule.LateFeeAmount);
    }

    return ShouldApplyLateFee(schedule, lateFeePolicy, asOfUtc)
      ? CalculateLateFeeAmount(schedule, lateFeePolicy)
      : 0m;
  }

  public static void RefreshInstallmentStatus(
      AmortizationSchedule schedule,
      TenantMlsLateFeePolicySnapshot lateFeePolicy,
      DateTime asOfUtc) {
    var outstandingBalance = GetInstallmentOutstandingBalance(schedule, lateFeePolicy, asOfUtc);
    schedule.InstallmentStatus = outstandingBalance <= 0m
      ? "Paid"
      : schedule.PaidAmount > 0m
        ? "Partially Paid"
        : "Pending";
  }

  public static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);

  private static bool ShouldApplyLateFee(
      AmortizationSchedule schedule,
      TenantMlsLateFeePolicySnapshot lateFeePolicy,
      DateTime asOfUtc) {
    if (!lateFeePolicy.IsEnabled) {
      return false;
    }

    if (schedule.LateFeeAmount > 0m || schedule.LateFeeAppliedAtUtc.HasValue) {
      return false;
    }

    if (GetBaseOutstandingBalance(schedule) <= 0m) {
      return false;
    }

    return asOfUtc.Date > schedule.DueDate.Date.AddDays(lateFeePolicy.GracePeriodDays);
  }

  private static decimal CalculateLateFeeAmount(
      AmortizationSchedule schedule,
      TenantMlsLateFeePolicySnapshot lateFeePolicy) {
    var baseOutstandingBalance = GetBaseOutstandingBalance(schedule);
    if (baseOutstandingBalance <= 0m) {
      return 0m;
    }

    var rateAmount = lateFeePolicy.RatePercent <= 0m
      ? 0m
      : RoundCurrency(baseOutstandingBalance * lateFeePolicy.RatePercent / 100m);

    return RoundCurrency(lateFeePolicy.FlatAmount + rateAmount);
  }

  private static decimal GetBaseOutstandingBalance(AmortizationSchedule schedule) =>
    RoundCurrency(Math.Max(0m, schedule.InstallmentAmount - schedule.PaidAmount));

  private static decimal CalculateMonthlyInstallment(decimal principalAmount, decimal monthlyRate, int termMonths) {
    if (monthlyRate == 0m) {
      return RoundCurrency(principalAmount / termMonths);
    }

    var numerator = (double)(principalAmount * monthlyRate);
    var denominator = 1d - Math.Pow(1d + (double)monthlyRate, -termMonths);
    return RoundCurrency((decimal)(numerator / denominator));
  }
}

internal sealed record TenantMlsLoanComputationResult(
    TenantMlsLoanConversionSummaryResponse Summary,
    IReadOnlyList<TenantMlsAmortizationScheduleRowResponse> Schedule);

internal readonly record struct TenantMlsLateFeePolicySnapshot(
    bool IsEnabled,
    int GracePeriodDays,
    decimal FlatAmount,
    decimal RatePercent);

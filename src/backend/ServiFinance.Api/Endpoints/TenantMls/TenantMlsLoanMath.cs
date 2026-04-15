namespace ServiFinance.Api.Endpoints.TenantMls;

using ServiFinance.Api.Contracts;

internal static class TenantMlsLoanMath {
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

  public static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);

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

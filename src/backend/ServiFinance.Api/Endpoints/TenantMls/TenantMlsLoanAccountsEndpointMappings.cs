namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsLoanAccountsEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsLoanAccountsEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/loans", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeFinancialRecords);
          if (accessResult is not null) {
            return accessResult;
          }

          var loans = await dbContext.MicroLoans
              .AsNoTracking()
              .Include(entity => entity.Customer)
              .Include(entity => entity.Invoice)
              .Include(entity => entity.AmortizationSchedules)
              .OrderByDescending(entity => entity.CreatedAtUtc)
              .Select(entity => CreateLoanAccountRow(entity))
              .ToListAsync(cancellationToken);

          return Results.Ok(new TenantMlsLoanAccountsWorkspaceResponse(loans));
        });

    tenantApi.MapGet("/mls/loans/{loanId:guid}", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid loanId,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeFinancialRecords);
          if (accessResult is not null) {
            return accessResult;
          }

          var loan = await dbContext.MicroLoans
              .AsNoTracking()
              .Include(entity => entity.Customer)
              .Include(entity => entity.Invoice)
              .Include(entity => entity.AmortizationSchedules)
              .Include(entity => entity.Transactions)
              .FirstOrDefaultAsync(entity => entity.Id == loanId, cancellationToken);
          if (loan is null) {
            return Results.NotFound(new { error = "The selected loan account was not found." });
          }

          var schedule = loan.AmortizationSchedules
              .OrderBy(entity => entity.InstallmentNumber)
              .Select(entity => new TenantMlsAmortizationScheduleRowResponse(
                  entity.InstallmentNumber,
                  DateOnly.FromDateTime(entity.DueDate),
                  entity.BeginningBalance,
                  entity.PrincipalPortion,
                  entity.InterestPortion,
                  entity.InstallmentAmount,
                  entity.EndingBalance))
              .ToArray();

          var reversiblePaymentTransactionId = GetLatestReversiblePaymentTransactionId(loan.Transactions);
          var ledger = loan.Transactions
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Take(20)
              .Select(entity => CreateLoanLedgerRow(entity, reversiblePaymentTransactionId))
              .ToArray();

          return Results.Ok(new TenantMlsLoanDetailResponse(
              CreateLoanAccountRow(loan),
              schedule,
              ledger));
        });

    tenantApi.MapPost("/mls/loans/{loanId:guid}/payments", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid loanId,
        [FromBody] PostTenantMlsLoanPaymentRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeFinancialRecords);
          if (accessResult is not null) {
            return accessResult;
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          if (request.Amount <= 0m) {
            return Results.BadRequest(new { error = "Payment amount must be greater than zero." });
          }

          var loan = await dbContext.MicroLoans
              .Include(entity => entity.Customer)
              .Include(entity => entity.Invoice)
              .Include(entity => entity.AmortizationSchedules)
              .FirstOrDefaultAsync(entity => entity.Id == loanId, cancellationToken);
          if (loan is null) {
            return Results.NotFound(new { error = "The selected loan account was not found." });
          }

          var orderedSchedules = loan.AmortizationSchedules
              .OrderBy(entity => entity.InstallmentNumber)
              .ToList();
          var totalPaidBefore = orderedSchedules.Sum(entity => entity.PaidAmount);
          var outstandingBefore = RoundCurrency(loan.TotalRepayableAmount - totalPaidBefore);
          if (outstandingBefore <= 0m) {
            return Results.BadRequest(new { error = "This loan is already fully settled." });
          }

          var payableInstallments = orderedSchedules
              .Where(entity =>
                  entity.InstallmentStatus != "Paid" &&
                  RoundCurrency(entity.InstallmentAmount - entity.PaidAmount) > 0m)
              .ToList();
          if (payableInstallments.Count == 0) {
            return Results.BadRequest(new { error = "This loan has no payable installments remaining." });
          }

          var startingInstallment = payableInstallments[0];
          if (request.ExpectedStartingInstallmentNumber.HasValue &&
              request.ExpectedStartingInstallmentNumber.Value != startingInstallment.InstallmentNumber) {
            return Results.BadRequest(new {
              error = $"Payments for this loan must start with installment #{startingInstallment.InstallmentNumber}. Refresh the collections queue and try again."
            });
          }

          var amountToApply = Math.Min(RoundCurrency(request.Amount), outstandingBefore);
          var remainingAmount = amountToApply;
          var loanLabel = loan.Invoice?.InvoiceNumber ?? "standalone loan";

          foreach (var installment in payableInstallments) {
            if (remainingAmount <= 0m) {
              break;
            }

            var installmentOutstanding = RoundCurrency(installment.InstallmentAmount - installment.PaidAmount);
            if (installmentOutstanding <= 0m) {
              installment.InstallmentStatus = "Paid";
              continue;
            }

            var appliedAmount = Math.Min(remainingAmount, installmentOutstanding);
            installment.PaidAmount = RoundCurrency(installment.PaidAmount + appliedAmount);
            remainingAmount = RoundCurrency(remainingAmount - appliedAmount);
            UpdateInstallmentStatus(installment);
          }

          var totalPaidAfter = orderedSchedules.Sum(entity => entity.PaidAmount);
          var outstandingAfter = RoundCurrency(loan.TotalRepayableAmount - totalPaidAfter);
          loan.LoanStatus = outstandingAfter <= 0m
            ? "Paid"
            : "Active";

          var previousRunningBalance = await dbContext.Transactions
              .Where(entity => entity.CustomerId == loan.CustomerId)
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Select(entity => entity.RunningBalance)
              .FirstOrDefaultAsync(cancellationToken);

          dbContext.Transactions.Add(new LedgerTransaction {
            Id = Guid.NewGuid(),
            CustomerId = loan.CustomerId,
            InvoiceId = loan.InvoiceId,
            MicroLoanId = loan.Id,
            AmortizationScheduleId = startingInstallment.Id,
            TransactionDateUtc = request.PaymentDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            TransactionType = "LoanPayment",
            ReferenceNumber = string.IsNullOrWhiteSpace(request.ReferenceNumber)
              ? GenerateReferenceCode("MLS-PMT")
              : request.ReferenceNumber.Trim(),
            DebitAmount = 0m,
            CreditAmount = amountToApply,
            RunningBalance = RoundCurrency(previousRunningBalance - amountToApply),
            Remarks = string.IsNullOrWhiteSpace(request.Remarks)
              ? $"Payment posted for loan {loanLabel}"
              : request.Remarks.Trim(),
            CreatedByUserId = currentUserId
          });

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new TenantMlsLoanPaymentPostedResponse(
              loan.Id,
              amountToApply,
              outstandingAfter,
              orderedSchedules.Count(entity => entity.InstallmentStatus != "Paid"),
              loan.LoanStatus));
        });

    tenantApi.MapPost("/mls/loans/{loanId:guid}/payments/{transactionId:guid}/reverse", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid loanId,
        Guid transactionId,
        [FromBody] PostTenantMlsLoanPaymentReversalRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeFinancialRecords);
          if (accessResult is not null) {
            return accessResult;
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          if (string.IsNullOrWhiteSpace(request.Remarks)) {
            return Results.BadRequest(new { error = "Reversal remarks are required so the correction is auditable." });
          }

          var loan = await dbContext.MicroLoans
              .Include(entity => entity.Customer)
              .Include(entity => entity.Invoice)
              .Include(entity => entity.AmortizationSchedules)
              .Include(entity => entity.Transactions)
              .FirstOrDefaultAsync(entity => entity.Id == loanId, cancellationToken);
          if (loan is null) {
            return Results.NotFound(new { error = "The selected loan account was not found." });
          }

          var transaction = loan.Transactions.FirstOrDefault(entity => entity.Id == transactionId);
          if (transaction is null || transaction.TransactionType != "LoanPayment") {
            return Results.NotFound(new { error = "The selected payment entry could not be reversed." });
          }

          if (transaction.CreditAmount <= 0m) {
            return Results.BadRequest(new { error = "Only payment ledger rows with posted collection amounts can be reversed." });
          }

          if (request.ReversalDate < DateOnly.FromDateTime(transaction.TransactionDateUtc)) {
            return Results.BadRequest(new { error = "Reversal date cannot be earlier than the original payment date." });
          }

          if (loan.Transactions.Any(entity => entity.ReversalOfTransactionId == transaction.Id)) {
            return Results.BadRequest(new { error = "This payment was already reversed." });
          }

          var latestReversiblePaymentTransactionId = GetLatestReversiblePaymentTransactionId(loan.Transactions);
          if (latestReversiblePaymentTransactionId != transaction.Id) {
            return Results.BadRequest(new {
              error = "Only the most recent unreversed loan payment can be reversed. Reverse newer payments first."
            });
          }

          var orderedSchedules = loan.AmortizationSchedules
              .OrderBy(entity => entity.InstallmentNumber)
              .ToList();
          var amountToReverse = RoundCurrency(transaction.CreditAmount);
          if (!TryReversePaymentAcrossSchedules(orderedSchedules, amountToReverse)) {
            return Results.BadRequest(new {
              error = "The selected payment could not be reversed because the amortization schedule no longer matches the posted collection history."
            });
          }

          var totalPaidAfter = orderedSchedules.Sum(entity => entity.PaidAmount);
          var outstandingAfter = RoundCurrency(loan.TotalRepayableAmount - totalPaidAfter);
          loan.LoanStatus = outstandingAfter <= 0m
            ? "Paid"
            : "Active";

          var previousRunningBalance = await dbContext.Transactions
              .Where(entity => entity.CustomerId == loan.CustomerId)
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Select(entity => entity.RunningBalance)
              .FirstOrDefaultAsync(cancellationToken);

          var reversalTransaction = new LedgerTransaction {
            Id = Guid.NewGuid(),
            CustomerId = loan.CustomerId,
            InvoiceId = loan.InvoiceId,
            MicroLoanId = loan.Id,
            AmortizationScheduleId = transaction.AmortizationScheduleId,
            ReversalOfTransactionId = transaction.Id,
            TransactionDateUtc = request.ReversalDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            TransactionType = "LoanPaymentReversal",
            ReferenceNumber = string.IsNullOrWhiteSpace(request.ReferenceNumber)
              ? GenerateReferenceCode("MLS-RVS")
              : request.ReferenceNumber.Trim(),
            DebitAmount = amountToReverse,
            CreditAmount = 0m,
            RunningBalance = RoundCurrency(previousRunningBalance + amountToReverse),
            Remarks = request.Remarks.Trim(),
            CreatedByUserId = currentUserId
          };

          dbContext.Transactions.Add(reversalTransaction);
          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new TenantMlsLoanPaymentReversedResponse(
              loan.Id,
              reversalTransaction.Id,
              amountToReverse,
              outstandingAfter,
              orderedSchedules.Count(entity => entity.InstallmentStatus != "Paid"),
              loan.LoanStatus));
        });

    return tenantApi;
  }

  private static TenantMlsLoanLedgerRowResponse CreateLoanLedgerRow(
      LedgerTransaction entity,
      Guid? reversiblePaymentTransactionId) {
    return new TenantMlsLoanLedgerRowResponse(
        entity.Id,
        entity.TransactionDateUtc,
        entity.TransactionType,
        entity.ReferenceNumber,
        entity.DebitAmount,
        entity.CreditAmount,
        entity.RunningBalance,
        entity.Remarks,
        reversiblePaymentTransactionId == entity.Id);
  }

  private static Guid? GetLatestReversiblePaymentTransactionId(IEnumerable<LedgerTransaction> transactions) {
    var reversedTransactionIds = transactions
        .Where(entity => entity.TransactionType == "LoanPaymentReversal" && entity.ReversalOfTransactionId.HasValue)
        .Select(entity => entity.ReversalOfTransactionId!.Value)
        .ToHashSet();

    return transactions
        .Where(entity => entity.TransactionType == "LoanPayment" && !reversedTransactionIds.Contains(entity.Id))
        .OrderByDescending(entity => entity.TransactionDateUtc)
        .ThenByDescending(entity => entity.Id)
        .Select(entity => (Guid?)entity.Id)
        .FirstOrDefault();
  }

  private static bool TryReversePaymentAcrossSchedules(
      IReadOnlyList<AmortizationSchedule> orderedSchedules,
      decimal amountToReverse) {
    var remainingAmount = amountToReverse;

    foreach (var installment in orderedSchedules.OrderByDescending(entity => entity.InstallmentNumber)) {
      if (remainingAmount <= 0m) {
        break;
      }

      if (installment.PaidAmount <= 0m) {
        UpdateInstallmentStatus(installment);
        continue;
      }

      var reversedAmount = Math.Min(installment.PaidAmount, remainingAmount);
      installment.PaidAmount = RoundCurrency(installment.PaidAmount - reversedAmount);
      remainingAmount = RoundCurrency(remainingAmount - reversedAmount);
      UpdateInstallmentStatus(installment);
    }

    return remainingAmount == 0m;
  }

  private static void UpdateInstallmentStatus(AmortizationSchedule installment) {
    installment.InstallmentStatus = installment.PaidAmount >= installment.InstallmentAmount
      ? "Paid"
      : installment.PaidAmount > 0m
        ? "Partially Paid"
        : "Pending";
  }

  private static TenantMlsLoanAccountRowResponse CreateLoanAccountRow(MicroLoan entity) {
    var totalPaidAmount = entity.AmortizationSchedules.Sum(item => item.PaidAmount);
    var outstandingBalance = RoundCurrency(entity.TotalRepayableAmount - totalPaidAmount);
    var nextDueDate = entity.AmortizationSchedules
        .Where(item => item.InstallmentStatus != "Paid")
        .OrderBy(item => item.InstallmentNumber)
        .Select(item => DateOnly.FromDateTime(item.DueDate))
        .FirstOrDefault();

    return new TenantMlsLoanAccountRowResponse(
        entity.Id,
        entity.CustomerId,
        entity.Customer!.FullName,
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

  private static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

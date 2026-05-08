namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auditing;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsLoanAccountsEndpointMappings {
  private const int LedgerReferenceNumberMaxLength = 100;
  private const int LedgerRemarksMaxLength = 1000;

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
        })
        .RequireTenantMlsPermission("mls.loan-accounts.view", MlsModuleCodeFinancialRecords);

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
              MlsModuleCodeAmortization);
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
        })
        .RequireTenantMlsPermission("mls.loan-accounts.view", MlsModuleCodeFinancialRecords);

    tenantApi.MapPost("/mls/loans/{loanId:guid}/payments", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid loanId,
        [FromBody] PostTenantMlsLoanPaymentRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuditLogService auditLogService,
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

          if (request.PaymentDate > DateOnly.FromDateTime(DateTime.UtcNow)) {
            return Results.BadRequest(new { error = "Payment date cannot be in the future." });
          }

          var referenceNumber = NormalizeOptionalText(request.ReferenceNumber);
          if ((referenceNumber?.Length ?? 0) > LedgerReferenceNumberMaxLength) {
            return Results.BadRequest(new { error = $"Reference number must be {LedgerReferenceNumberMaxLength} characters or fewer." });
          }

          var remarks = NormalizeOptionalText(request.Remarks);
          if ((remarks?.Length ?? 0) > LedgerRemarksMaxLength) {
            return Results.BadRequest(new { error = $"Payment remarks must be {LedgerRemarksMaxLength} characters or fewer." });
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

          var requestedAmount = RoundCurrency(request.Amount);
          if (requestedAmount > outstandingBefore) {
            return Results.BadRequest(new { error = "Payment amount cannot exceed the current outstanding loan balance." });
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

          if (await HasDuplicatePaymentAsync(
              dbContext,
              loan.Id,
              currentUserId,
              request.PaymentDate,
              requestedAmount,
              referenceNumber,
              cancellationToken)) {
            return Results.Conflict(new { error = "A matching payment was already posted for this loan on the selected date. Add a unique reference number if this is a separate collection." });
          }

          var latestLedgerCursor = await LoadLatestLedgerCursorAsync(dbContext, loan.CustomerId, cancellationToken);
          if (latestLedgerCursor is not null && request.PaymentDate < DateOnly.FromDateTime(latestLedgerCursor.TransactionDateUtc)) {
            return Results.BadRequest(new { error = "Payment date cannot be earlier than the latest customer ledger transaction date." });
          }

          var amountToApply = requestedAmount;
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

          var paymentTransaction = new LedgerTransaction {
            Id = Guid.NewGuid(),
            CustomerId = loan.CustomerId,
            InvoiceId = loan.InvoiceId,
            MicroLoanId = loan.Id,
            AmortizationScheduleId = startingInstallment.Id,
            TransactionDateUtc = CreateLedgerTimestamp(request.PaymentDate, latestLedgerCursor?.TransactionDateUtc),
            TransactionType = "LoanPayment",
            ReferenceNumber = referenceNumber is null
              ? GenerateReferenceCode("MLS-PMT")
              : referenceNumber,
            DebitAmount = 0m,
            CreditAmount = amountToApply,
            RunningBalance = RoundCurrency((latestLedgerCursor?.RunningBalance ?? 0m) - amountToApply),
            Remarks = remarks is null
              ? $"Payment posted for loan {loanLabel}"
              : remarks,
            CreatedByUserId = currentUserId
          };

          dbContext.Transactions.Add(paymentTransaction);

          await dbContext.SaveChangesAsync(cancellationToken);
          await TenantMlsAuditLogging.WriteSystemAuditAsync(
              auditLogService,
              httpContext,
              loan.TenantId,
              "LoanPayment",
              "Posted",
              "LedgerTransaction",
              paymentTransaction.Id,
              paymentTransaction.ReferenceNumber,
              $"Posted {amountToApply:F2} against {loanLabel} for {loan.Customer!.FullName}.");

          return Results.Ok(new TenantMlsLoanPaymentPostedResponse(
              loan.Id,
              amountToApply,
              outstandingAfter,
              orderedSchedules.Count(entity => entity.InstallmentStatus != "Paid"),
              loan.LoanStatus));
        })
        .RequireTenantMlsPermission("mls.loan-accounts.manage", MlsModuleCodeAmortization);

    tenantApi.MapPost("/mls/loans/{loanId:guid}/payments/{transactionId:guid}/reverse", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid loanId,
        Guid transactionId,
        [FromBody] PostTenantMlsLoanPaymentReversalRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        IAuditLogService auditLogService,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeAmortization);
          if (accessResult is not null) {
            return accessResult;
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          if (string.IsNullOrWhiteSpace(request.Remarks)) {
            return Results.BadRequest(new { error = "Reversal remarks are required so the correction is auditable." });
          }

          if (request.ReversalDate > DateOnly.FromDateTime(DateTime.UtcNow)) {
            return Results.BadRequest(new { error = "Reversal date cannot be in the future." });
          }

          var reversalReferenceNumber = NormalizeOptionalText(request.ReferenceNumber);
          if ((reversalReferenceNumber?.Length ?? 0) > LedgerReferenceNumberMaxLength) {
            return Results.BadRequest(new { error = $"Reference number must be {LedgerReferenceNumberMaxLength} characters or fewer." });
          }

          var reversalRemarks = request.Remarks.Trim();
          if (reversalRemarks.Length > LedgerRemarksMaxLength) {
            return Results.BadRequest(new { error = $"Reversal remarks must be {LedgerRemarksMaxLength} characters or fewer." });
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
          var loanLabel = loan.Invoice?.InvoiceNumber ?? "standalone loan";
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

          var latestLedgerCursor = await LoadLatestLedgerCursorAsync(dbContext, loan.CustomerId, cancellationToken);
          if (latestLedgerCursor is not null && request.ReversalDate < DateOnly.FromDateTime(latestLedgerCursor.TransactionDateUtc)) {
            return Results.BadRequest(new { error = "Reversal date cannot be earlier than the latest customer ledger transaction date." });
          }

          var reversalTransaction = new LedgerTransaction {
            Id = Guid.NewGuid(),
            CustomerId = loan.CustomerId,
            InvoiceId = loan.InvoiceId,
            MicroLoanId = loan.Id,
            AmortizationScheduleId = transaction.AmortizationScheduleId,
            ReversalOfTransactionId = transaction.Id,
            TransactionDateUtc = CreateLedgerTimestamp(request.ReversalDate, latestLedgerCursor?.TransactionDateUtc),
            TransactionType = "LoanPaymentReversal",
            ReferenceNumber = reversalReferenceNumber is null
              ? GenerateReferenceCode("MLS-RVS")
              : reversalReferenceNumber,
            DebitAmount = amountToReverse,
            CreditAmount = 0m,
            RunningBalance = RoundCurrency((latestLedgerCursor?.RunningBalance ?? 0m) + amountToReverse),
            Remarks = reversalRemarks,
            CreatedByUserId = currentUserId
          };

          dbContext.Transactions.Add(reversalTransaction);
          await dbContext.SaveChangesAsync(cancellationToken);
          await TenantMlsAuditLogging.WriteSystemAuditAsync(
              auditLogService,
              httpContext,
              loan.TenantId,
              "LoanPaymentReversal",
              "Reversed",
              "LedgerTransaction",
              reversalTransaction.Id,
              reversalTransaction.ReferenceNumber,
              $"Reversed {amountToReverse:F2} on {loanLabel} for {loan.Customer!.FullName}. Original payment reference: {transaction.ReferenceNumber}.");

          return Results.Ok(new TenantMlsLoanPaymentReversedResponse(
              loan.Id,
              reversalTransaction.Id,
              amountToReverse,
              outstandingAfter,
              orderedSchedules.Count(entity => entity.InstallmentStatus != "Paid"),
              loan.LoanStatus));
        })
        .RequireTenantMlsPermission("mls.loan-accounts.manage", MlsModuleCodeAmortization);

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

  private static async Task<LedgerCursor?> LoadLatestLedgerCursorAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Guid customerId,
      CancellationToken cancellationToken) =>
    await dbContext.Transactions
        .AsNoTracking()
        .Where(entity => entity.CustomerId == customerId)
        .OrderByDescending(entity => entity.TransactionDateUtc)
        .ThenByDescending(entity => entity.Id)
        .Select(entity => new LedgerCursor(entity.TransactionDateUtc, entity.RunningBalance))
        .FirstOrDefaultAsync(cancellationToken);

  private static async Task<bool> HasDuplicatePaymentAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Guid loanId,
      Guid createdByUserId,
      DateOnly paymentDate,
      decimal amount,
      string? referenceNumber,
      CancellationToken cancellationToken) {
    var dateFromUtc = paymentDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
    var dateToUtc = dateFromUtc.AddDays(1);
    var query = dbContext.Transactions
        .AsNoTracking()
        .Where(entity =>
            entity.MicroLoanId == loanId &&
            entity.CreatedByUserId == createdByUserId &&
            entity.TransactionType == "LoanPayment" &&
            entity.CreditAmount == amount &&
            entity.TransactionDateUtc >= dateFromUtc &&
            entity.TransactionDateUtc < dateToUtc);

    query = referenceNumber is null
      ? query.Where(entity => !dbContext.Transactions.Any(reversal => reversal.ReversalOfTransactionId == entity.Id))
      : query.Where(entity => entity.ReferenceNumber == referenceNumber);

    return await query.AnyAsync(cancellationToken);
  }

  private static DateTime CreateLedgerTimestamp(DateOnly selectedDate, DateTime? latestLedgerTimestampUtc) {
    var timestamp = selectedDate.ToDateTime(TimeOnly.FromDateTime(DateTime.UtcNow), DateTimeKind.Utc);
    if (latestLedgerTimestampUtc.HasValue &&
        DateOnly.FromDateTime(latestLedgerTimestampUtc.Value) == selectedDate &&
        timestamp <= latestLedgerTimestampUtc.Value) {
      return latestLedgerTimestampUtc.Value.AddTicks(1);
    }

    return timestamp;
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

  private static string? NormalizeOptionalText(string? value) {
    var normalized = value?.Trim();
    return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
  }

  private sealed record LedgerCursor(DateTime TransactionDateUtc, decimal RunningBalance);
}

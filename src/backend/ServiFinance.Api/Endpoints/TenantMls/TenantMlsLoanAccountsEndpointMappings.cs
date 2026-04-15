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
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
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
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
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

          var ledger = loan.Transactions
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Take(20)
              .Select(entity => new TenantMlsLoanLedgerRowResponse(
                  entity.Id,
                  entity.TransactionDateUtc,
                  entity.TransactionType,
                  entity.ReferenceNumber,
                  entity.DebitAmount,
                  entity.CreditAmount,
                  entity.RunningBalance,
                  entity.Remarks))
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
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
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

          var amountToApply = Math.Min(RoundCurrency(request.Amount), outstandingBefore);
          var remainingAmount = amountToApply;

          foreach (var installment in orderedSchedules.Where(entity => entity.InstallmentStatus != "Paid")) {
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

            installment.InstallmentStatus = installment.PaidAmount >= installment.InstallmentAmount
              ? "Paid"
              : installment.PaidAmount > 0m
                ? "Partially Paid"
                : "Pending";
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
            TransactionDateUtc = request.PaymentDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            TransactionType = "LoanPayment",
            ReferenceNumber = string.IsNullOrWhiteSpace(request.ReferenceNumber)
              ? GenerateReferenceCode("MLS-PMT")
              : request.ReferenceNumber.Trim(),
            DebitAmount = 0m,
            CreditAmount = amountToApply,
            RunningBalance = RoundCurrency(previousRunningBalance - amountToApply),
            Remarks = string.IsNullOrWhiteSpace(request.Remarks)
              ? $"Payment posted for loan {loan.Invoice!.InvoiceNumber}"
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

    return tenantApi;
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

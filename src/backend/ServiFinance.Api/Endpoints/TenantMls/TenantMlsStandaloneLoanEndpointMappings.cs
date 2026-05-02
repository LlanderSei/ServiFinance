namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsStandaloneLoanEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsStandaloneLoanEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/standalone-loans", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeStandaloneLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          var customers = await dbContext.Customers
              .AsNoTracking()
              .OrderBy(entity => entity.FullName)
              .Select(entity => new TenantMlsStandaloneLoanCustomerResponse(
                  entity.Id,
                  entity.CustomerCode,
                  entity.FullName))
              .ToListAsync(cancellationToken);

          return Results.Ok(new TenantMlsStandaloneLoanWorkspaceResponse(customers));
        });

    tenantApi.MapGet("/mls/standalone-loans/preview", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid customerId,
        decimal principalAmount,
        decimal annualInterestRate,
        int termMonths,
        DateOnly loanStartDate,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeStandaloneLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          var customer = await dbContext.Customers
              .AsNoTracking()
              .FirstOrDefaultAsync(entity => entity.Id == customerId, cancellationToken);
          if (customer is null) {
            return Results.NotFound(new { error = "The selected customer was not found for standalone loan processing." });
          }

          var validationError = ValidateStandaloneLoanTerms(principalAmount, annualInterestRate, termMonths);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var computation = TenantMlsLoanMath.Build(principalAmount, annualInterestRate, termMonths, loanStartDate);
          return Results.Ok(new TenantMlsStandaloneLoanPreviewResponse(
              new TenantMlsStandaloneLoanCustomerResponse(customer.Id, customer.CustomerCode, customer.FullName),
              computation.Summary,
              computation.Schedule));
        });

    tenantApi.MapPost("/mls/standalone-loans", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] CreateTenantMlsStandaloneLoanRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeStandaloneLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var validationError = ValidateStandaloneLoanTerms(request.PrincipalAmount, request.AnnualInterestRate, request.TermMonths);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var customer = await dbContext.Customers
              .FirstOrDefaultAsync(entity => entity.Id == request.CustomerId, cancellationToken);
          if (customer is null) {
            return Results.NotFound(new { error = "The selected customer was not found for standalone loan processing." });
          }

          var computation = TenantMlsLoanMath.Build(request.PrincipalAmount, request.AnnualInterestRate, request.TermMonths, request.LoanStartDate);
          var runningBalance = await dbContext.Transactions
              .Where(entity => entity.CustomerId == customer.Id)
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Select(entity => entity.RunningBalance)
              .FirstOrDefaultAsync(cancellationToken);

          var microLoanId = Guid.NewGuid();
          dbContext.MicroLoans.Add(new MicroLoan {
            Id = microLoanId,
            InvoiceId = null,
            CustomerId = customer.Id,
            PrincipalAmount = computation.Summary.PrincipalAmount,
            AnnualInterestRate = computation.Summary.AnnualInterestRate,
            TermMonths = computation.Summary.TermMonths,
            MonthlyInstallment = computation.Summary.MonthlyInstallment,
            TotalInterestAmount = computation.Summary.TotalInterestAmount,
            TotalRepayableAmount = computation.Summary.TotalRepayableAmount,
            LoanStartDate = computation.Summary.LoanStartDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            MaturityDate = computation.Summary.MaturityDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            LoanStatus = "Active",
            CreatedByUserId = currentUserId,
            CreatedAtUtc = DateTime.UtcNow
          });

          foreach (var row in computation.Schedule) {
            dbContext.AmortizationSchedules.Add(new AmortizationSchedule {
              Id = Guid.NewGuid(),
              MicroLoanId = microLoanId,
              InstallmentNumber = row.InstallmentNumber,
              DueDate = row.DueDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
              BeginningBalance = row.BeginningBalance,
              PrincipalPortion = row.PrincipalPortion,
              InterestPortion = row.InterestPortion,
              InstallmentAmount = row.InstallmentAmount,
              EndingBalance = row.EndingBalance,
              PaidAmount = 0m,
              InstallmentStatus = "Pending"
            });
          }

          dbContext.Transactions.Add(new LedgerTransaction {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            InvoiceId = null,
            MicroLoanId = microLoanId,
            TransactionDateUtc = DateTime.UtcNow,
            TransactionType = "StandaloneLoanCreation",
            ReferenceNumber = string.IsNullOrWhiteSpace(request.ReferenceNumber)
              ? GenerateReferenceCode("MLS-STDLN")
              : request.ReferenceNumber.Trim(),
            DebitAmount = computation.Summary.PrincipalAmount,
            CreditAmount = 0m,
            RunningBalance = TenantMlsLoanMath.RoundCurrency(runningBalance + computation.Summary.PrincipalAmount),
            Remarks = string.IsNullOrWhiteSpace(request.Remarks)
              ? $"Standalone loan created for {customer.FullName}"
              : request.Remarks.Trim(),
            CreatedByUserId = currentUserId
          });

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new TenantMlsStandaloneLoanCreatedResponse(
              microLoanId,
              customer.FullName,
              computation.Summary));
        });

    return tenantApi;
  }

  private static string? ValidateStandaloneLoanTerms(decimal principalAmount, decimal annualInterestRate, int termMonths) {
    if (principalAmount <= 0m) {
      return "Principal amount must be greater than zero.";
    }

    if (annualInterestRate < 0m || annualInterestRate > 120m) {
      return "Annual interest rate must stay between 0 and 120 percent.";
    }

    if (termMonths is < 1 or > 60) {
      return "Term months must stay between 1 and 60.";
    }

    return null;
  }
}

namespace ServiFinance.Api.Endpoints.TenantMls;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auditing;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsStandaloneLoanEndpointMappings {
  private const int LedgerReferenceNumberMaxLength = 100;
  private const int LedgerRemarksMaxLength = 1000;

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
        IAuditLogService auditLogService,
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

          var referenceNumber = NormalizeOptionalText(request.ReferenceNumber);
          if ((referenceNumber?.Length ?? 0) > LedgerReferenceNumberMaxLength) {
            return Results.BadRequest(new { error = $"Reference number must be {LedgerReferenceNumberMaxLength} characters or fewer." });
          }

          var remarks = NormalizeOptionalText(request.Remarks);
          if ((remarks?.Length ?? 0) > LedgerRemarksMaxLength) {
            return Results.BadRequest(new { error = $"Loan remarks must be {LedgerRemarksMaxLength} characters or fewer." });
          }

          var customer = await dbContext.Customers
              .FirstOrDefaultAsync(entity => entity.Id == request.CustomerId, cancellationToken);
          if (customer is null) {
            return Results.NotFound(new { error = "The selected customer was not found for standalone loan processing." });
          }

          var computation = TenantMlsLoanMath.Build(request.PrincipalAmount, request.AnnualInterestRate, request.TermMonths, request.LoanStartDate);
          if (referenceNumber is not null &&
              await dbContext.Transactions
                  .AsNoTracking()
                  .AnyAsync(entity =>
                      entity.CustomerId == customer.Id &&
                      entity.TransactionType == "StandaloneLoanCreation" &&
                      entity.ReferenceNumber == referenceNumber,
                      cancellationToken)) {
            return Results.Conflict(new { error = "A standalone loan already uses this reference number for the selected customer." });
          }

          if (referenceNumber is null &&
              await HasRecentMatchingStandaloneLoanAsync(
                  dbContext,
                  customer.Id,
                  currentUserId,
                  computation.Summary.PrincipalAmount,
                  computation.Summary.AnnualInterestRate,
                  computation.Summary.TermMonths,
                  computation.Summary.LoanStartDate,
                  cancellationToken)) {
            return Results.Conflict(new { error = "A matching standalone loan was just created for this customer. Add a unique reference number if this is a separate loan." });
          }

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

          var loanTransaction = new LedgerTransaction {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            InvoiceId = null,
            MicroLoanId = microLoanId,
            TransactionDateUtc = DateTime.UtcNow,
            TransactionType = "StandaloneLoanCreation",
            ReferenceNumber = referenceNumber is null
              ? GenerateReferenceCode("MLS-STDLN")
              : referenceNumber,
            DebitAmount = computation.Summary.PrincipalAmount,
            CreditAmount = 0m,
            RunningBalance = TenantMlsLoanMath.RoundCurrency(runningBalance + computation.Summary.PrincipalAmount),
            Remarks = remarks is null
              ? $"Standalone loan created for {customer.FullName}"
              : remarks,
            CreatedByUserId = currentUserId
          };

          dbContext.Transactions.Add(loanTransaction);

          await dbContext.SaveChangesAsync(cancellationToken);
          await TenantMlsAuditLogging.WriteSystemAuditAsync(
              auditLogService,
              httpContext,
              customer.TenantId,
              "StandaloneLoanCreation",
              "Created",
              "MicroLoan",
              microLoanId,
              customer.FullName,
              $"Created a standalone loan for {customer.FullName}.");

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

  private static async Task<bool> HasRecentMatchingStandaloneLoanAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Guid customerId,
      Guid createdByUserId,
      decimal principalAmount,
      decimal annualInterestRate,
      int termMonths,
      DateOnly loanStartDate,
      CancellationToken cancellationToken) {
    var duplicateWindowStartUtc = DateTime.UtcNow.AddMinutes(-5);
    var loanStartDateUtc = loanStartDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
    return await dbContext.MicroLoans
        .AsNoTracking()
        .AnyAsync(entity =>
            entity.InvoiceId == null &&
            entity.CustomerId == customerId &&
            entity.CreatedByUserId == createdByUserId &&
            entity.PrincipalAmount == principalAmount &&
            entity.AnnualInterestRate == annualInterestRate &&
            entity.TermMonths == termMonths &&
            entity.LoanStartDate == loanStartDateUtc &&
            entity.CreatedAtUtc >= duplicateWindowStartUtc,
            cancellationToken);
  }

  private static string? NormalizeOptionalText(string? value) {
    var normalized = value?.Trim();
    return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
  }
}

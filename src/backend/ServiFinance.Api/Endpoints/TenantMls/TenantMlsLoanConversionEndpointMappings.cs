namespace ServiFinance.Api.Endpoints.TenantMls;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantMlsLoanConversionEndpointMappings {
  public static RouteGroupBuilder MapTenantMlsLoanConversionEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/mls/loan-conversion", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeServiceLinkedLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          var candidates = await QueryConvertibleInvoices(dbContext)
              .Select(entity => new TenantMlsLoanConversionCandidateResponse(
                  entity.Id,
                  entity.ServiceRequestId,
                  entity.CustomerId,
                  entity.Customer!.FullName,
                  entity.ServiceRequest != null ? entity.ServiceRequest.RequestNumber : "Standalone finance record",
                  entity.InvoiceNumber,
                  entity.InvoiceDateUtc,
                  entity.OutstandingAmount,
                  entity.InterestableAmount))
              .ToListAsync(cancellationToken);

          return Results.Ok(new TenantMlsLoanConversionWorkspaceResponse(candidates));
        });

    tenantApi.MapGet("/mls/loan-conversion/{invoiceId:guid}/preview", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid invoiceId,
        [AsParameters] TenantMlsLoanConversionTermsRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeServiceLinkedLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          var invoice = await QueryConvertibleInvoices(dbContext)
              .FirstOrDefaultAsync(entity => entity.Id == invoiceId, cancellationToken);
          if (invoice is null) {
            return Results.NotFound(new { error = "The selected invoice is not available for loan conversion." });
          }

          var validationError = ValidateTerms(request.AnnualInterestRate, request.TermMonths);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var preview = BuildLoanPreview(invoice, request.AnnualInterestRate, request.TermMonths, request.LoanStartDate);
          return Results.Ok(preview);
        });

    tenantApi.MapPost("/mls/loan-conversion", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] CreateTenantMlsLoanConversionRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessResult = await RequireTenantMlsAccessAsync(
              httpContext,
              tenantDomainSlug,
              dbContext,
              cancellationToken,
              MlsModuleCodeServiceLinkedLoans);
          if (accessResult is not null) {
            return accessResult;
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var validationError = ValidateTerms(request.AnnualInterestRate, request.TermMonths);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var invoice = await dbContext.Invoices
              .Include(entity => entity.Customer)
              .Include(entity => entity.ServiceRequest)
              .Include(entity => entity.MicroLoan)
              .FirstOrDefaultAsync(entity => entity.Id == request.InvoiceId, cancellationToken);
          if (invoice is null || !CanConvertToLoan(true, invoice.MicroLoan != null, invoice.OutstandingAmount, invoice.InterestableAmount)) {
            return Results.BadRequest(new { error = "The selected invoice can no longer be converted into a loan." });
          }

          var preview = BuildLoanPreview(invoice, request.AnnualInterestRate, request.TermMonths, request.LoanStartDate);
          var runningBalance = await dbContext.Transactions
              .Where(entity => entity.CustomerId == invoice.CustomerId)
              .OrderByDescending(entity => entity.TransactionDateUtc)
              .ThenByDescending(entity => entity.Id)
              .Select(entity => entity.RunningBalance)
              .FirstOrDefaultAsync(cancellationToken);

          var microLoanId = Guid.NewGuid();
          var microLoan = new MicroLoan {
            Id = microLoanId,
            InvoiceId = invoice.Id,
            CustomerId = invoice.CustomerId,
            PrincipalAmount = preview.Summary.PrincipalAmount,
            AnnualInterestRate = preview.Summary.AnnualInterestRate,
            TermMonths = preview.Summary.TermMonths,
            MonthlyInstallment = preview.Summary.MonthlyInstallment,
            TotalInterestAmount = preview.Summary.TotalInterestAmount,
            TotalRepayableAmount = preview.Summary.TotalRepayableAmount,
            LoanStartDate = preview.Summary.LoanStartDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            MaturityDate = preview.Summary.MaturityDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            LoanStatus = "Active",
            CreatedByUserId = currentUserId,
            CreatedAtUtc = DateTime.UtcNow
          };

          dbContext.MicroLoans.Add(microLoan);

          foreach (var row in preview.Schedule) {
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
            CustomerId = invoice.CustomerId,
            InvoiceId = invoice.Id,
            MicroLoanId = microLoanId,
            TransactionDateUtc = DateTime.UtcNow,
            TransactionType = "LoanCreation",
            ReferenceNumber = GenerateReferenceCode("MLS-LOAN"),
            DebitAmount = preview.Summary.PrincipalAmount,
            CreditAmount = 0m,
            RunningBalance = TenantMlsLoanMath.RoundCurrency(runningBalance + preview.Summary.PrincipalAmount),
            Remarks = $"Loan created from invoice {invoice.InvoiceNumber}",
            CreatedByUserId = currentUserId
          });

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new TenantMlsLoanCreatedResponse(
              microLoanId,
              invoice.InvoiceNumber,
              invoice.Customer!.FullName,
              preview.Summary));
        });

    return tenantApi;
  }

  private static IQueryable<Invoice> QueryConvertibleInvoices(ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext) =>
    dbContext.Invoices
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.ServiceRequest)
        .Include(entity => entity.MicroLoan)
        .Where(entity => entity.InvoiceStatus == "Finalized")
        .Where(entity => entity.MicroLoan == null)
        .Where(entity => entity.OutstandingAmount > 0m)
        .Where(entity => entity.InterestableAmount > 0m)
        .OrderByDescending(entity => entity.InvoiceDateUtc);

  private static string? ValidateTerms(decimal annualInterestRate, int termMonths) {
    if (annualInterestRate < 0m || annualInterestRate > 120m) {
      return "Annual interest rate must stay between 0 and 120 percent.";
    }

    if (termMonths is < 1 or > 60) {
      return "Term months must stay between 1 and 60.";
    }

    return null;
  }

  private static TenantMlsLoanConversionPreviewResponse BuildLoanPreview(
    Invoice invoice,
    decimal annualInterestRate,
    int termMonths,
    DateOnly loanStartDate) {
    var computation = TenantMlsLoanMath.Build(invoice.OutstandingAmount, annualInterestRate, termMonths, loanStartDate);

    return new TenantMlsLoanConversionPreviewResponse(
        new TenantMlsLoanConversionCandidateResponse(
            invoice.Id,
            invoice.ServiceRequestId,
            invoice.CustomerId,
            invoice.Customer!.FullName,
            invoice.ServiceRequest != null ? invoice.ServiceRequest.RequestNumber : "Standalone finance record",
            invoice.InvoiceNumber,
            invoice.InvoiceDateUtc,
            invoice.OutstandingAmount,
            invoice.InterestableAmount),
        computation.Summary,
        computation.Schedule);
  }
}

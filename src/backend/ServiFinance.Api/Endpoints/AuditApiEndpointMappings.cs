namespace ServiFinance.Api.Endpoints;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class AuditApiEndpointMappings {
  private const string ScopeSuperadmin = "Superadmin";
  private const string ScopeTenantSms = "TenantSms";
  private const string ScopeTenantMls = "TenantMls";
  private const string CategorySystem = "System";
  private const string CategorySecurity = "Security";

  public static RouteGroupBuilder MapAuditApiEndpoints(this RouteGroupBuilder api) {
    api.MapGet("/platform/audits/system", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string? actionType,
        string? searchTerm,
        DateTime? dateFrom,
        DateTime? dateTo,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!httpContext.User.IsInRole("SuperAdmin")) {
            return Results.Forbid();
          }

          var query = AuditQuery.Create(ScopeSuperadmin, CategorySystem, actionType, searchTerm, dateFrom, dateTo);
          if (query.Error is not null) {
            return Results.BadRequest(new { error = query.Error });
          }

          var events = await LoadPlatformSystemAuditRowsAsync(dbContext, query, cancellationToken);
          return Results.Ok(CreateAuditWorkspace(events));
        });

    api.MapGet("/platform/audits/security", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string? actionType,
        string? searchTerm,
        DateTime? dateFrom,
        DateTime? dateTo,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!httpContext.User.IsInRole("SuperAdmin")) {
            return Results.Forbid();
          }

          var query = AuditQuery.Create(ScopeSuperadmin, CategorySecurity, actionType, searchTerm, dateFrom, dateTo);
          if (query.Error is not null) {
            return Results.BadRequest(new { error = query.Error });
          }

          var events = await LoadStoredAuditRowsAsync(dbContext, ServiFinanceDatabaseDefaults.PlatformTenantId, query, cancellationToken);
          return Results.Ok(CreateAuditWorkspace(events));
        });

    api.MapGet("/tenants/{tenantDomainSlug}/audits/system", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        string? scope,
        string? actionType,
        string? searchTerm,
        DateTime? dateFrom,
        DateTime? dateTo,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var access = await RequireTenantAuditAccessAsync(httpContext, tenantDomainSlug, scope, dbContext, cancellationToken);
          if (access.Result is not null) {
            return access.Result;
          }

          var query = AuditQuery.Create(access.Scope, CategorySystem, actionType, searchTerm, dateFrom, dateTo);
          if (query.Error is not null) {
            return Results.BadRequest(new { error = query.Error });
          }

          var events = access.Scope == ScopeTenantMls
            ? await LoadTenantMlsSystemAuditRowsAsync(dbContext, access.TenantId, query, cancellationToken)
            : await LoadTenantSmsSystemAuditRowsAsync(dbContext, access.TenantId, query, cancellationToken);

          return Results.Ok(CreateAuditWorkspace(events));
        });

    api.MapGet("/tenants/{tenantDomainSlug}/audits/security", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        string? scope,
        string? actionType,
        string? searchTerm,
        DateTime? dateFrom,
        DateTime? dateTo,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var access = await RequireTenantAuditAccessAsync(httpContext, tenantDomainSlug, scope, dbContext, cancellationToken);
          if (access.Result is not null) {
            return access.Result;
          }

          var query = AuditQuery.Create(access.Scope, CategorySecurity, actionType, searchTerm, dateFrom, dateTo);
          if (query.Error is not null) {
            return Results.BadRequest(new { error = query.Error });
          }

          var events = await LoadStoredAuditRowsAsync(dbContext, access.TenantId, query, cancellationToken);
          return Results.Ok(CreateAuditWorkspace(events));
        });

    return api;
  }

  private static async Task<TenantAuditAccess> RequireTenantAuditAccessAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      string? requestedScope,
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return TenantAuditAccess.Forbidden();
    }

    if (!IsTenantAdministrator(httpContext.User)) {
      return TenantAuditAccess.Forbidden();
    }

    if (!Guid.TryParse(httpContext.User.FindFirstValue("tenant_id"), out var tenantId)) {
      return TenantAuditAccess.Unauthorized();
    }

    var scope = ResolveTenantAuditScope(requestedScope);
    if (scope == ScopeTenantMls) {
      var accessError = await RequireTenantMlsAccessAsync(
          httpContext,
          tenantDomainSlug,
          dbContext,
          cancellationToken,
          MlsModuleCodeAuditLogs);
      if (accessError is not null) {
        return TenantAuditAccess.Failed(accessError);
      }
    }

    return TenantAuditAccess.Allowed(tenantId, scope);
  }

  private static string ResolveTenantAuditScope(string? requestedScope) =>
    requestedScope?.Trim().ToLowerInvariant() switch {
      "mls" or "tenantmls" or "tenant-mls" => ScopeTenantMls,
      _ => ScopeTenantSms
    };

  private static async Task<IReadOnlyList<AuditEventRowResponse>> LoadPlatformSystemAuditRowsAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      AuditQuery query,
      CancellationToken cancellationToken) {
    var storedEvents = await LoadStoredAuditRowsAsync(dbContext, ServiFinanceDatabaseDefaults.PlatformTenantId, query, cancellationToken);

    var registrationEvents = await dbContext.PlatformTenantRegistrations
        .AsNoTracking()
        .OrderByDescending(entity => entity.UpdatedAtUtc)
        .Take(100)
        .Select(entity => new AuditEventRowResponse(
            entity.Id,
            entity.UpdatedAtUtc,
            ScopeSuperadmin,
            CategorySystem,
            "TenantRegistration",
            entity.Status,
            entity.OwnerFullName,
            entity.OwnerEmail,
            "PlatformTenantRegistration",
            entity.BusinessName,
            $"Registration for {entity.DomainSlug} is {entity.Status}.",
            null))
        .ToListAsync(cancellationToken);

    var tenantEvents = await dbContext.Tenants
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(entity => entity.Id != ServiFinanceDatabaseDefaults.PlatformTenantId)
        .OrderByDescending(entity => entity.CreatedAtUtc)
        .Take(100)
        .Select(entity => new AuditEventRowResponse(
            entity.Id,
            entity.CreatedAtUtc,
            ScopeSuperadmin,
            CategorySystem,
            "TenantProvisioned",
            entity.IsActive ? "Active" : "Inactive",
            "System",
            string.Empty,
            "Tenant",
            entity.DomainSlug,
            $"Tenant {entity.Name} was provisioned on {entity.SubscriptionPlan}.",
            null))
        .ToListAsync(cancellationToken);

    return ApplyAuditFilters(storedEvents.Concat(registrationEvents).Concat(tenantEvents), query);
  }

  private static async Task<IReadOnlyList<AuditEventRowResponse>> LoadTenantSmsSystemAuditRowsAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Guid tenantId,
      AuditQuery query,
      CancellationToken cancellationToken) {
    var storedEvents = await LoadStoredAuditRowsAsync(dbContext, tenantId, query, cancellationToken);

    var statusEvents = await dbContext.StatusLogs
        .AsNoTracking()
        .Include(entity => entity.ServiceRequest)
        .Include(entity => entity.ChangedByUser)
        .OrderByDescending(entity => entity.ChangedAtUtc)
        .Take(100)
        .Select(entity => new AuditEventRowResponse(
            entity.Id,
            entity.ChangedAtUtc,
            ScopeTenantSms,
            CategorySystem,
            "ServiceStatusChanged",
            entity.Status,
            entity.ChangedByUser != null ? entity.ChangedByUser.FullName : "Unknown operator",
            entity.ChangedByUser != null ? entity.ChangedByUser.Email : string.Empty,
            "ServiceRequest",
            entity.ServiceRequest != null ? entity.ServiceRequest.RequestNumber : entity.ServiceRequestId.ToString(),
            entity.Remarks,
            null))
        .ToListAsync(cancellationToken);

    var assignmentEvents = await dbContext.AssignmentEvents
        .AsNoTracking()
        .Include(entity => entity.Assignment)
        .ThenInclude(entity => entity!.ServiceRequest)
        .Include(entity => entity.ChangedByUser)
        .OrderByDescending(entity => entity.CreatedAtUtc)
        .Take(100)
        .Select(entity => new AuditEventRowResponse(
            entity.Id,
            entity.CreatedAtUtc,
            ScopeTenantSms,
            CategorySystem,
            entity.EventType,
            entity.AssignmentStatus,
            entity.ChangedByUser != null ? entity.ChangedByUser.FullName : "Unknown operator",
            entity.ChangedByUser != null ? entity.ChangedByUser.Email : string.Empty,
            "Assignment",
            entity.Assignment != null && entity.Assignment.ServiceRequest != null
                ? entity.Assignment.ServiceRequest.RequestNumber
                : entity.AssignmentId.ToString(),
            entity.Remarks,
            null))
        .ToListAsync(cancellationToken);

    var billingEvents = await dbContext.TenantBillingRecords
        .AsNoTracking()
        .Include(entity => entity.SubmittedByUser)
        .OrderByDescending(entity => entity.SubmittedAtUtc)
        .Take(100)
        .Select(entity => new AuditEventRowResponse(
            entity.Id,
            entity.ReviewedAtUtc ?? entity.SubmittedAtUtc,
            ScopeTenantSms,
            CategorySystem,
            entity.ReviewedAtUtc.HasValue ? "BillingProofReviewed" : "BillingProofSubmitted",
            entity.Status,
            entity.SubmittedByUser != null ? entity.SubmittedByUser.FullName : "Unknown operator",
            entity.SubmittedByUser != null ? entity.SubmittedByUser.Email : string.Empty,
            "TenantBillingRecord",
            entity.BillingPeriodLabel,
            entity.ReviewRemarks ?? entity.Note ?? "Tenant billing record updated.",
            null))
        .ToListAsync(cancellationToken);

    return ApplyAuditFilters(storedEvents.Concat(statusEvents).Concat(assignmentEvents).Concat(billingEvents), query);
  }

  private static async Task<IReadOnlyList<AuditEventRowResponse>> LoadTenantMlsSystemAuditRowsAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Guid tenantId,
      AuditQuery query,
      CancellationToken cancellationToken) {
    var storedEvents = await LoadStoredAuditRowsAsync(dbContext, tenantId, query, cancellationToken);

    var loanEvents = await dbContext.MicroLoans
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.Invoice)
        .Include(entity => entity.CreatedByUser)
        .OrderByDescending(entity => entity.CreatedAtUtc)
        .Take(100)
        .Select(entity => new AuditEventRowResponse(
            entity.Id,
            entity.CreatedAtUtc,
            ScopeTenantMls,
            CategorySystem,
            entity.InvoiceId != null ? "LoanCreation" : "StandaloneLoanCreation",
            entity.LoanStatus,
            entity.CreatedByUser != null ? entity.CreatedByUser.FullName : "Unknown operator",
            entity.CreatedByUser != null ? entity.CreatedByUser.Email : string.Empty,
            "MicroLoan",
            entity.Invoice != null ? entity.Invoice.InvoiceNumber : entity.Id.ToString(),
            entity.Customer != null
                ? $"Loan account created for {entity.Customer.FullName}."
                : "Loan account created.",
            null))
        .ToListAsync(cancellationToken);

    var ledgerEvents = await dbContext.Transactions
        .AsNoTracking()
        .Include(entity => entity.Customer)
        .Include(entity => entity.Invoice)
        .Include(entity => entity.CreatedByUser)
        .Where(entity => entity.TransactionType == "LoanPayment" || entity.TransactionType == "LoanPaymentReversal")
        .OrderByDescending(entity => entity.TransactionDateUtc)
        .Take(100)
        .Select(entity => new AuditEventRowResponse(
            entity.Id,
            entity.TransactionDateUtc,
            ScopeTenantMls,
            CategorySystem,
            entity.TransactionType,
            entity.TransactionType == "LoanPaymentReversal" ? "Reversed" : "Posted",
            entity.CreatedByUser != null ? entity.CreatedByUser.FullName : "Unknown operator",
            entity.CreatedByUser != null ? entity.CreatedByUser.Email : string.Empty,
            "LedgerTransaction",
            entity.ReferenceNumber,
            entity.Remarks != string.Empty ? entity.Remarks : "MLS ledger transaction posted.",
            null))
        .ToListAsync(cancellationToken);

    return ApplyAuditFilters(storedEvents.Concat(loanEvents).Concat(ledgerEvents), query);
  }

  private static async Task<IReadOnlyList<AuditEventRowResponse>> LoadStoredAuditRowsAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Guid tenantId,
      AuditQuery query,
      CancellationToken cancellationToken) {
    var eventsQuery = dbContext.AuditEvents
        .AsNoTracking()
        .Where(entity => entity.TenantId == tenantId)
        .Where(entity => entity.Scope == query.Scope)
        .Where(entity => entity.Category == query.Category);

    if (query.DateFromUtc.HasValue) {
      eventsQuery = eventsQuery.Where(entity => entity.OccurredAtUtc >= query.DateFromUtc.Value);
    }

    if (query.DateToExclusiveUtc.HasValue) {
      eventsQuery = eventsQuery.Where(entity => entity.OccurredAtUtc < query.DateToExclusiveUtc.Value);
    }

    if (!string.IsNullOrWhiteSpace(query.ActionType)) {
      eventsQuery = eventsQuery.Where(entity => entity.ActionType == query.ActionType);
    }

    if (!string.IsNullOrWhiteSpace(query.SearchTerm)) {
      eventsQuery = eventsQuery.Where(entity =>
          entity.ActorName.Contains(query.SearchTerm) ||
          entity.ActorEmail.Contains(query.SearchTerm) ||
          entity.SubjectLabel.Contains(query.SearchTerm) ||
          entity.Detail.Contains(query.SearchTerm));
    }

    return await eventsQuery
        .OrderByDescending(entity => entity.OccurredAtUtc)
        .Take(150)
        .Select(entity => new AuditEventRowResponse(
            entity.Id,
            entity.OccurredAtUtc,
            entity.Scope,
            entity.Category,
            entity.ActionType,
            entity.Outcome,
            entity.ActorName,
            entity.ActorEmail,
            entity.SubjectType,
            entity.SubjectLabel,
            entity.Detail,
            entity.IpAddress))
        .ToListAsync(cancellationToken);
  }

  private static IReadOnlyList<AuditEventRowResponse> ApplyAuditFilters(
      IEnumerable<AuditEventRowResponse> events,
      AuditQuery query) {
    var filtered = events;

    if (query.DateFromUtc.HasValue) {
      filtered = filtered.Where(entity => entity.OccurredAtUtc >= query.DateFromUtc.Value);
    }

    if (query.DateToExclusiveUtc.HasValue) {
      filtered = filtered.Where(entity => entity.OccurredAtUtc < query.DateToExclusiveUtc.Value);
    }

    if (!string.IsNullOrWhiteSpace(query.ActionType)) {
      filtered = filtered.Where(entity => string.Equals(entity.ActionType, query.ActionType, StringComparison.OrdinalIgnoreCase));
    }

    if (!string.IsNullOrWhiteSpace(query.SearchTerm)) {
      filtered = filtered.Where(entity =>
          entity.ActorName.Contains(query.SearchTerm, StringComparison.OrdinalIgnoreCase) ||
          entity.ActorEmail.Contains(query.SearchTerm, StringComparison.OrdinalIgnoreCase) ||
          entity.SubjectLabel.Contains(query.SearchTerm, StringComparison.OrdinalIgnoreCase) ||
          entity.Detail.Contains(query.SearchTerm, StringComparison.OrdinalIgnoreCase));
    }

    return filtered
        .OrderByDescending(entity => entity.OccurredAtUtc)
        .Take(150)
        .ToArray();
  }

  private static AuditWorkspaceResponse CreateAuditWorkspace(IReadOnlyList<AuditEventRowResponse> events) =>
    new(
        new AuditSummaryResponse(
            events.Count,
            events.Count(entity => entity.Category == CategorySystem),
            events.Count(entity => entity.Category == CategorySecurity),
            events.Count(entity => entity.Outcome.Contains("Fail", StringComparison.OrdinalIgnoreCase) ||
                entity.Outcome.Contains("Denied", StringComparison.OrdinalIgnoreCase))),
        events);

  private readonly record struct TenantAuditAccess(
      Guid TenantId,
      string Scope,
      IResult? Result) {
    public static TenantAuditAccess Allowed(Guid tenantId, string scope) => new(tenantId, scope, null);
    public static TenantAuditAccess Failed(IResult result) => new(Guid.Empty, string.Empty, result);
    public static TenantAuditAccess Forbidden() => Failed(Results.Forbid());
    public static TenantAuditAccess Unauthorized() => Failed(Results.Unauthorized());
  }

  private readonly record struct AuditQuery(
      string Scope,
      string Category,
      string? ActionType,
      string? SearchTerm,
      DateTime? DateFromUtc,
      DateTime? DateToExclusiveUtc,
      string? Error) {
    public static AuditQuery Create(
        string scope,
        string category,
        string? actionType,
        string? searchTerm,
        DateTime? dateFrom,
        DateTime? dateTo) {
      var dateFromUtc = dateFrom?.Date;
      var dateToExclusiveUtc = dateTo?.Date.AddDays(1);
      if (dateFromUtc.HasValue && dateToExclusiveUtc.HasValue && dateToExclusiveUtc.Value <= dateFromUtc.Value) {
        return new(scope, category, null, null, null, null, "Audit end date must be on or after the start date.");
      }

      return new(
          scope,
          category,
          string.IsNullOrWhiteSpace(actionType) ? null : actionType.Trim(),
          string.IsNullOrWhiteSpace(searchTerm) ? null : searchTerm.Trim(),
          dateFromUtc,
          dateToExclusiveUtc,
          null);
    }
  }
}

namespace ServiFinance.Api.Infrastructure;

using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Payments;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;

internal static class ProgramEndpointSupport {
  internal const string ApiAuthenticationSchemes = CookieAuthenticationDefaults.AuthenticationScheme + "," + Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
  internal const string SmsModuleCodeServiceIntake = "W1_SERVICE_INTAKE";
  internal const string SmsModuleCodeStaffAccounts = "W2_STAFF_ACCOUNTS";
  internal const string SmsModuleCodeScheduling = "W3_SCHEDULING";
  internal const string SmsModuleCodeJobUpdates = "W4_JOB_UPDATES";
  internal const string SmsModuleCodeInvoicing = "W5_INVOICING";
  internal const string SmsModuleCodeReports = "W6_REPORTS";
  internal const string SmsModuleCodeWorkforceOverview = "W7_WORKFORCE_OVERVIEW";
  internal const string SmsModuleCodeSlaEscalations = "W8_SLA_ESCALATIONS";
  internal const string SmsModuleCodeFeedbackCrm = "W9_FEEDBACK_CRM";
  internal const string SmsModuleCodePartsCostControl = "W10_PARTS_COST_CONTROL";
  internal const string MlsModuleCodeServiceLinkedLoans = "D1_SERVICE_LINKED_LOANS";
  internal const string MlsModuleCodeStandaloneLoans = "D2_STANDALONE_LOANS";
  internal const string MlsModuleCodeFinancialRecords = "D3_FINANCIAL_RECORDS";
  internal const string MlsModuleCodeAmortization = "D4_AMORTIZATION";
  internal const string MlsModuleCodeLedgerReports = "D5_LEDGER_REPORTS";
  internal const string MlsModuleCodeAuditLogs = "D6_AUDIT_LOGS";
  internal const string MlsModuleCodeCollectionsQueue = "D7_COLLECTIONS_QUEUE";
  internal const string MlsModuleCodePortfolioRiskDashboard = "D8_PORTFOLIO_RISK_DASHBOARD";
  internal const string MlsModuleCodeLoanApprovalWorkflow = "D9_LOAN_APPROVAL_WORKFLOW";
  internal const string MlsModuleCodeFinancePolicyControl = "D10_FINANCE_POLICY_CONTROL";
  internal const string ModuleAccessLevelIncluded = "Included";
  internal const int BillingRecoveryReadOnlyGracePeriodDays = 7;
  internal const int BillingRecoverySuspensionReviewGracePeriodDays = 14;
  internal static readonly string[] ServiceCostCategories = [
    "Base Charge",
    "Part Replacement",
    "Service",
    "Fee",
    "Other"
  ];

  internal static bool IsAllowedFrontendOrigin(string origin) {
    if (string.IsNullOrWhiteSpace(origin)) {
      return false;
    }

    if (string.Equals(origin, "null", StringComparison.OrdinalIgnoreCase) ||
        origin.StartsWith("app://", StringComparison.OrdinalIgnoreCase)) {
      return true;
    }

    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) {
      return false;
    }

    if (string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)) {
      return true;
    }

    if (uri.Host.StartsWith("127.", StringComparison.OrdinalIgnoreCase)) {
      return true;
    }

    if (uri.Host.StartsWith("0.0.0.", StringComparison.OrdinalIgnoreCase)) {
      return true;
    }

    return false;
  }

  internal static CurrentSessionUser ToCurrentSessionUser(AuthenticatedUser user, AuthenticationSurface surface) =>
    new(
      user.UserId,
      user.TenantId,
      user.TenantDomainSlug,
      user.Email,
      user.FullName,
      user.Roles,
      user.PlatformScopes,
      user.PermissionKeys,
      user.ModuleAccess,
      surface);

  internal static string SanitizeReturnUrl(string? returnUrl, string fallbackPath = "/dashboard") {
    if (string.IsNullOrWhiteSpace(returnUrl)) {
      return fallbackPath;
    }

    return Uri.TryCreate(returnUrl, UriKind.Relative, out var relativeUri)
        ? relativeUri.ToString()
        : fallbackPath;
  }

  internal static async Task SignInUserAsync(
      HttpContext httpContext,
      AuthenticatedUser user,
      AuthenticationSurface surface,
      bool isPersistent = false) {
    var claims = new List<Claim> {
      new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
      new(ClaimTypes.Name, user.FullName),
      new(ClaimTypes.Email, user.Email),
      new("tenant_id", user.TenantId.ToString()),
      new("tenant_domain_slug", user.TenantDomainSlug),
      new("surface", surface.ToString())
    };

    claims.AddRange(user.Roles.Select(role => new Claim(ClaimTypes.Role, role)));
    claims.AddRange(user.PlatformScopes.Select(scope => new Claim("platform_scope", scope)));
    claims.AddRange(user.PermissionKeys.Select(permissionKey => new Claim("permission_key", permissionKey)));
    claims.AddRange(user.ModuleAccess.Select(moduleAccess => new Claim(
        SessionModuleAccessClaims.ClaimType,
        SessionModuleAccessClaims.ToClaimValue(moduleAccess))));

    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    var authenticationProperties = new AuthenticationProperties {
      IsPersistent = isPersistent,
      AllowRefresh = true
    };

    if (isPersistent) {
      authenticationProperties.ExpiresUtc = DateTimeOffset.UtcNow.AddDays(14);
    }

    await httpContext.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        new ClaimsPrincipal(identity),
        authenticationProperties);
  }

  internal static string? NormalizeTenantSlug(string? tenantSlug) =>
    string.IsNullOrWhiteSpace(tenantSlug)
        ? null
        : tenantSlug.Trim().ToLowerInvariant();

  internal static string? ReadRefreshTokenCookie(HttpContext httpContext) =>
    httpContext.Request.Cookies.TryGetValue("sf_refresh_token", out var refreshToken)
        ? refreshToken
        : null;

  internal static bool IsTenantRouteAllowed(ClaimsPrincipal principal, string tenantDomainSlug) {
    if (!string.Equals(principal.FindFirstValue("tenant_domain_slug"), tenantDomainSlug, StringComparison.OrdinalIgnoreCase)) {
      return false;
    }

    var surfaceText = principal.FindFirstValue("surface");
    return string.Equals(surfaceText, AuthenticationSurface.TenantWeb.ToString(), StringComparison.OrdinalIgnoreCase) ||
        string.Equals(surfaceText, AuthenticationSurface.TenantDesktop.ToString(), StringComparison.OrdinalIgnoreCase);
  }

  internal static bool IsTenantSmsRouteAllowed(ClaimsPrincipal principal, string tenantDomainSlug) =>
    IsTenantRouteAllowed(principal, tenantDomainSlug) &&
    string.Equals(principal.FindFirstValue("surface"), AuthenticationSurface.TenantWeb.ToString(), StringComparison.OrdinalIgnoreCase);

  internal static bool IsTenantAdministrator(ClaimsPrincipal principal) =>
    principal.IsInRole(PlatformRolePolicy.AdministratorRole) ||
    principal.IsInRole(PlatformRolePolicy.OwnerRole);

  internal static bool CanViewAllTenantDispatchAssignments(ClaimsPrincipal principal) {
    if (IsTenantAdministrator(principal)) {
      return true;
    }

    var permissionKeys = principal.FindAll("permission_key")
      .Select(claim => claim.Value)
      .ToHashSet(StringComparer.OrdinalIgnoreCase);

    return permissionKeys.Contains("sms.dispatch.schedule") ||
      permissionKeys.Contains("sms.customers.view") ||
      permissionKeys.Contains("sms.reports.view") ||
      permissionKeys.Contains("sms.sla-escalations.view") ||
      permissionKeys.Contains("sms.feedback-crm.view") ||
      permissionKeys.Contains("sms.cost-control.view") ||
      permissionKeys.Contains("sms.users.manage") ||
      permissionKeys.Contains("sms.roles-permissions.manage") ||
      permissionKeys.Contains("sms.audits.view");
  }

  internal static bool TryGetCurrentUserId(ClaimsPrincipal principal, out Guid userId) =>
    Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

  internal static async Task<IResult?> RequireTenantSmsAccessAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      IRolePermissionAuthorizationService rolePermissionAuthorizationService,
      CancellationToken cancellationToken,
      string permissionKey,
      string? requiredModuleCode = null,
      string? requiredModuleAccessLevel = null) {
    if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "This SMS session is not allowed to access the selected tenant route.");
    }

    if (!Guid.TryParse(httpContext.User.FindFirstValue("tenant_id"), out var tenantId)) {
      return Results.Unauthorized();
    }

    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    var tenant = await dbContext.Tenants
        .AsNoTracking()
        .Include(entity => entity.BillingRecords)
        .SingleOrDefaultAsync(
            entity => entity.Id == tenantId && entity.DomainSlug == tenantDomainSlug,
            cancellationToken);
    if (tenant is null) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "The tenant context for this SMS session could not be resolved.");
    }

    if (!tenant.IsActive) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "This tenant is inactive and cannot access the SMS web workspace.");
    }

    if (string.Equals(tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase)) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "SMS web access is suspended for this tenant until subscription standing is restored.");
    }

    var recoveryAccessError = GetTenantBillingRecoveryAccessError(tenant, httpContext.Request);
    if (recoveryAccessError is not null) {
      return CreateJsonError(StatusCodes.Status403Forbidden, recoveryAccessError);
    }

    var currentTier = await ResolveCurrentTierAsync(dbContext, tenant, cancellationToken);
    if (currentTier is null || !currentTier.IsActive || !currentTier.IncludesServiceManagementWeb) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "SMS web access is not included in the current tenant subscription.");
    }

    if (!string.IsNullOrWhiteSpace(requiredModuleCode)) {
      var accessLevel = GetTenantModuleAccessLevel(currentTier, requiredModuleCode);
      if (!IsGrantedModuleAccessLevel(accessLevel)) {
        return CreateJsonError(
          StatusCodes.Status403Forbidden,
          $"The current tenant subscription does not include the {GetTenantSmsModuleLabel(requiredModuleCode)} module.");
      }

      if (!HasRequiredModuleAccessLevel(accessLevel, requiredModuleAccessLevel)) {
        return CreateJsonError(
          StatusCodes.Status403Forbidden,
          $"The {GetTenantSmsModuleLabel(requiredModuleCode)} module requires full plan access for this action.");
      }
    }

    if (!await rolePermissionAuthorizationService.HasPermissionAsync(
      userId,
      PlatformRolePolicy.SmsScope,
      permissionKey,
      cancellationToken)) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "Your role does not include the required SMS permission for this action.");
    }

    return null;
  }

  internal static async Task<IResult?> RequireTenantWorkspacePermissionAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      IRolePermissionAuthorizationService rolePermissionAuthorizationService,
      CancellationToken cancellationToken,
      string workspaceScope,
      string permissionKey,
      string? requiredModuleCode = null,
      string? requiredModuleAccessLevel = null,
      bool allowBillingRecoveryActions = false) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "This tenant session is not allowed to access the selected tenant route.");
    }

    if (!Guid.TryParse(httpContext.User.FindFirstValue("tenant_id"), out var tenantId)) {
      return Results.Unauthorized();
    }

    if (!TryGetCurrentUserId(httpContext.User, out var userId)) {
      return Results.Unauthorized();
    }

    var normalizedScope = RolePermissionCatalog.NormalizeWorkspaceScope(workspaceScope);
    var tenant = await dbContext.Tenants
        .AsNoTracking()
        .Include(entity => entity.BillingRecords)
        .SingleOrDefaultAsync(
            entity => entity.Id == tenantId && entity.DomainSlug == tenantDomainSlug,
            cancellationToken);
    if (tenant is null) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "The tenant context for this session could not be resolved.");
    }

    var isRecoverableSubscriptionSuspension = IsTenantSubscriptionRecoverySuspended(tenant);
    if (!tenant.IsActive && !(allowBillingRecoveryActions && isRecoverableSubscriptionSuspension)) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "This tenant is inactive and cannot access tenant administration.");
    }

    if (string.Equals(tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase) &&
        !allowBillingRecoveryActions) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "Tenant administration is suspended until subscription standing is restored.");
    }

    var recoveryAccessError = GetTenantBillingRecoveryAccessError(
        tenant,
        httpContext.Request,
        allowBillingRecoveryActions);
    if (recoveryAccessError is not null) {
      return CreateJsonError(StatusCodes.Status403Forbidden, recoveryAccessError);
    }

    var currentTier = await ResolveCurrentTierAsync(dbContext, tenant, cancellationToken);
    if (currentTier is null || !currentTier.IsActive) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "The current tenant subscription could not be resolved.");
    }

    if (normalizedScope == PlatformRolePolicy.SmsScope && !currentTier.IncludesServiceManagementWeb) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "SMS web administration is not included in the current tenant subscription.");
    }

    if (normalizedScope == PlatformRolePolicy.MlsScope && !currentTier.IncludesMicroLendingDesktop) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "MLS desktop administration is not included in the current tenant subscription.");
    }

    if (!string.IsNullOrWhiteSpace(requiredModuleCode)) {
      var accessLevel = GetTenantModuleAccessLevel(currentTier, requiredModuleCode);
      if (!IsGrantedModuleAccessLevel(accessLevel)) {
        return CreateJsonError(StatusCodes.Status403Forbidden, "The current tenant subscription does not include the required administration module.");
      }

      if (!HasRequiredModuleAccessLevel(accessLevel, requiredModuleAccessLevel)) {
        return CreateJsonError(StatusCodes.Status403Forbidden, "This administration action requires full plan access.");
      }
    }

    if (!await rolePermissionAuthorizationService.HasPermissionAsync(
      userId,
      normalizedScope,
      permissionKey,
      cancellationToken)) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "Your role does not include the required tenant permission for this action.");
    }

    return null;
  }

  internal static async Task<IResult?> RequireTenantMlsAccessAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken,
      string? requiredModuleCode = null,
      string? requiredModuleAccessLevel = null) {
    if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "This MLS session is not allowed to access the selected tenant route.");
    }

    var surfaceText = httpContext.User.FindFirstValue("surface");
    if (!string.Equals(surfaceText, AuthenticationSurface.TenantDesktop.ToString(), StringComparison.OrdinalIgnoreCase)) {
      return CreateJsonError(StatusCodes.Status403Forbidden, "MLS desktop routes require a desktop MLS session. Sign in through the MLS desktop login.");
    }

    if (!Guid.TryParse(httpContext.User.FindFirstValue("tenant_id"), out var tenantId)) {
      return Results.Unauthorized();
    }

    var accessError = await GetTenantMlsAccessErrorAsync(
        tenantId,
        tenantDomainSlug,
        dbContext,
        cancellationToken,
        requiredModuleCode,
        requiredModuleAccessLevel,
        httpContext.Request);

    return accessError is null
      ? null
      : CreateJsonError(StatusCodes.Status403Forbidden, accessError);
  }

  internal static async Task<string?> GetTenantMlsAccessErrorAsync(
      Guid tenantId,
      string tenantDomainSlug,
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken,
      string? requiredModuleCode = null,
      string? requiredModuleAccessLevel = null,
      HttpRequest? request = null) {
    var tenant = await dbContext.Tenants
        .AsNoTracking()
        .Include(entity => entity.BillingRecords)
        .SingleOrDefaultAsync(
            entity => entity.Id == tenantId && entity.DomainSlug == tenantDomainSlug,
            cancellationToken);
    if (tenant is null) {
      return "The tenant context for this MLS session could not be resolved.";
    }

    if (!tenant.IsActive) {
      return "This tenant is inactive and cannot access the MLS desktop.";
    }

    if (string.Equals(tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase)) {
      return "MLS desktop access is suspended for this tenant until subscription standing is restored.";
    }

    var recoveryAccessError = GetTenantBillingRecoveryAccessError(tenant, request);
    if (recoveryAccessError is not null) {
      return recoveryAccessError;
    }

    var currentTier = await ResolveCurrentTierAsync(dbContext, tenant, cancellationToken);
    if (currentTier is null || !currentTier.IsActive || !currentTier.IncludesMicroLendingDesktop) {
      return "MLS desktop access is not included in the current tenant subscription.";
    }

    if (!string.IsNullOrWhiteSpace(requiredModuleCode)) {
      var accessLevel = GetTenantModuleAccessLevel(currentTier, requiredModuleCode);
      if (!IsGrantedModuleAccessLevel(accessLevel)) {
        return $"The current tenant subscription does not include the {GetTenantMlsModuleLabel(requiredModuleCode)} module.";
      }

      if (!HasRequiredModuleAccessLevel(accessLevel, requiredModuleAccessLevel)) {
        return $"The {GetTenantMlsModuleLabel(requiredModuleCode)} module requires full plan access for this action.";
      }
    }

    return null;
  }

  private static string? GetTenantBillingRecoveryAccessError(
      Tenant tenant,
      HttpRequest? request,
      bool allowBillingRecoveryActions = false) {
    if (allowBillingRecoveryActions || request is null) {
      return null;
    }

    var recoveryPolicy = ResolveTenantBillingRecoveryPolicy(tenant);
    if (string.Equals(recoveryPolicy.Stage, "Suspension review", StringComparison.OrdinalIgnoreCase)) {
      return "Tenant workspace access is locked because subscription recovery reached the 14-day suspension-review threshold. Restore billing from the Billing workspace or contact the platform administrator.";
    }

    if (string.Equals(recoveryPolicy.Stage, "Read-only recommended", StringComparison.OrdinalIgnoreCase) &&
        !IsReadOnlyRequest(request)) {
      return "Tenant workspace is in read-only recovery because subscription renewal is at least 7 days overdue. Restore billing before making operational changes.";
    }

    return null;
  }

  internal static TenantBillingRecoveryPolicy ResolveTenantBillingRecoveryPolicy(Tenant tenant) {
    var billingRecords = tenant.BillingRecords
        .OrderByDescending(entity => entity.CoverageStartUtc)
        .ThenByDescending(entity => entity.SubmittedAtUtc)
        .ToArray();
    var latestBillingRecord = billingRecords.FirstOrDefault();
    var nextRenewalDateUtc = ResolveTenantNextRenewalDateUtc(billingRecords);

    if (!IsTenantBillingRecoveryFailure(tenant, latestBillingRecord, nextRenewalDateUtc)) {
      return new TenantBillingRecoveryPolicy("Active", null);
    }

    var recoveryAnchorUtc = nextRenewalDateUtc ??
      latestBillingRecord?.CoverageEndUtc ??
      latestBillingRecord?.SubmittedAtUtc;
    var overdueDays = recoveryAnchorUtc.HasValue
        ? Math.Max(0, (DateTime.UtcNow.Date - recoveryAnchorUtc.Value.Date).Days)
        : 0;

    if (overdueDays >= BillingRecoverySuspensionReviewGracePeriodDays) {
      return new TenantBillingRecoveryPolicy("Suspension review", overdueDays);
    }

    if (overdueDays >= BillingRecoveryReadOnlyGracePeriodDays) {
      return new TenantBillingRecoveryPolicy("Read-only recommended", overdueDays);
    }

    return new TenantBillingRecoveryPolicy("Past due", overdueDays);
  }

  private static DateTime? ResolveTenantNextRenewalDateUtc(IReadOnlyList<TenantBillingRecord> billingRecords) {
    var latestConfirmedCoverage = billingRecords
        .Where(entity => string.Equals(entity.Status, "Confirmed", StringComparison.OrdinalIgnoreCase))
        .OrderByDescending(entity => entity.CoverageEndUtc)
        .ThenByDescending(entity => entity.SubmittedAtUtc)
        .FirstOrDefault();
    var futureSubmittedCoverage = billingRecords
        .Where(entity => entity.CoverageStartUtc > (latestConfirmedCoverage?.CoverageEndUtc ?? DateTime.MinValue))
        .OrderByDescending(entity => entity.CoverageStartUtc)
        .FirstOrDefault();

    return futureSubmittedCoverage?.CoverageStartUtc ??
      latestConfirmedCoverage?.CoverageEndUtc;
  }

  private static bool IsTenantBillingRecoveryFailure(
      Tenant tenant,
      TenantBillingRecord? latestBillingRecord,
      DateTime? nextRenewalDateUtc) {
    var utcToday = DateTime.UtcNow.Date;

    return string.Equals(tenant.SubscriptionStatus, "Past due", StringComparison.OrdinalIgnoreCase) ||
      string.Equals(latestBillingRecord?.Status, "Payment failed", StringComparison.OrdinalIgnoreCase) ||
      (nextRenewalDateUtc.HasValue && nextRenewalDateUtc.Value.Date < utcToday);
  }

  private static bool IsTenantSubscriptionRecoverySuspended(Tenant tenant) =>
    string.Equals(tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase) &&
    (string.Equals(tenant.BillingProvider, "Stripe", StringComparison.OrdinalIgnoreCase) ||
      tenant.BillingRecords.Any(entity =>
        string.Equals(entity.Status, "Payment failed", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(entity.Status, "Pending Review", StringComparison.OrdinalIgnoreCase)));

  private static bool IsReadOnlyRequest(HttpRequest request) =>
    HttpMethods.IsGet(request.Method) ||
    HttpMethods.IsHead(request.Method) ||
    HttpMethods.IsOptions(request.Method);

  internal static string NormalizeAssignmentStatus(string? assignmentStatus) {
    var normalized = assignmentStatus?.Trim();
    return string.IsNullOrWhiteSpace(normalized)
        ? "Scheduled"
        : normalized;
  }

  internal static string DeriveServiceStatusFromAssignment(string assignmentStatus) =>
    assignmentStatus switch {
      "Scheduled" => "Scheduled",
      "In Progress" => "In Service",
      "Completed" => "Completed",
      "On Hold" => "On Hold",
      _ => assignmentStatus
    };

  internal static string DeriveFinanceHandoffStatus(
    string serviceStatus,
    bool hasInvoice,
    bool hasMicroLoan,
    decimal? outstandingAmount,
    decimal? interestableAmount,
    string? invoiceStatus) {
    if (hasMicroLoan) {
      return "Loan created";
    }

    if (hasInvoice && string.Equals(invoiceStatus, ServiceInvoiceFinancePolicy.CheckoutPendingStatus, StringComparison.OrdinalIgnoreCase)) {
      return "Customer checkout in progress";
    }

    if (hasInvoice && string.Equals(invoiceStatus, ServiceInvoiceFinancePolicy.PaymentSubmittedStatus, StringComparison.OrdinalIgnoreCase)) {
      return "Direct settlement under review";
    }

    if (hasInvoice && string.Equals(invoiceStatus, ServiceInvoiceFinancePolicy.PartiallyPaidStatus, StringComparison.OrdinalIgnoreCase)) {
      return "Direct settlement in progress";
    }

    if (hasInvoice && string.Equals(invoiceStatus, ServiceInvoiceFinancePolicy.PaidStatus, StringComparison.OrdinalIgnoreCase)) {
      return "Direct settlement completed";
    }

    if (hasInvoice && CanConvertToLoan(hasInvoice, hasMicroLoan, outstandingAmount, interestableAmount, invoiceStatus)) {
      return "Ready for loan conversion";
    }

    if (hasInvoice) {
      return "Invoice finalized";
    }

    if (IsFinanceHandoffNotApplicable(serviceStatus)) {
      return "No finance action";
    }

    return string.Equals(serviceStatus, "Completed", StringComparison.OrdinalIgnoreCase)
        ? "Ready for invoicing"
        : "Awaiting service completion";
  }

  private static bool IsFinanceHandoffNotApplicable(string serviceStatus) =>
    string.Equals(serviceStatus, "Cancelled", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(serviceStatus, "Cancellation Requested", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(serviceStatus, "Abandoned", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(serviceStatus, "Closed", StringComparison.OrdinalIgnoreCase);

  internal static bool CanFinalizeInvoice(string serviceStatus, bool hasInvoice) =>
    !hasInvoice && string.Equals(serviceStatus, "Completed", StringComparison.OrdinalIgnoreCase);

  internal static bool CanConvertToLoan(
    bool hasInvoice,
    bool hasMicroLoan,
    decimal? outstandingAmount,
    decimal? interestableAmount,
    string? invoiceStatus) =>
    ServiceInvoiceFinancePolicy.CanConvertToLoan(
        hasInvoice,
        hasMicroLoan,
        outstandingAmount,
        interestableAmount,
        invoiceStatus);

  internal static TenantServiceRequestRowResponse CreateTenantServiceRequestResponse(
    Guid id,
    Guid customerId,
    string customerCode,
    string customerName,
    string requestNumber,
    string itemType,
    string itemDescription,
    string issueDescription,
    DateTime? requestedServiceDate,
    string serviceMode,
    string serviceAddress,
    string? serviceAddressDetails,
    string contactName,
    string contactPhone,
    DateTime? preferredScheduleStartUtc,
    DateTime? preferredScheduleEndUtc,
    DateTime? neededByUtc,
    string priority,
    string currentStatus,
    DateTime createdAtUtc,
    string createdByUserName,
    int? rating,
    string? feedbackComments,
    string? feedbackSuggestionCategory,
    DateTime? completedAtUtc,
    DateTime? feedbackSubmittedAtUtc,
    DateTime? feedbackExpiresAtUtc,
    DateTime? cancellationRequestedAtUtc,
    DateTime? cancelledAtUtc,
    string? cancellationReason,
    Guid? invoiceId,
    string? invoiceNumber,
    string? invoiceStatus,
    decimal? invoiceTotalAmount,
    decimal? invoiceOutstandingAmount,
    decimal? interestableAmount,
    bool hasMicroLoan) {
    var hasInvoice = invoiceId.HasValue;
    return new TenantServiceRequestRowResponse(
        id,
        customerId,
        customerCode,
        customerName,
        requestNumber,
        itemType,
        itemDescription,
        issueDescription,
        requestedServiceDate,
        serviceMode,
        serviceAddress,
        serviceAddressDetails,
        contactName,
        contactPhone,
        preferredScheduleStartUtc,
        preferredScheduleEndUtc,
        neededByUtc,
        priority,
        currentStatus,
        createdAtUtc,
        createdByUserName,
        rating,
        feedbackComments,
        feedbackSuggestionCategory,
        completedAtUtc,
        feedbackSubmittedAtUtc,
        feedbackExpiresAtUtc,
        cancellationRequestedAtUtc,
        cancelledAtUtc,
        cancellationReason,
        invoiceId,
        invoiceNumber,
        invoiceStatus,
        invoiceTotalAmount,
        invoiceOutstandingAmount,
        interestableAmount,
        DeriveFinanceHandoffStatus(currentStatus, hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount, invoiceStatus),
        CanFinalizeInvoice(currentStatus, hasInvoice),
        CanConvertToLoan(hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount, invoiceStatus),
        hasMicroLoan);
  }

  internal static TenantDispatchAssignmentRowResponse CreateTenantDispatchAssignmentResponse(
    Guid id,
    Guid serviceRequestId,
    string requestNumber,
    string customerName,
    string itemType,
    string priority,
    string serviceStatus,
    Guid assignedUserId,
    string assignedUserName,
    Guid assignedByUserId,
    string assignedByUserName,
    DateTime? scheduledStartUtc,
    DateTime? scheduledEndUtc,
    string assignmentStatus,
    DateTime createdAtUtc,
    string? invoiceNumber,
    string? invoiceStatus,
    decimal? invoiceOutstandingAmount,
    decimal? interestableAmount,
    int scheduleConflictCount,
    bool hasMicroLoan) {
    var hasInvoice = !string.IsNullOrWhiteSpace(invoiceNumber) || !string.IsNullOrWhiteSpace(invoiceStatus);
    return new TenantDispatchAssignmentRowResponse(
        id,
        serviceRequestId,
        requestNumber,
        customerName,
        itemType,
        priority,
        serviceStatus,
        assignedUserId,
        assignedUserName,
        assignedByUserId,
        assignedByUserName,
        scheduledStartUtc,
        scheduledEndUtc,
        assignmentStatus,
        createdAtUtc,
        DeriveFinanceHandoffStatus(serviceStatus, hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount, invoiceStatus),
        invoiceNumber,
        invoiceStatus,
        scheduleConflictCount,
        CanConvertToLoan(hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount, invoiceStatus),
        hasMicroLoan);
  }

  internal static decimal RoundMoney(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);

  internal static decimal CalculateServiceCostLineTotal(decimal quantity, decimal unitPrice) =>
    RoundMoney(quantity * unitPrice);

  internal static decimal CalculateServiceCostSubtotal(IEnumerable<ServiceCostLine> lines) =>
    RoundMoney(lines.Sum(entity => CalculateServiceCostLineTotal(entity.Quantity, entity.UnitPrice)));

  internal static decimal CalculateServiceCostTaxAmount(decimal subtotalAmount, bool isTaxEnabled, decimal taxRate) =>
    !isTaxEnabled || subtotalAmount <= 0m
      ? 0m
      : RoundMoney(subtotalAmount * (taxRate / 100m));

  internal static string NormalizeServiceCostCategory(string? category) {
    var normalized = category?.Trim();
    if (string.IsNullOrWhiteSpace(normalized)) {
      return ServiceCostCategories[0];
    }

    var matchedCategory = ServiceCostCategories.FirstOrDefault(entity =>
        string.Equals(entity, normalized, StringComparison.OrdinalIgnoreCase));

    return matchedCategory ?? ServiceCostCategories[0];
  }

  internal static string BuildInvoiceLineDescription(string name, string? specification) =>
    string.IsNullOrWhiteSpace(specification)
      ? name
      : $"{name} - {specification.Trim()}";

  internal static TenantCostingPolicyResponse CreateTenantCostingPolicyResponse(TenantCostingPolicy policy) =>
    new(
      policy.Id,
      policy.TaxLabel,
      policy.DefaultTaxRate,
      policy.TaxEnabledByDefault,
      policy.UpdatedAtUtc);

  internal static ServiceCostPresetResponse CreateServiceCostPresetResponse(ServiceCostPreset preset) =>
    new(
      preset.Id,
      preset.Category,
      preset.Name,
      preset.DefaultSpecification,
      preset.DefaultQuantity,
      preset.DefaultUnitPrice,
      preset.IsActive,
      preset.SortOrder,
      preset.CreatedAtUtc,
      preset.UpdatedAtUtc);

  internal static ServiceCostLineResponse CreateServiceCostLineResponse(ServiceCostLine line) =>
    new(
      line.Id,
      line.ServiceCostPresetId,
      line.Category,
      line.Name,
      line.Specification,
      line.Quantity,
      line.UnitPrice,
      CalculateServiceCostLineTotal(line.Quantity, line.UnitPrice),
      line.SortOrder);

  internal static ServiceCostSheetResponse CreateServiceCostSheetResponse(ServiceCostSheet sheet) {
    var orderedLines = sheet.Lines
        .OrderBy(entity => entity.SortOrder)
        .ThenBy(entity => entity.CreatedAtUtc)
        .ToList();
    var subtotalAmount = CalculateServiceCostSubtotal(orderedLines);
    var taxAmount = CalculateServiceCostTaxAmount(subtotalAmount, sheet.IsTaxEnabled, sheet.TaxRate);
    return new ServiceCostSheetResponse(
        sheet.Id,
        sheet.Status,
        sheet.IsTaxEnabled,
        sheet.TaxLabel,
        sheet.TaxRate,
        sheet.Notes,
        subtotalAmount,
        taxAmount,
        subtotalAmount + taxAmount,
        sheet.CreatedAtUtc,
        sheet.UpdatedAtUtc,
        sheet.FinalizedAtUtc,
        orderedLines.Select(CreateServiceCostLineResponse).ToList());
  }

  internal static int CountScheduleConflictsInList<T>(
    IReadOnlyList<T> assignments,
    T current,
    Func<T, Guid> assignmentIdSelector,
    Func<T, Guid> assignedUserIdSelector,
    Func<T, string> assignmentStatusSelector,
    Func<T, DateTime?> scheduledStartSelector,
    Func<T, DateTime?> scheduledEndSelector) =>
    assignments.Count(candidate =>
        assignmentIdSelector(candidate) != assignmentIdSelector(current) &&
        assignedUserIdSelector(candidate) == assignedUserIdSelector(current) &&
        IsConflictEligibleStatus(assignmentStatusSelector(candidate)) &&
        IsConflictEligibleStatus(assignmentStatusSelector(current)) &&
        SchedulesOverlap(
            scheduledStartSelector(candidate),
            scheduledEndSelector(candidate),
            scheduledStartSelector(current),
            scheduledEndSelector(current)));

  internal static async Task<int> CountScheduleConflictsAsync(
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    Guid assignedUserId,
    DateTime? scheduledStartUtc,
    DateTime? scheduledEndUtc,
    string assignmentStatus,
    Guid? excludeAssignmentId,
    CancellationToken cancellationToken) {
    if (!HasScheduleWindow(scheduledStartUtc, scheduledEndUtc) || !IsConflictEligibleStatus(assignmentStatus)) {
      return 0;
    }

    var candidates = await dbContext.Assignments
        .AsNoTracking()
        .Where(entity => entity.AssignedUserId == assignedUserId)
        .Where(entity => excludeAssignmentId == null || entity.Id != excludeAssignmentId.Value)
        .Where(entity => entity.AssignmentStatus == "Scheduled" || entity.AssignmentStatus == "In Progress" || entity.AssignmentStatus == "On Hold")
        .Select(entity => new {
          entity.ScheduledStartUtc,
          entity.ScheduledEndUtc
        })
        .ToListAsync(cancellationToken);

    return candidates.Count(entity => SchedulesOverlap(
        entity.ScheduledStartUtc,
        entity.ScheduledEndUtc,
        scheduledStartUtc,
        scheduledEndUtc));
  }

  internal static bool HasScheduleWindow(DateTime? scheduledStartUtc, DateTime? scheduledEndUtc) =>
    scheduledStartUtc.HasValue || scheduledEndUtc.HasValue;

  internal static bool IsConflictEligibleStatus(string assignmentStatus) =>
    assignmentStatus is "Scheduled" or "In Progress" or "On Hold";

  internal static bool ShouldBlockScheduleConflict(
    string assignmentStatus,
    DateTime? scheduledStartUtc,
    DateTime? scheduledEndUtc,
    int scheduleConflictCount) =>
      scheduleConflictCount > 0 &&
      assignmentStatus is "Scheduled" or "In Progress" &&
      scheduledStartUtc.HasValue &&
      scheduledEndUtc.HasValue;

  internal static bool SchedulesOverlap(
    DateTime? leftStartUtc,
    DateTime? leftEndUtc,
    DateTime? rightStartUtc,
    DateTime? rightEndUtc) {
    if (!HasScheduleWindow(leftStartUtc, leftEndUtc) || !HasScheduleWindow(rightStartUtc, rightEndUtc)) {
      return false;
    }

    var normalizedLeftStart = leftStartUtc ?? leftEndUtc!.Value;
    var normalizedLeftEnd = leftEndUtc ?? leftStartUtc!.Value;
    var normalizedRightStart = rightStartUtc ?? rightEndUtc!.Value;
    var normalizedRightEnd = rightEndUtc ?? rightStartUtc!.Value;

    return normalizedLeftStart <= normalizedRightEnd && normalizedRightStart <= normalizedLeftEnd;
  }

  internal static string GenerateReferenceCode(string prefix) =>
    $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}";

  internal static IResult CreateJsonError(int statusCode, string message) =>
    Results.Json(new { error = message }, statusCode: statusCode);

  internal static void WriteRefreshTokenCookie(HttpContext httpContext, string refreshToken, TimeSpan? lifetime = null) {
    var cookieOptions = new CookieOptions {
      HttpOnly = true,
      Secure = httpContext.Request.IsHttps,
      SameSite = SameSiteMode.Strict,
      IsEssential = true
    };

    if (lifetime is not null) {
      cookieOptions.Expires = DateTimeOffset.UtcNow.Add(lifetime.Value);
    }

    httpContext.Response.Cookies.Append("sf_refresh_token", refreshToken, cookieOptions);
  }

  internal static void DeleteRefreshTokenCookie(HttpContext httpContext) =>
    httpContext.Response.Cookies.Delete("sf_refresh_token");

  internal static async Task<IResult> RefreshSessionAsync(
    HttpContext httpContext,
    RefreshSessionRequest? request,
    ISessionTokenService sessionTokenService) {
    var usesCookieSession = request is null || string.IsNullOrWhiteSpace(request.RefreshToken);
    var refreshToken = request?.RefreshToken ?? ReadRefreshTokenCookie(httpContext);
    if (string.IsNullOrWhiteSpace(refreshToken)) {
      return Results.Unauthorized();
    }

    var tokens = await sessionTokenService.RefreshSessionAsync(refreshToken, httpContext.RequestAborted);
    if (tokens is null) {
      if (usesCookieSession) {
        DeleteRefreshTokenCookie(httpContext);
      }

      return Results.Unauthorized();
    }

    if (usesCookieSession) {
      WriteRefreshTokenCookie(httpContext, tokens.RefreshToken);
    }

    var currentUser = sessionTokenService.ReadAccessToken(tokens.AccessToken);
    return currentUser is null
        ? Results.Unauthorized()
        : Results.Ok(new AuthSessionResponse(tokens, currentUser));
  }

  private static bool HasTenantMlsModuleAccess(SubscriptionTier tier, string requiredModuleCode) =>
    IsGrantedModuleAccessLevel(GetTenantModuleAccessLevel(tier, requiredModuleCode));

  private static bool HasTenantSmsModuleAccess(SubscriptionTier tier, string requiredModuleCode) =>
    IsGrantedModuleAccessLevel(GetTenantModuleAccessLevel(tier, requiredModuleCode));

  private static string? GetTenantModuleAccessLevel(SubscriptionTier tier, string requiredModuleCode) {
    var accessLevel = tier.Modules
        .Where(entity => entity.PlatformModule != null && entity.PlatformModule.IsActive)
        .FirstOrDefault(entity => string.Equals(entity.PlatformModule!.Code, requiredModuleCode, StringComparison.OrdinalIgnoreCase))
        ?.AccessLevel;

    return accessLevel;
  }

  internal static bool IsGrantedModuleAccessLevel(string? accessLevel) =>
    GetModuleAccessLevelRank(accessLevel) > 0;

  private static bool HasRequiredModuleAccessLevel(string? accessLevel, string? requiredModuleAccessLevel) {
    if (string.IsNullOrWhiteSpace(requiredModuleAccessLevel)) {
      return IsGrantedModuleAccessLevel(accessLevel);
    }

    return GetModuleAccessLevelRank(accessLevel) >= GetModuleAccessLevelRank(requiredModuleAccessLevel);
  }

  private static int GetModuleAccessLevelRank(string? accessLevel) {
    if (string.IsNullOrWhiteSpace(accessLevel)) {
      return 0;
    }

    var normalized = accessLevel.Trim();
    if (string.Equals(normalized, "Excluded", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(normalized, "None", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(normalized, "Not Included", StringComparison.OrdinalIgnoreCase)) {
      return 0;
    }

    if (string.Equals(normalized, ModuleAccessLevelIncluded, StringComparison.OrdinalIgnoreCase)) {
      return 2;
    }

    return 1;
  }

  private static string GetTenantSmsModuleLabel(string requiredModuleCode) =>
    requiredModuleCode switch {
      SmsModuleCodeServiceIntake => "service intake and customer records",
      SmsModuleCodeStaffAccounts => "staff accounts and role assignment",
      SmsModuleCodeScheduling => "scheduling and dispatch",
      SmsModuleCodeJobUpdates => "job status updates and evidence",
      SmsModuleCodeInvoicing => "invoicing and customer self-service",
      SmsModuleCodeReports => "operational reports",
      SmsModuleCodeWorkforceOverview => "workforce overview",
      SmsModuleCodeSlaEscalations => "SLA escalations",
      SmsModuleCodeFeedbackCrm => "customer feedback CRM",
      SmsModuleCodePartsCostControl => "parts and cost control",
      _ => "requested SMS"
    };

  private static string GetTenantMlsModuleLabel(string requiredModuleCode) =>
    requiredModuleCode switch {
      MlsModuleCodeServiceLinkedLoans => "service-linked loans",
      MlsModuleCodeStandaloneLoans => "standalone loans",
      MlsModuleCodeFinancialRecords => "financial records",
      MlsModuleCodeAmortization => "amortization and payment posting",
      MlsModuleCodeLedgerReports => "ledger and reporting",
      MlsModuleCodeAuditLogs => "audit review",
      MlsModuleCodeCollectionsQueue => "collections queue",
      MlsModuleCodePortfolioRiskDashboard => "portfolio risk dashboard",
      MlsModuleCodeLoanApprovalWorkflow => "loan approval workflow",
      MlsModuleCodeFinancePolicyControl => "finance policy control",
      _ => "requested MLS"
    };

  private static async Task<SubscriptionTier?> ResolveCurrentTierAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Tenant tenant,
      CancellationToken cancellationToken) {
    var tierQuery = dbContext.SubscriptionTiers
        .AsNoTracking()
        .Where(entity => entity.IsActive)
        .Include(entity => entity.Modules)
        .ThenInclude(entity => entity.PlatformModule);

    return await tierQuery.FirstOrDefaultAsync(entity => entity.DisplayName == tenant.SubscriptionPlan, cancellationToken)
        ?? await tierQuery.FirstOrDefaultAsync(
            entity => entity.BusinessSizeSegment == tenant.BusinessSizeSegment &&
                entity.SubscriptionEdition == tenant.SubscriptionEdition,
            cancellationToken);
  }

  internal sealed record TenantBillingRecoveryPolicy(string Stage, int? OverdueDays);
}

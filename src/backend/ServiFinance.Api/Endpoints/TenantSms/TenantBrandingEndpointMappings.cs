namespace ServiFinance.Api.Endpoints.TenantSms;

using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Auth;
using ServiFinance.Api.Services;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantBrandingEndpointMappings {
  private const int DisplayNameMaxLength = 200;
  private const int ColorMaxLength = 20;
  private const int LogoUrlMaxLength = 500;

  public static RouteGroupBuilder MapTenantBrandingEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/branding", GetBrandingAsync);
    tenantApi.MapPut("/branding", UpdateBrandingAsync);
    tenantApi.MapPost("/branding/logo", UploadBrandingLogoAsync)
        .DisableAntiforgery();

    return tenantApi;
  }

  private static async Task<IResult> GetBrandingAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      [FromQuery] string? scope,
      ServiFinanceDbContext dbContext,
      IRolePermissionAuthorizationService rolePermissionAuthorizationService,
      CancellationToken cancellationToken) {
    var scopeError = TryResolveBrandingScope(httpContext, scope, out var workspaceScope);
    if (scopeError is not null) {
      return Results.BadRequest(new { error = scopeError });
    }

    var accessError = await RequireTenantWorkspacePermissionAsync(
      httpContext,
      tenantDomainSlug,
      dbContext,
      rolePermissionAuthorizationService,
      cancellationToken,
      workspaceScope,
      ResolveBrandingPermissionKey(workspaceScope));
    if (accessError is not null) {
      return accessError;
    }

    var tenant = await LoadTenantWithThemeAsync(httpContext, dbContext, tenantDomainSlug, cancellationToken);
    return tenant is null
      ? Results.NotFound()
      : Results.Ok(ToBrandingResponse(tenant));
  }

  private static async Task<IResult> UpdateBrandingAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      [FromQuery] string? scope,
      [FromBody] UpdateTenantBrandingSettingsRequest request,
      ServiFinanceDbContext dbContext,
      IRolePermissionAuthorizationService rolePermissionAuthorizationService,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var scopeError = TryResolveBrandingScope(httpContext, scope, out var workspaceScope);
    if (scopeError is not null) {
      return Results.BadRequest(new { error = scopeError });
    }

    var accessError = await RequireTenantWorkspacePermissionAsync(
      httpContext,
      tenantDomainSlug,
      dbContext,
      rolePermissionAuthorizationService,
      cancellationToken,
      workspaceScope,
      ResolveBrandingPermissionKey(workspaceScope));
    if (accessError is not null) {
      return accessError;
    }

    var validationError = ValidateRequest(request);
    if (validationError is not null) {
      return Results.BadRequest(new { error = validationError });
    }

    var tenant = await LoadTenantWithThemeAsync(httpContext, dbContext, tenantDomainSlug, cancellationToken);
    if (tenant is null) {
      return Results.NotFound();
    }

    tenant.Theme ??= new TenantTheme {
      TenantId = tenant.Id
    };

    tenant.Theme.DisplayName = NormalizeOptional(request.DisplayName);
    tenant.Theme.LogoUrl = NormalizeOptional(request.LogoUrl);
    tenant.Theme.PrimaryColor = NormalizeOptional(request.PrimaryColor);
    tenant.Theme.SecondaryColor = NormalizeOptional(request.SecondaryColor);
    tenant.Theme.HeaderBackgroundColor = NormalizeOptional(request.HeaderBackgroundColor);
    tenant.Theme.PageBackgroundColor = NormalizeOptional(request.PageBackgroundColor);

    if (dbContext.Entry(tenant.Theme).State == EntityState.Detached) {
      dbContext.TenantThemes.Add(tenant.Theme);
    }

    await auditLogService.WriteAsync(
      new AuditLogEntry(
        tenant.Id,
        workspaceScope == PlatformRolePolicy.MlsScope ? "TenantMls" : "TenantSms",
        "System",
        "TenantBrandingUpdated",
        "Success",
        TryGetCurrentUserId(httpContext.User, out var userId) ? userId : null,
        httpContext.User.FindFirstValue(ClaimTypes.Name),
        httpContext.User.FindFirstValue(ClaimTypes.Email),
        "TenantTheme",
        tenant.Theme.Id,
        tenant.DomainSlug,
        $"Tenant branding was updated for the {RolePermissionCatalog.ResolveScopeLabel(workspaceScope)} workspace.",
        httpContext.Connection.RemoteIpAddress?.ToString(),
        ResolveUserAgent(httpContext)),
      cancellationToken);

    return Results.Ok(ToBrandingResponse(tenant));
  }

  private static async Task<IResult> UploadBrandingLogoAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      [FromQuery] string? scope,
      [FromForm] UploadTenantBrandingLogoRequest request,
      ServiFinanceDbContext dbContext,
      IRolePermissionAuthorizationService rolePermissionAuthorizationService,
      IAuditLogService auditLogService,
      IImageUploadService imageUploadService,
      CancellationToken cancellationToken) {
    var scopeError = TryResolveBrandingScope(httpContext, scope, out var workspaceScope);
    if (scopeError is not null) {
      return Results.BadRequest(new { error = scopeError });
    }

    var accessError = await RequireTenantWorkspacePermissionAsync(
      httpContext,
      tenantDomainSlug,
      dbContext,
      rolePermissionAuthorizationService,
      cancellationToken,
      workspaceScope,
      ResolveBrandingPermissionKey(workspaceScope));
    if (accessError is not null) {
      return accessError;
    }

    if (request.LogoFile is null) {
      return Results.BadRequest(new { error = "Select a logo image to upload." });
    }

    if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
      return Results.Unauthorized();
    }

    var tenant = await LoadTenantWithThemeAsync(httpContext, dbContext, tenantDomainSlug, cancellationToken);
    if (tenant is null) {
      return Results.NotFound();
    }

    IReadOnlyList<ImageUploadResult> uploads;
    try {
      uploads = await imageUploadService.UploadBatchAsync(
          [request.LogoFile],
          new ImageUploadContext(
              ImageUploadPurpose.BrandingLogo,
              tenantDomainSlug,
              currentUserId.ToString("N"),
              $"tenant-logo-{tenantDomainSlug}"),
          cancellationToken);
    } catch (ImageUploadException exception) {
      return Results.Json(
          new { error = exception.Message },
          statusCode: exception.StatusCode);
    }

    var upload = uploads[0];
    tenant.Theme ??= new TenantTheme {
      TenantId = tenant.Id
    };
    tenant.Theme.LogoUrl = upload.PublicUrl;

    if (dbContext.Entry(tenant.Theme).State == EntityState.Detached) {
      dbContext.TenantThemes.Add(tenant.Theme);
    }

    await auditLogService.WriteAsync(
      new AuditLogEntry(
        tenant.Id,
        workspaceScope == PlatformRolePolicy.MlsScope ? "TenantMls" : "TenantSms",
        "System",
        "TenantBrandingLogoUploaded",
        "Success",
        currentUserId,
        httpContext.User.FindFirstValue(ClaimTypes.Name),
        httpContext.User.FindFirstValue(ClaimTypes.Email),
        "TenantTheme",
        tenant.Theme.Id,
        tenant.DomainSlug,
        $"Tenant logo was uploaded through ImgBB for the {RolePermissionCatalog.ResolveScopeLabel(workspaceScope)} workspace.",
        httpContext.Connection.RemoteIpAddress?.ToString(),
        ResolveUserAgent(httpContext)),
      cancellationToken);

    return Results.Ok(ToBrandingResponse(tenant));
  }

  private static async Task<Tenant?> LoadTenantWithThemeAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      string tenantDomainSlug,
      CancellationToken cancellationToken) {
    if (!Guid.TryParse(httpContext.User.FindFirstValue("tenant_id"), out var tenantId)) {
      return null;
    }

    return await dbContext.Tenants
        .Include(entity => entity.Theme)
        .SingleOrDefaultAsync(
          entity => entity.Id == tenantId && entity.DomainSlug == tenantDomainSlug,
          cancellationToken);
  }

  private static TenantBrandingSettingsResponse ToBrandingResponse(Tenant tenant) =>
    new(
      tenant.Id,
      tenant.DomainSlug,
      tenant.Name,
      tenant.Theme?.DisplayName,
      tenant.Theme?.LogoUrl,
      tenant.Theme?.PrimaryColor,
      tenant.Theme?.SecondaryColor,
      tenant.Theme?.HeaderBackgroundColor,
      tenant.Theme?.PageBackgroundColor);

  private static string ResolveBrandingScope(HttpContext httpContext, string? scope) {
    if (!string.IsNullOrWhiteSpace(scope)) {
      return RolePermissionCatalog.NormalizeWorkspaceScope(scope);
    }

    var surface = httpContext.User.FindFirstValue("surface");
    return string.Equals(surface, AuthenticationSurface.TenantDesktop.ToString(), StringComparison.OrdinalIgnoreCase)
      ? PlatformRolePolicy.MlsScope
      : PlatformRolePolicy.SmsScope;
  }

  private static string ResolveBrandingPermissionKey(string workspaceScope) =>
    workspaceScope == PlatformRolePolicy.MlsScope
      ? "mls.branding.manage"
      : "sms.branding.manage";

  private static string? TryResolveBrandingScope(HttpContext httpContext, string? scope, out string workspaceScope) {
    try {
      workspaceScope = ResolveBrandingScope(httpContext, scope);
    } catch (InvalidOperationException exception) {
      workspaceScope = PlatformRolePolicy.SmsScope;
      return exception.Message;
    }

    if (workspaceScope != PlatformRolePolicy.SmsScope && workspaceScope != PlatformRolePolicy.MlsScope) {
      return "Tenant branding can only be managed for SMS or MLS workspaces.";
    }

    return null;
  }

  private static string? ValidateRequest(UpdateTenantBrandingSettingsRequest request) {
    if (Exceeds(request.DisplayName, DisplayNameMaxLength)) {
      return "Display name must be 200 characters or fewer.";
    }

    if (Exceeds(request.LogoUrl, LogoUrlMaxLength)) {
      return "Logo URL must be 500 characters or fewer.";
    }

    if (!IsSafeLogoUrl(request.LogoUrl)) {
      return "Logo URL must be a relative path or an HTTP/HTTPS URL.";
    }

    if (Exceeds(request.PrimaryColor, ColorMaxLength) ||
        Exceeds(request.SecondaryColor, ColorMaxLength) ||
        Exceeds(request.HeaderBackgroundColor, ColorMaxLength) ||
        Exceeds(request.PageBackgroundColor, ColorMaxLength)) {
      return "Theme color values must be 20 characters or fewer.";
    }

    return null;
  }

  private static string? NormalizeOptional(string? value) {
    var normalized = value?.Trim();
    return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
  }

  private static bool Exceeds(string? value, int maxLength) =>
    !string.IsNullOrWhiteSpace(value) && value.Trim().Length > maxLength;

  private static bool IsSafeLogoUrl(string? value) {
    var normalized = NormalizeOptional(value);
    if (normalized is null) {
      return true;
    }

    if (normalized.StartsWith("/", StringComparison.Ordinal)) {
      return true;
    }

    return Uri.TryCreate(normalized, UriKind.Absolute, out var uri) &&
        (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
  }

  private static string? ResolveUserAgent(HttpContext httpContext) {
    var userAgent = httpContext.Request.Headers.UserAgent.ToString();
    return string.IsNullOrWhiteSpace(userAgent) ? null : userAgent;
  }
}

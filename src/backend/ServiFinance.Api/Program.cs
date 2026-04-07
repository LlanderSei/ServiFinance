using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auth;
using ServiFinance.Application.Subscriptions;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Extensions;
using Microsoft.IdentityModel.Tokens;

const string ApiAuthenticationSchemes = CookieAuthenticationDefaults.AuthenticationScheme + "," + JwtBearerDefaults.AuthenticationScheme;

var builder = WebApplication.CreateBuilder(args);
var sessionTokenOptions = builder.Configuration.GetSection(SessionTokenOptions.SectionName).Get<SessionTokenOptions>() ?? new SessionTokenOptions();

builder.Services.AddOpenApi();
builder.Services.AddHttpContextAccessor();
builder.Services.AddCors(options => {
  options.AddPolicy("ServiFinanceFrontendClients", policy => {
    policy.SetIsOriginAllowed(origin =>
            IsAllowedFrontendOrigin(origin))
        .AllowAnyHeader()
        .AllowAnyMethod();
  });
});
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options => {
      options.LoginPath = "/";
      options.AccessDeniedPath = "/forbidden";
      options.SlidingExpiration = true;
    })
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options => {
      options.TokenValidationParameters = new TokenValidationParameters {
          ValidateIssuer = true,
          ValidIssuer = sessionTokenOptions.Issuer,
          ValidateAudience = true,
          ValidAudience = sessionTokenOptions.Audience,
          ValidateIssuerSigningKey = true,
          IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(sessionTokenOptions.SigningKey)),
          ValidateLifetime = true,
          ClockSkew = TimeSpan.FromMinutes(1)
      };
});
builder.Services.AddAuthorization();
builder.Services.AddServiFinanceSqlServer(builder.Configuration);

var app = builder.Build();
await app.Services.EnsureServiFinanceDatabaseAsync();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment()) {
  app.UseExceptionHandler("/error", createScopeForErrors: true);
  // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
  app.UseHsts();
  app.UseHttpsRedirection();
}
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.MapOpenApi();

app.UseCors("ServiFinanceFrontendClients");
app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();
MapReactPublicApp(app);
var api = app.MapGroup("/api");
api.MapGet("/health", [AllowAnonymous] () => Results.Ok(new { status = "ok" }));
var authApi = api.MapGroup("/auth");
authApi.MapPost("/root/login", [AllowAnonymous] async Task<IResult> (
    HttpContext httpContext,
    [FromBody] RootApiLoginRequest request,
    IUserAuthenticationService authenticationService,
    ISessionTokenService sessionTokenService) => {
  var user = await authenticationService.AuthenticateAsync(
      new AuthenticationRequest(request.Email, request.Password, AuthenticationSurface.Root),
      httpContext.RequestAborted);
  if (user is null) {
    return Results.Unauthorized();
  }

  var tokens = await sessionTokenService.CreateSessionAsync(user, AuthenticationSurface.Root, request.RememberMe, httpContext.RequestAborted);
  if (request.UseCookieSession) {
    await SignInUserAsync(httpContext, user, request.RememberMe);
    WriteRefreshTokenCookie(httpContext, tokens.RefreshToken, request.RememberMe ? TimeSpan.FromDays(sessionTokenOptions.PersistentRefreshTokenDays) : null);
  }

  return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, AuthenticationSurface.Root)));
});
authApi.MapPost("/tenant/login", [AllowAnonymous] async Task<IResult> (
    HttpContext httpContext,
    [FromBody] TenantApiLoginRequest request,
    IUserAuthenticationService authenticationService,
    ISessionTokenService sessionTokenService) => {
  var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
  var surface = string.Equals(request.TargetSystem, "mls", StringComparison.OrdinalIgnoreCase)
      ? AuthenticationSurface.TenantDesktop
      : AuthenticationSurface.TenantWeb;
  var user = await authenticationService.AuthenticateAsync(
      new AuthenticationRequest(request.Email, request.Password, surface, tenantSlug),
      httpContext.RequestAborted);
  if (user is null) {
    return Results.Unauthorized();
  }

  var tokens = await sessionTokenService.CreateSessionAsync(user, surface, cancellationToken: httpContext.RequestAborted);
  if (request.UseCookieSession) {
    await SignInUserAsync(httpContext, user);
    WriteRefreshTokenCookie(httpContext, tokens.RefreshToken);
  }

  return Results.Ok(new AuthSessionResponse(tokens, ToCurrentSessionUser(user, surface)));
});
authApi.MapGet("/refresh", [AllowAnonymous] async Task<IResult> (
    HttpContext httpContext,
    ISessionTokenService sessionTokenService) =>
    await RefreshSessionAsync(httpContext, null, sessionTokenService));
authApi.MapPost("/refresh", [AllowAnonymous] async Task<IResult> (
    HttpContext httpContext,
    [FromBody] RefreshSessionRequest? request,
    ISessionTokenService sessionTokenService) =>
    await RefreshSessionAsync(httpContext, request, sessionTokenService));
authApi.MapPost("/logout", [AllowAnonymous] async Task<IResult> (
    HttpContext httpContext,
    [FromBody] RefreshSessionRequest? request,
    ISessionTokenService sessionTokenService) => {
  var refreshToken = request?.RefreshToken ?? ReadRefreshTokenCookie(httpContext);
  if (!string.IsNullOrWhiteSpace(refreshToken)) {
    await sessionTokenService.RevokeSessionAsync(refreshToken, httpContext.RequestAborted);
  }

  DeleteRefreshTokenCookie(httpContext);
  await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
  return Results.NoContent();
});
authApi.MapGet("/me", [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)] (ClaimsPrincipal principal) => {
  var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
  var tenantId = Guid.Parse(principal.FindFirstValue("tenant_id")!);
  var tenantDomainSlug = principal.FindFirstValue("tenant_domain_slug") ?? string.Empty;
  var fullName = principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
  var email = principal.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
  _ = Enum.TryParse<AuthenticationSurface>(principal.FindFirstValue("surface"), true, out var surface);
  var roles = principal.FindAll(ClaimTypes.Role).Select(claim => claim.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

  return Results.Ok(new CurrentSessionUser(userId, tenantId, tenantDomainSlug, email, fullName, roles, surface));
});
api.MapGet("/catalog/subscription-tiers", [AllowAnonymous] async Task<IResult> (
    ISubscriptionTierCatalogService subscriptionTierCatalogService,
    CancellationToken cancellationToken) =>
    Results.Ok(await subscriptionTierCatalogService.GetActiveTiersAsync(cancellationToken)));
var superadminApi = api.MapGroup("/superadmin").RequireAuthorization(new AuthorizeAttribute {
    Roles = "SuperAdmin",
    AuthenticationSchemes = ApiAuthenticationSchemes
});
superadminApi.MapGet("/tenants", async Task<IResult> (
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  var tenants = await dbContext.Tenants
      .IgnoreQueryFilters()
      .AsNoTracking()
      .OrderBy(entity => entity.Name)
      .Select(entity => new {
          entity.Id,
          entity.Name,
          entity.Code,
          entity.DomainSlug,
          entity.BusinessSizeSegment,
          entity.SubscriptionEdition,
          entity.SubscriptionPlan,
          entity.SubscriptionStatus,
          entity.IsActive
      })
      .ToListAsync(cancellationToken);

  return Results.Ok(tenants);
});
var tenantApi = api.MapGroup("/tenants/{tenantDomainSlug}").RequireAuthorization(new AuthorizeAttribute {
    AuthenticationSchemes = ApiAuthenticationSchemes
});
tenantApi.MapGet("/sms/users", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    IUserManagementService userManagementService,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  return Results.Ok(await userManagementService.GetUsersAsync(cancellationToken));
});
tenantApi.MapGet("/sms/roles", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    IUserManagementService userManagementService,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  return Results.Ok(await userManagementService.GetRolesAsync(cancellationToken));
});
tenantApi.MapPost("/sms/users", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    [FromBody] CreateUserRequest request,
    IUserManagementService userManagementService,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  try {
    return Results.Ok(await userManagementService.CreateUserAsync(request, cancellationToken));
  } catch (InvalidOperationException exception) {
    return Results.BadRequest(new { error = exception.Message });
  }
});
tenantApi.MapPost("/sms/users/{userId:guid}/toggle", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    Guid userId,
    [FromBody] ToggleUserStateRequest request,
    IUserManagementService userManagementService,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  await userManagementService.SetUserActiveStateAsync(userId, request.IsActive, cancellationToken);
  return Results.NoContent();
});
app.MapPost("/account/root-login", [AllowAnonymous] async Task<IResult> (
    HttpContext httpContext,
    [FromForm] RootLoginRequest request,
    IUserAuthenticationService authenticationService) => {
  var user = await authenticationService.AuthenticateAsync(
      new AuthenticationRequest(
          request.Email,
          request.Password,
          AuthenticationSurface.Root),
      httpContext.RequestAborted);
  var returnUrl = SanitizeReturnUrl(request.ReturnUrl);

  if (user is null) {
    return Results.LocalRedirect($"/?error=Invalid%20superadmin%20email%20or%20password&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
  }

  await SignInUserAsync(httpContext, user, request.RememberMe);

  return Results.LocalRedirect(returnUrl);
});
app.MapPost("/account/tenant-login", [AllowAnonymous] async Task<IResult> (
    HttpContext httpContext,
    [FromForm] TenantLoginRequest request,
    IUserAuthenticationService authenticationService) => {
  var isMls = string.Equals(request.TargetSystem, "mls", StringComparison.OrdinalIgnoreCase);
  var surface = isMls ? AuthenticationSurface.TenantDesktop : AuthenticationSurface.TenantWeb;
  var tenantSlug = NormalizeTenantSlug(request.TenantDomainSlug);
  var user = await authenticationService.AuthenticateAsync(
      new AuthenticationRequest(
          request.Email,
          request.Password,
          surface,
          tenantSlug),
      httpContext.RequestAborted);
  var fallbackUrl = isMls
      ? $"/t/{tenantSlug}/mls/dashboard"
      : $"/t/{tenantSlug}/sms/dashboard";
  var returnUrl = SanitizeReturnUrl(request.ReturnUrl, fallbackUrl);

  if (user is null) {
    var loginUrl = isMls
        ? $"/t/{tenantSlug}/mls/"
        : $"/t/{tenantSlug}/sms/";
    return Results.LocalRedirect($"{loginUrl}?error=Invalid%20tenant%20email%20or%20password&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
  }

  await SignInUserAsync(httpContext, user);
  return Results.LocalRedirect(returnUrl);
});
app.MapPost("/account/logout", async Task<IResult> (HttpContext httpContext, [FromForm] string? returnUrl) => {
  await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
  return Results.LocalRedirect(SanitizeReturnUrl(returnUrl, "/"));
});

app.Run();

static bool IsAllowedFrontendOrigin(string origin) {
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

static void MapReactPublicApp(WebApplication app) {
  var distRoot = Path.GetFullPath(Path.Combine(
      app.Environment.ContentRootPath,
      "..",
      "..",
      "frontend",
      "ServiFinance.Frontend",
      "dist"));
  var assetsRoot = Path.Combine(distRoot, "assets");
  var desktopBridgeScript = Path.Combine(distRoot, "desktop-shell-bridge.js");
  var faviconSvg = Path.Combine(distRoot, "favicon.svg");
  var faviconIco = Path.Combine(distRoot, "favicon.ico");
  if (!File.Exists(Path.Combine(distRoot, "index.html"))) {
    return;
  }

  app.MapGet("/", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/register", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/dashboard", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/tenants", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/subscriptions", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/forbidden", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/error", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/not-found", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms/", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms/dashboard", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms/users", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/mls", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/mls/", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/mls/dashboard", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/favicon.svg", () => File.Exists(faviconSvg)
      ? Results.File(faviconSvg, "image/svg+xml")
      : Results.NotFound());
  app.MapGet("/favicon.ico", () => File.Exists(faviconIco)
      ? Results.File(faviconIco, "image/x-icon")
      : Results.Redirect("/favicon.svg"));
  app.MapGet("/_framework/hybridwebview.js", () => Results.Text("window.HybridWebView = window.HybridWebView || {};", "application/javascript"));
  app.MapGet("/desktop-shell-bridge.js", () => File.Exists(desktopBridgeScript)
      ? Results.File(desktopBridgeScript, "application/javascript")
      : Results.NotFound());
  app.MapGet("/assets/{**assetPath}", (string assetPath) => {
    var fullPath = Path.GetFullPath(Path.Combine(assetsRoot, assetPath));
    if (!fullPath.StartsWith(Path.GetFullPath(assetsRoot), StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath)) {
      return (IResult)Results.NotFound();
    }

    var contentTypeProvider = new FileExtensionContentTypeProvider();
    if (!contentTypeProvider.TryGetContentType(fullPath, out var contentType)) {
      contentType = "application/octet-stream";
    }

    return Results.File(fullPath, contentType);
  });
}

static CurrentSessionUser ToCurrentSessionUser(AuthenticatedUser user, AuthenticationSurface surface) =>
    new(user.UserId, user.TenantId, user.TenantDomainSlug, user.Email, user.FullName, user.Roles, surface);

static string SanitizeReturnUrl(string? returnUrl, string fallbackPath = "/dashboard") {
  if (string.IsNullOrWhiteSpace(returnUrl)) {
    return fallbackPath;
  }

  return Uri.TryCreate(returnUrl, UriKind.Relative, out var relativeUri)
      ? relativeUri.ToString()
      : fallbackPath;
}

static async Task SignInUserAsync(HttpContext httpContext, AuthenticatedUser user, bool isPersistent = false) {
  var claims = new List<Claim> {
      new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
      new(ClaimTypes.Name, user.FullName),
      new(ClaimTypes.Email, user.Email),
      new("tenant_id", user.TenantId.ToString()),
      new("tenant_domain_slug", user.TenantDomainSlug)
  };

  claims.AddRange(user.Roles.Select(role => new Claim(ClaimTypes.Role, role)));

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

static string NormalizeTenantSlug(string tenantSlug) => tenantSlug.Trim().ToLowerInvariant();

static string? ReadRefreshTokenCookie(HttpContext httpContext) =>
    httpContext.Request.Cookies.TryGetValue("sf_refresh_token", out var refreshToken)
        ? refreshToken
        : null;

static bool IsTenantRouteAllowed(ClaimsPrincipal principal, string tenantDomainSlug) =>
    string.Equals(principal.FindFirstValue("tenant_domain_slug"), tenantDomainSlug, StringComparison.OrdinalIgnoreCase);

static void WriteRefreshTokenCookie(HttpContext httpContext, string refreshToken, TimeSpan? lifetime = null) {
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

static void DeleteRefreshTokenCookie(HttpContext httpContext) =>
    httpContext.Response.Cookies.Delete("sf_refresh_token");

static async Task<IResult> RefreshSessionAsync(
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

internal sealed record RootLoginRequest(string Email, string Password, bool RememberMe, string? ReturnUrl);
internal sealed record TenantLoginRequest(string Email, string Password, string TenantDomainSlug, string TargetSystem, string? ReturnUrl);
internal sealed record ToggleUserStateRequest(bool IsActive);


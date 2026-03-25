using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiFinance.Infrastructure.Auth;
using ServiFinance.Infrastructure.Extensions;
using ServiFinance.Shared.Services;
using ServiFinance.Web.Components;
using ServiFinance.Web.Components.Layout;
using ServiFinance.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddCascadingAuthenticationState();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options => {
      options.LoginPath = "/";
      options.AccessDeniedPath = "/forbidden";
      options.SlidingExpiration = true;
    });
builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<PageChromeState>();
builder.Services.AddScoped<ThemeState>();

// Add device-specific services used by the ServiFinance.Shared project
builder.Services.AddSingleton<IFormFactor, FormFactor>();
builder.Services.AddServiFinanceSqlServer(builder.Configuration);

var app = builder.Build();
await app.Services.EnsureServiFinanceDatabaseAsync();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment()) {
  app.UseExceptionHandler("/Error", createScopeForErrors: true);
  // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
  app.UseHsts();
}
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

app.MapStaticAssets();
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
      ? $"/{tenantSlug}/mls/dashboard"
      : $"/{tenantSlug}/sms/dashboard";
  var returnUrl = SanitizeReturnUrl(request.ReturnUrl, fallbackUrl);

  if (user is null) {
    var loginUrl = isMls
        ? $"/{tenantSlug}/mls/"
        : $"/{tenantSlug}/sms/";
    return Results.LocalRedirect($"{loginUrl}?error=Invalid%20tenant%20email%20or%20password&returnUrl={Uri.EscapeDataString(returnUrl)}&showLogin=true");
  }

  await SignInUserAsync(httpContext, user);
  return Results.LocalRedirect(returnUrl);
});
app.MapPost("/account/logout", async Task<IResult> (HttpContext httpContext, [FromForm] string? returnUrl) => {
  await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
  return Results.LocalRedirect(SanitizeReturnUrl(returnUrl, "/"));
});

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();

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

internal sealed record RootLoginRequest(string Email, string Password, bool RememberMe, string? ReturnUrl);
internal sealed record TenantLoginRequest(string Email, string Password, string TenantDomainSlug, string TargetSystem, string? ReturnUrl);

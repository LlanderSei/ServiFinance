using System.Diagnostics;
using System.Reflection;
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
superadminApi.MapGet("/overview", async Task<IResult> (
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  var tenantQuery = dbContext.Tenants
      .IgnoreQueryFilters()
      .AsNoTracking()
      .Where(entity => entity.Id != ServiFinanceDatabaseDefaults.PlatformTenantId);

  var totalTenants = await tenantQuery.CountAsync(cancellationToken);
  var activeTenants = await tenantQuery.CountAsync(entity => entity.IsActive, cancellationToken);
  var suspendedTenants = totalTenants - activeTenants;
  var recentTenants = await tenantQuery
      .OrderByDescending(entity => entity.CreatedAtUtc)
      .Take(6)
      .Select(entity => new {
          entity.Id,
          entity.Name,
          entity.DomainSlug,
          entity.BusinessSizeSegment,
          entity.SubscriptionEdition,
          entity.SubscriptionStatus,
          entity.CreatedAtUtc
      })
      .ToListAsync(cancellationToken);
  var subscriptionMix = await tenantQuery
      .GroupBy(entity => new { entity.BusinessSizeSegment, entity.SubscriptionEdition })
      .Select(group => new {
          group.Key.BusinessSizeSegment,
          group.Key.SubscriptionEdition,
          Count = group.Count()
      })
      .OrderBy(item => item.BusinessSizeSegment)
      .ThenBy(item => item.SubscriptionEdition)
      .ToListAsync(cancellationToken);
  var inactiveTierCount = await dbContext.SubscriptionTiers
      .IgnoreQueryFilters()
      .CountAsync(entity => !entity.IsActive, cancellationToken);
  var inactiveModuleCount = await dbContext.PlatformModules
      .IgnoreQueryFilters()
      .CountAsync(entity => !entity.IsActive, cancellationToken);

  var warnings = new List<object>();
  if (suspendedTenants > 0) {
    warnings.Add(new {
        Code = "suspended-tenants",
        Severity = "Warning",
        Title = "Suspended tenants need review",
        Message = $"{suspendedTenants} tenant account(s) are currently suspended."
    });
  }

  if (inactiveTierCount > 0) {
    warnings.Add(new {
        Code = "inactive-tiers",
        Severity = "Info",
        Title = "Catalog contains inactive tiers",
        Message = $"{inactiveTierCount} subscription tier(s) are currently inactive."
    });
  }

  if (inactiveModuleCount > 0) {
    warnings.Add(new {
        Code = "inactive-modules",
        Severity = "Info",
        Title = "Catalog contains inactive modules",
        Message = $"{inactiveModuleCount} platform module(s) are currently inactive."
    });
  }

  return Results.Ok(new {
      Summary = new {
          TotalTenants = totalTenants,
          ActiveTenants = activeTenants,
          SuspendedTenants = suspendedTenants,
          StandardTenants = subscriptionMix.Where(item => item.SubscriptionEdition == "Standard").Sum(item => item.Count),
          PremiumTenants = subscriptionMix.Where(item => item.SubscriptionEdition == "Premium").Sum(item => item.Count)
      },
      SubscriptionMix = subscriptionMix,
      RecentTenants = recentTenants,
      Warnings = warnings
  });
});
superadminApi.MapGet("/system-health", async Task<IResult> (
    IWebHostEnvironment environment,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
  var appliedMigrations = await dbContext.Database.GetAppliedMigrationsAsync(cancellationToken);
  var pendingMigrations = await dbContext.Database.GetPendingMigrationsAsync(cancellationToken);
  var buildPath = Assembly.GetExecutingAssembly().Location;
  var buildTimestampUtc = File.Exists(buildPath)
      ? File.GetLastWriteTimeUtc(buildPath)
      : DateTime.UtcNow;
  var processStartUtc = Process.GetCurrentProcess().StartTime.ToUniversalTime();
  var activeTierCount = await dbContext.SubscriptionTiers.IgnoreQueryFilters().CountAsync(entity => entity.IsActive, cancellationToken);
  var inactiveTierCount = await dbContext.SubscriptionTiers.IgnoreQueryFilters().CountAsync(entity => !entity.IsActive, cancellationToken);
  var activeModuleCount = await dbContext.PlatformModules.IgnoreQueryFilters().CountAsync(entity => entity.IsActive, cancellationToken);
  var inactiveModuleCount = await dbContext.PlatformModules.IgnoreQueryFilters().CountAsync(entity => !entity.IsActive, cancellationToken);

  var warnings = new List<object>();
  if (!canConnect) {
    warnings.Add(new {
        Code = "database-offline",
        Severity = "Critical",
        Title = "Database connectivity failed",
        Message = "The API cannot connect to the configured SQL Server database."
    });
  }

  if (pendingMigrations.Any()) {
    warnings.Add(new {
        Code = "pending-migrations",
        Severity = "Warning",
        Title = "Database has pending migrations",
        Message = $"{pendingMigrations.Count()} migration(s) are pending application."
    });
  }

  if (inactiveModuleCount > 0) {
    warnings.Add(new {
        Code = "inactive-catalog-modules",
        Severity = "Info",
        Title = "Catalog contains inactive modules",
        Message = $"{inactiveModuleCount} module(s) are disabled at catalog level."
    });
  }

  return Results.Ok(new {
      Api = new {
          Status = "Healthy",
          Environment = environment.EnvironmentName,
          Version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0",
          StartedAtUtc = processStartUtc,
          UptimeMinutes = Math.Max(0, (int)Math.Floor((DateTime.UtcNow - processStartUtc).TotalMinutes)),
          BuildTimestampUtc = buildTimestampUtc
      },
      Database = new {
          Status = canConnect && !pendingMigrations.Any() ? "Healthy" : canConnect ? "Warning" : "Offline",
          CanConnect = canConnect,
          AppliedMigrationCount = appliedMigrations.Count(),
          PendingMigrationCount = pendingMigrations.Count(),
          LatestAppliedMigration = appliedMigrations.LastOrDefault() ?? "None"
      },
      Catalog = new {
          ActiveTierCount = activeTierCount,
          InactiveTierCount = inactiveTierCount,
          ActiveModuleCount = activeModuleCount,
          InactiveModuleCount = inactiveModuleCount
      },
      Queues = new {
          Status = "Idle",
          Summary = "No background queue worker is configured in the current host."
      },
      Hybrid = new {
          Status = "Healthy",
          Summary = "Desktop bridge assets are mapped for hybrid shell scenarios."
      },
      Warnings = warnings
  });
});
superadminApi.MapGet("/tenants", async Task<IResult> (
    string? segment,
    string? edition,
    string? status,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  var tenantQuery = dbContext.Tenants
      .IgnoreQueryFilters()
      .AsNoTracking()
      .Where(entity => entity.Id != ServiFinanceDatabaseDefaults.PlatformTenantId);

  if (!string.IsNullOrWhiteSpace(segment)) {
    tenantQuery = tenantQuery.Where(entity => entity.BusinessSizeSegment == segment);
  }

  if (!string.IsNullOrWhiteSpace(edition)) {
    tenantQuery = tenantQuery.Where(entity => entity.SubscriptionEdition == edition);
  }

  if (!string.IsNullOrWhiteSpace(status)) {
    if (string.Equals(status, "active", StringComparison.OrdinalIgnoreCase)) {
      tenantQuery = tenantQuery.Where(entity => entity.IsActive);
    }
    else if (string.Equals(status, "suspended", StringComparison.OrdinalIgnoreCase)) {
      tenantQuery = tenantQuery.Where(entity => !entity.IsActive);
    }
    else {
      tenantQuery = tenantQuery.Where(entity => entity.SubscriptionStatus == status);
    }
  }

  var tenants = await tenantQuery
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
          entity.CreatedAtUtc,
          entity.IsActive
      })
      .ToListAsync(cancellationToken);

  return Results.Ok(tenants);
});
superadminApi.MapPost("/tenants/{tenantId:guid}/status", async Task<IResult> (
    Guid tenantId,
    [FromBody] ToggleTenantStateRequest request,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (tenantId == ServiFinanceDatabaseDefaults.PlatformTenantId) {
    return Results.BadRequest(new { error = "The platform tenant cannot be modified from tenant operations." });
  }

  var tenant = await dbContext.Tenants
      .IgnoreQueryFilters()
      .SingleOrDefaultAsync(entity => entity.Id == tenantId, cancellationToken);
  if (tenant is null) {
    return Results.NotFound();
  }

  tenant.IsActive = request.IsActive;
  tenant.SubscriptionStatus = request.IsActive ? "Active" : "Suspended";
  await dbContext.SaveChangesAsync(cancellationToken);

  return Results.Ok(new {
      tenant.Id,
      tenant.Name,
      tenant.Code,
      tenant.DomainSlug,
      tenant.BusinessSizeSegment,
      tenant.SubscriptionEdition,
      tenant.SubscriptionPlan,
      tenant.SubscriptionStatus,
      tenant.CreatedAtUtc,
      tenant.IsActive
  });
});
superadminApi.MapGet("/modules", async Task<IResult> (
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  var modules = await dbContext.PlatformModules
      .IgnoreQueryFilters()
      .AsNoTracking()
      .OrderBy(entity => entity.Channel)
      .ThenBy(entity => entity.SortOrder)
      .ThenBy(entity => entity.Name)
      .Select(entity => new {
          entity.Id,
          entity.Code,
          entity.Name,
          entity.Channel,
          entity.Summary,
          AssignedTierCount = entity.TierAssignments.Count,
          entity.IsActive
      })
      .ToListAsync(cancellationToken);

  return Results.Ok(modules);
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
tenantApi.MapGet("/sms/customers", async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  var customers = await dbContext.Customers
      .AsNoTracking()
      .OrderBy(entity => entity.FullName)
      .Select(entity => new {
          entity.Id,
          entity.CustomerCode,
          entity.FullName,
          entity.MobileNumber,
          entity.Email,
          entity.Address,
          entity.CreatedAtUtc,
          ServiceRequestCount = entity.ServiceRequests.Count
      })
      .ToListAsync(cancellationToken);

  return Results.Ok(customers);
});
tenantApi.MapPost("/sms/customers", async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    [FromBody] CreateCustomerRecordRequest request,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  if (string.IsNullOrWhiteSpace(request.FullName)) {
    return Results.BadRequest(new { error = "Customer full name is required." });
  }

  var customer = new ServiFinance.Domain.Customer {
      CustomerCode = GenerateReferenceCode("CUS"),
      FullName = request.FullName.Trim(),
      MobileNumber = request.MobileNumber.Trim(),
      Email = request.Email.Trim(),
      Address = request.Address.Trim(),
      CreatedAtUtc = DateTime.UtcNow
  };

  dbContext.Customers.Add(customer);
  await dbContext.SaveChangesAsync(cancellationToken);

  return Results.Ok(new {
      customer.Id,
      customer.CustomerCode,
      customer.FullName,
      customer.MobileNumber,
      customer.Email,
      customer.Address,
      customer.CreatedAtUtc,
      ServiceRequestCount = 0
  });
});
tenantApi.MapGet("/sms/service-requests", async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  var serviceRequests = await dbContext.ServiceRequests
      .AsNoTracking()
      .OrderByDescending(entity => entity.CreatedAtUtc)
      .Select(entity => new {
          entity.Id,
          entity.CustomerId,
          CustomerCode = entity.Customer!.CustomerCode,
          CustomerName = entity.Customer!.FullName,
          entity.RequestNumber,
          entity.ItemType,
          entity.ItemDescription,
          entity.IssueDescription,
          entity.RequestedServiceDate,
          entity.Priority,
          entity.CurrentStatus,
          entity.CreatedAtUtc,
          CreatedByUserName = entity.CreatedByUser!.FullName,
          InvoiceId = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (Guid?) invoice.Id)
              .FirstOrDefault(),
          InvoiceNumber = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => invoice.InvoiceNumber)
              .FirstOrDefault(),
          InvoiceStatus = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => invoice.InvoiceStatus)
              .FirstOrDefault(),
          InvoiceTotalAmount = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (decimal?) invoice.TotalAmount)
              .FirstOrDefault(),
          InvoiceOutstandingAmount = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (decimal?) invoice.OutstandingAmount)
              .FirstOrDefault(),
          InterestableAmount = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (decimal?) invoice.InterestableAmount)
              .FirstOrDefault(),
          HasMicroLoan = entity.Invoices.Any(invoice => invoice.MicroLoan != null)
      })
      .ToListAsync(cancellationToken);

  return Results.Ok(serviceRequests.Select(entity => CreateTenantServiceRequestResponse(
      entity.Id,
      entity.CustomerId,
      entity.CustomerCode,
      entity.CustomerName,
      entity.RequestNumber,
      entity.ItemType,
      entity.ItemDescription,
      entity.IssueDescription,
      entity.RequestedServiceDate,
      entity.Priority,
      entity.CurrentStatus,
      entity.CreatedAtUtc,
      entity.CreatedByUserName,
      entity.InvoiceId,
      entity.InvoiceNumber,
      entity.InvoiceStatus,
      entity.InvoiceTotalAmount,
      entity.InvoiceOutstandingAmount,
      entity.InterestableAmount,
      entity.HasMicroLoan)));
});
tenantApi.MapGet("/sms/service-requests/{serviceRequestId:guid}/details", async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    Guid serviceRequestId,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  var serviceRequest = await dbContext.ServiceRequests
      .AsNoTracking()
      .Where(entity => entity.Id == serviceRequestId)
      .Select(entity => new {
          entity.Id,
          entity.CustomerId,
          CustomerCode = entity.Customer!.CustomerCode,
          CustomerName = entity.Customer!.FullName,
          entity.RequestNumber,
          entity.ItemType,
          entity.ItemDescription,
          entity.IssueDescription,
          entity.RequestedServiceDate,
          entity.Priority,
          entity.CurrentStatus,
          entity.CreatedAtUtc,
          CreatedByUserName = entity.CreatedByUser!.FullName,
          InvoiceId = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (Guid?) invoice.Id)
              .FirstOrDefault(),
          InvoiceNumber = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => invoice.InvoiceNumber)
              .FirstOrDefault(),
          InvoiceStatus = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => invoice.InvoiceStatus)
              .FirstOrDefault(),
          InvoiceTotalAmount = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (decimal?) invoice.TotalAmount)
              .FirstOrDefault(),
          InvoiceOutstandingAmount = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (decimal?) invoice.OutstandingAmount)
              .FirstOrDefault(),
          InterestableAmount = entity.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (decimal?) invoice.InterestableAmount)
              .FirstOrDefault(),
          HasMicroLoan = entity.Invoices.Any(invoice => invoice.MicroLoan != null)
      })
      .SingleOrDefaultAsync(cancellationToken);
  if (serviceRequest is null) {
    return Results.NotFound();
  }

  var auditTrail = await dbContext.StatusLogs
      .AsNoTracking()
      .Where(entity => entity.ServiceRequestId == serviceRequestId)
      .OrderByDescending(entity => entity.ChangedAtUtc)
      .Select(entity => new TenantServiceRequestAuditRowResponse(
          entity.Id,
          entity.Status,
          entity.Remarks,
          entity.ChangedByUser!.FullName,
          entity.ChangedAtUtc))
      .ToListAsync(cancellationToken);

  return Results.Ok(new TenantServiceRequestDetailResponse(
      CreateTenantServiceRequestResponse(
          serviceRequest.Id,
          serviceRequest.CustomerId,
          serviceRequest.CustomerCode,
          serviceRequest.CustomerName,
          serviceRequest.RequestNumber,
          serviceRequest.ItemType,
          serviceRequest.ItemDescription,
          serviceRequest.IssueDescription,
          serviceRequest.RequestedServiceDate,
          serviceRequest.Priority,
          serviceRequest.CurrentStatus,
          serviceRequest.CreatedAtUtc,
          serviceRequest.CreatedByUserName,
          serviceRequest.InvoiceId,
          serviceRequest.InvoiceNumber,
          serviceRequest.InvoiceStatus,
          serviceRequest.InvoiceTotalAmount,
          serviceRequest.InvoiceOutstandingAmount,
          serviceRequest.InterestableAmount,
          serviceRequest.HasMicroLoan),
      auditTrail));
});
tenantApi.MapPost("/sms/service-requests", async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    [FromBody] CreateServiceRequestRecordRequest request,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  if (request.CustomerId == Guid.Empty) {
    return Results.BadRequest(new { error = "A customer must be selected." });
  }

  if (string.IsNullOrWhiteSpace(request.ItemType) || string.IsNullOrWhiteSpace(request.IssueDescription)) {
    return Results.BadRequest(new { error = "Item type and issue description are required." });
  }

  var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
  if (!Guid.TryParse(userId, out var createdByUserId)) {
    return Results.Unauthorized();
  }

  var customer = await dbContext.Customers
      .AsNoTracking()
      .SingleOrDefaultAsync(entity => entity.Id == request.CustomerId, cancellationToken);
  if (customer is null) {
    return Results.BadRequest(new { error = "The selected customer was not found." });
  }

  var serviceRequest = new ServiFinance.Domain.ServiceRequest {
      CustomerId = request.CustomerId,
      RequestNumber = GenerateReferenceCode("SR"),
      ItemType = request.ItemType.Trim(),
      ItemDescription = request.ItemDescription.Trim(),
      IssueDescription = request.IssueDescription.Trim(),
      RequestedServiceDate = request.RequestedServiceDate,
      Priority = string.IsNullOrWhiteSpace(request.Priority) ? "Normal" : request.Priority.Trim(),
      CurrentStatus = "New",
      CreatedByUserId = createdByUserId,
      CreatedAtUtc = DateTime.UtcNow
  };

  dbContext.ServiceRequests.Add(serviceRequest);
  dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
      ServiceRequestId = serviceRequest.Id,
      Status = serviceRequest.CurrentStatus,
      Remarks = "Service request created.",
      ChangedByUserId = createdByUserId,
      ChangedAtUtc = DateTime.UtcNow
  });
  await dbContext.SaveChangesAsync(cancellationToken);

  var createdByUserName = await dbContext.Users
      .Where(entity => entity.Id == createdByUserId)
      .Select(entity => entity.FullName)
      .SingleAsync(cancellationToken);

  return Results.Ok(CreateTenantServiceRequestResponse(
      serviceRequest.Id,
      serviceRequest.CustomerId,
      customer.CustomerCode,
      customer.FullName,
      serviceRequest.RequestNumber,
      serviceRequest.ItemType,
      serviceRequest.ItemDescription,
      serviceRequest.IssueDescription,
      serviceRequest.RequestedServiceDate,
      serviceRequest.Priority,
      serviceRequest.CurrentStatus,
      serviceRequest.CreatedAtUtc,
      createdByUserName,
      null,
      null,
      null,
      null,
      null,
      null,
      false));
});
tenantApi.MapPost("/sms/service-requests/{serviceRequestId:guid}/finalize-invoice", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    Guid serviceRequestId,
    [FromBody] FinalizeTenantServiceInvoiceRequest request,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
    return Results.Unauthorized();
  }

  if (request.SubtotalAmount <= 0m) {
    return Results.BadRequest(new { error = "Subtotal amount must be greater than zero." });
  }

  if (request.InterestableAmount < 0m || request.DiscountAmount < 0m) {
    return Results.BadRequest(new { error = "Interestable amount and discount amount cannot be negative." });
  }

  if (request.InterestableAmount > request.SubtotalAmount) {
    return Results.BadRequest(new { error = "Interestable amount cannot exceed the subtotal amount." });
  }

  var serviceRequest = await dbContext.ServiceRequests
      .Include(entity => entity.Customer)
      .Include(entity => entity.Invoices)
          .ThenInclude(entity => entity.MicroLoan)
      .SingleOrDefaultAsync(entity => entity.Id == serviceRequestId, cancellationToken);
  if (serviceRequest is null) {
    return Results.NotFound();
  }

  if (!string.Equals(serviceRequest.CurrentStatus, "Completed", StringComparison.OrdinalIgnoreCase)) {
    return Results.BadRequest(new { error = "Only completed service requests can be finalized into an invoice." });
  }

  if (serviceRequest.Invoices.Any()) {
    return Results.BadRequest(new { error = "This service request already has a finalized invoice." });
  }

  var totalAmount = Math.Max(request.SubtotalAmount - request.DiscountAmount, 0m);
  var invoice = new ServiFinance.Domain.Invoice {
      CustomerId = serviceRequest.CustomerId,
      ServiceRequestId = serviceRequest.Id,
      InvoiceNumber = GenerateReferenceCode("INV"),
      InvoiceDateUtc = DateTime.UtcNow,
      SubtotalAmount = request.SubtotalAmount,
      InterestableAmount = request.InterestableAmount,
      DiscountAmount = request.DiscountAmount,
      TotalAmount = totalAmount,
      OutstandingAmount = totalAmount,
      InvoiceStatus = "Finalized"
  };

  var invoiceLineDescription = string.IsNullOrWhiteSpace(request.Remarks)
      ? $"Service work for {serviceRequest.RequestNumber}"
      : request.Remarks.Trim();

  dbContext.Invoices.Add(invoice);
  dbContext.InvoiceLines.Add(new ServiFinance.Domain.InvoiceLine {
      InvoiceId = invoice.Id,
      Description = invoiceLineDescription,
      Quantity = 1m,
      UnitPrice = request.SubtotalAmount,
      LineTotal = request.SubtotalAmount
  });
  dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
      ServiceRequestId = serviceRequest.Id,
      Status = serviceRequest.CurrentStatus,
      Remarks = $"Invoice {invoice.InvoiceNumber} finalized for service handoff.",
      ChangedByUserId = currentUserId,
      ChangedAtUtc = DateTime.UtcNow
  });

  await dbContext.SaveChangesAsync(cancellationToken);

  var auditTrail = await dbContext.StatusLogs
      .AsNoTracking()
      .Where(entity => entity.ServiceRequestId == serviceRequestId)
      .OrderByDescending(entity => entity.ChangedAtUtc)
      .Select(entity => new TenantServiceRequestAuditRowResponse(
          entity.Id,
          entity.Status,
          entity.Remarks,
          entity.ChangedByUser!.FullName,
          entity.ChangedAtUtc))
      .ToListAsync(cancellationToken);

  return Results.Ok(new TenantServiceRequestDetailResponse(
      CreateTenantServiceRequestResponse(
          serviceRequest.Id,
          serviceRequest.CustomerId,
          serviceRequest.Customer!.CustomerCode,
          serviceRequest.Customer.FullName,
          serviceRequest.RequestNumber,
          serviceRequest.ItemType,
          serviceRequest.ItemDescription,
          serviceRequest.IssueDescription,
          serviceRequest.RequestedServiceDate,
          serviceRequest.Priority,
          serviceRequest.CurrentStatus,
          serviceRequest.CreatedAtUtc,
          await dbContext.Users
              .Where(entity => entity.Id == serviceRequest.CreatedByUserId)
              .Select(entity => entity.FullName)
              .SingleAsync(cancellationToken),
          invoice.Id,
          invoice.InvoiceNumber,
          invoice.InvoiceStatus,
          invoice.TotalAmount,
          invoice.OutstandingAmount,
          invoice.InterestableAmount,
          false),
      auditTrail));
});
tenantApi.MapGet("/sms/dispatch", async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
    return Results.Unauthorized();
  }

  var assignmentQuery = dbContext.Assignments
      .AsNoTracking()
      .Include(entity => entity.ServiceRequest)
          .ThenInclude(entity => entity!.Customer)
      .Include(entity => entity.AssignedUser)
      .Include(entity => entity.AssignedByUser)
      .AsQueryable();

  if (!IsTenantAdministrator(httpContext.User)) {
    assignmentQuery = assignmentQuery.Where(entity => entity.AssignedUserId == currentUserId);
  }

  var assignments = await assignmentQuery
      .OrderByDescending(entity => entity.CreatedAtUtc)
      .Select(entity => new {
          entity.Id,
          entity.ServiceRequestId,
          RequestNumber = entity.ServiceRequest!.RequestNumber,
          CustomerName = entity.ServiceRequest!.Customer!.FullName,
          ItemType = entity.ServiceRequest!.ItemType,
          Priority = entity.ServiceRequest!.Priority,
          ServiceStatus = entity.ServiceRequest!.CurrentStatus,
          entity.AssignedUserId,
          AssignedUserName = entity.AssignedUser!.FullName,
          entity.AssignedByUserId,
          AssignedByUserName = entity.AssignedByUser!.FullName,
          entity.ScheduledStartUtc,
          entity.ScheduledEndUtc,
          entity.AssignmentStatus,
          entity.CreatedAtUtc,
          InvoiceNumber = entity.ServiceRequest!.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => invoice.InvoiceNumber)
              .FirstOrDefault(),
          InvoiceStatus = entity.ServiceRequest.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => invoice.InvoiceStatus)
              .FirstOrDefault(),
          InvoiceOutstandingAmount = entity.ServiceRequest.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (decimal?) invoice.OutstandingAmount)
              .FirstOrDefault(),
          InterestableAmount = entity.ServiceRequest.Invoices
              .OrderByDescending(invoice => invoice.InvoiceDateUtc)
              .Select(invoice => (decimal?) invoice.InterestableAmount)
              .FirstOrDefault(),
          HasMicroLoan = entity.ServiceRequest.Invoices.Any(invoice => invoice.MicroLoan != null)
      })
      .ToListAsync(cancellationToken);

  return Results.Ok(assignments.Select(entity => CreateTenantDispatchAssignmentResponse(
      entity.Id,
      entity.ServiceRequestId,
      entity.RequestNumber,
      entity.CustomerName,
      entity.ItemType,
      entity.Priority,
      entity.ServiceStatus,
      entity.AssignedUserId,
      entity.AssignedUserName,
      entity.AssignedByUserId,
      entity.AssignedByUserName,
      entity.ScheduledStartUtc,
      entity.ScheduledEndUtc,
      entity.AssignmentStatus,
      entity.CreatedAtUtc,
      entity.InvoiceNumber,
      entity.InvoiceStatus,
      entity.InvoiceOutstandingAmount,
      entity.InterestableAmount,
      entity.HasMicroLoan)));
});
tenantApi.MapGet("/sms/dispatch/meta", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  var assignableUsers = await dbContext.Users
      .AsNoTracking()
      .Where(entity => entity.IsActive)
      .OrderBy(entity => entity.FullName)
      .Select(entity => new {
          entity.Id,
          entity.FullName,
          entity.Email,
          Roles = entity.UserRoles.Select(role => role.Role!.Name).ToArray()
      })
      .ToListAsync(cancellationToken);

  var schedulableRequests = await dbContext.ServiceRequests
      .AsNoTracking()
      .Where(entity => entity.CurrentStatus != "Completed")
      .OrderByDescending(entity => entity.CreatedAtUtc)
      .Select(entity => new {
          entity.Id,
          entity.RequestNumber,
          CustomerName = entity.Customer!.FullName,
          entity.ItemType,
          entity.Priority,
          entity.CurrentStatus
      })
      .ToListAsync(cancellationToken);

  return Results.Ok(new {
      AssignableUsers = assignableUsers,
      ServiceRequests = schedulableRequests
  });
});
tenantApi.MapPost("/sms/dispatch", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    [FromBody] CreateTenantAssignmentRequest request,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  if (request.ServiceRequestId == Guid.Empty || request.AssignedUserId == Guid.Empty) {
    return Results.BadRequest(new { error = "A service request and assigned staff member are required." });
  }

  if (!TryGetCurrentUserId(httpContext.User, out var assignedByUserId)) {
    return Results.Unauthorized();
  }

  if (request.ScheduledStartUtc is not null &&
      request.ScheduledEndUtc is not null &&
      request.ScheduledEndUtc < request.ScheduledStartUtc) {
    return Results.BadRequest(new { error = "Scheduled end cannot be earlier than scheduled start." });
  }

  var serviceRequest = await dbContext.ServiceRequests
      .Include(entity => entity.Customer)
      .SingleOrDefaultAsync(entity => entity.Id == request.ServiceRequestId, cancellationToken);
  if (serviceRequest is null) {
    return Results.BadRequest(new { error = "The selected service request was not found." });
  }

  var assignedUser = await dbContext.Users
      .AsNoTracking()
      .SingleOrDefaultAsync(entity => entity.Id == request.AssignedUserId && entity.IsActive, cancellationToken);
  if (assignedUser is null) {
    return Results.BadRequest(new { error = "The selected staff member was not found or is inactive." });
  }

  var assignmentStatus = NormalizeAssignmentStatus(request.AssignmentStatus);
  var serviceStatus = DeriveServiceStatusFromAssignment(assignmentStatus);
  var assignment = new ServiFinance.Domain.Assignment {
      ServiceRequestId = request.ServiceRequestId,
      AssignedUserId = request.AssignedUserId,
      AssignedByUserId = assignedByUserId,
      ScheduledStartUtc = request.ScheduledStartUtc,
      ScheduledEndUtc = request.ScheduledEndUtc,
      AssignmentStatus = assignmentStatus,
      CreatedAtUtc = DateTime.UtcNow
  };

  dbContext.Assignments.Add(assignment);
  serviceRequest.CurrentStatus = serviceStatus;
  dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
      ServiceRequestId = serviceRequest.Id,
      Status = serviceStatus,
      Remarks = $"Assignment scheduled for {assignedUser.FullName}.",
      ChangedByUserId = assignedByUserId,
      ChangedAtUtc = DateTime.UtcNow
  });
  await dbContext.SaveChangesAsync(cancellationToken);

  var assignedByUserName = await dbContext.Users
      .Where(entity => entity.Id == assignedByUserId)
      .Select(entity => entity.FullName)
      .SingleAsync(cancellationToken);

  return Results.Ok(CreateTenantDispatchAssignmentResponse(
      assignment.Id,
      assignment.ServiceRequestId,
      serviceRequest.RequestNumber,
      serviceRequest.Customer!.FullName,
      serviceRequest.ItemType,
      serviceRequest.Priority,
      serviceRequest.CurrentStatus,
      assignment.AssignedUserId,
      assignedUser.FullName,
      assignment.AssignedByUserId,
      assignedByUserName,
      assignment.ScheduledStartUtc,
      assignment.ScheduledEndUtc,
      assignment.AssignmentStatus,
      assignment.CreatedAtUtc,
      null,
      null,
      null,
      null,
      false));
});
tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/status", async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    Guid assignmentId,
    [FromBody] UpdateTenantAssignmentStatusRequest request,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
    return Results.Unauthorized();
  }

  var assignment = await dbContext.Assignments
      .Include(entity => entity.ServiceRequest)
          .ThenInclude(entity => entity!.Customer)
      .Include(entity => entity.ServiceRequest)
          .ThenInclude(entity => entity!.Invoices)
              .ThenInclude(entity => entity.MicroLoan)
      .Include(entity => entity.AssignedUser)
      .Include(entity => entity.AssignedByUser)
      .SingleOrDefaultAsync(entity => entity.Id == assignmentId, cancellationToken);
  if (assignment is null) {
    return Results.NotFound();
  }

  var isAdmin = IsTenantAdministrator(httpContext.User);
  if (!isAdmin && assignment.AssignedUserId != currentUserId) {
    return Results.Forbid();
  }

  var assignmentStatus = NormalizeAssignmentStatus(request.AssignmentStatus);
  var serviceStatus = string.IsNullOrWhiteSpace(request.ServiceStatus)
      ? DeriveServiceStatusFromAssignment(assignmentStatus)
      : request.ServiceStatus.Trim();

  assignment.AssignmentStatus = assignmentStatus;
  assignment.ServiceRequest!.CurrentStatus = serviceStatus;
  dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
      ServiceRequestId = assignment.ServiceRequestId,
      Status = serviceStatus,
      Remarks = string.IsNullOrWhiteSpace(request.Remarks)
          ? $"Assignment moved to {assignmentStatus}."
          : request.Remarks.Trim(),
      ChangedByUserId = currentUserId,
      ChangedAtUtc = DateTime.UtcNow
  });
  await dbContext.SaveChangesAsync(cancellationToken);

  return Results.Ok(CreateTenantDispatchAssignmentResponse(
      assignment.Id,
      assignment.ServiceRequestId,
      assignment.ServiceRequest.RequestNumber,
      assignment.ServiceRequest.Customer!.FullName,
      assignment.ServiceRequest.ItemType,
      assignment.ServiceRequest.Priority,
      assignment.ServiceRequest.CurrentStatus,
      assignment.AssignedUserId,
      assignment.AssignedUser!.FullName,
      assignment.AssignedByUserId,
      assignment.AssignedByUser!.FullName,
      assignment.ScheduledStartUtc,
      assignment.ScheduledEndUtc,
      assignment.AssignmentStatus,
      assignment.CreatedAtUtc,
      assignment.ServiceRequest.Invoices
          .OrderByDescending(invoice => invoice.InvoiceDateUtc)
          .Select(invoice => invoice.InvoiceNumber)
          .FirstOrDefault(),
      assignment.ServiceRequest.Invoices
          .OrderByDescending(invoice => invoice.InvoiceDateUtc)
          .Select(invoice => invoice.InvoiceStatus)
          .FirstOrDefault(),
      assignment.ServiceRequest.Invoices
          .OrderByDescending(invoice => invoice.InvoiceDateUtc)
          .Select(invoice => (decimal?) invoice.OutstandingAmount)
          .FirstOrDefault(),
      assignment.ServiceRequest.Invoices
          .OrderByDescending(invoice => invoice.InvoiceDateUtc)
          .Select(invoice => (decimal?) invoice.InterestableAmount)
          .FirstOrDefault(),
      assignment.ServiceRequest.Invoices.Any(invoice => invoice.MicroLoan != null)));
});
tenantApi.MapGet("/sms/reports/overview", async Task<IResult> (
    HttpContext httpContext,
    string tenantDomainSlug,
    ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
    CancellationToken cancellationToken) => {
  if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
    return Results.Forbid();
  }

  var utcToday = DateTime.UtcNow.Date;
  var utcTomorrow = utcToday.AddDays(1);

  var customerCount = await dbContext.Customers.CountAsync(cancellationToken);
  var serviceRequestCount = await dbContext.ServiceRequests.CountAsync(cancellationToken);
  var activeAssignmentCount = await dbContext.Assignments.CountAsync(
      entity => entity.AssignmentStatus == "Scheduled" || entity.AssignmentStatus == "In Progress" || entity.AssignmentStatus == "On Hold",
      cancellationToken);
  var completedAssignmentCount = await dbContext.Assignments.CountAsync(
      entity => entity.AssignmentStatus == "Completed",
      cancellationToken);

  var dailyActivity = new {
      NewCustomersToday = await dbContext.Customers.CountAsync(
          entity => entity.CreatedAtUtc >= utcToday && entity.CreatedAtUtc < utcTomorrow,
          cancellationToken),
      NewRequestsToday = await dbContext.ServiceRequests.CountAsync(
          entity => entity.CreatedAtUtc >= utcToday && entity.CreatedAtUtc < utcTomorrow,
          cancellationToken),
      AssignmentsScheduledToday = await dbContext.Assignments.CountAsync(
          entity => entity.CreatedAtUtc >= utcToday && entity.CreatedAtUtc < utcTomorrow,
          cancellationToken),
      AssignmentsCompletedToday = await dbContext.Assignments.CountAsync(
          entity => entity.AssignmentStatus == "Completed" &&
              entity.ScheduledEndUtc >= utcToday &&
              entity.ScheduledEndUtc < utcTomorrow,
          cancellationToken)
  };

  var serviceStatusDistribution = await dbContext.ServiceRequests
      .AsNoTracking()
      .GroupBy(entity => entity.CurrentStatus)
      .Select(group => new {
          Status = group.Key,
          Count = group.Count()
      })
      .OrderByDescending(item => item.Count)
      .ThenBy(item => item.Status)
      .ToListAsync(cancellationToken);

  var technicianWorkload = await dbContext.Assignments
      .AsNoTracking()
      .GroupBy(entity => new {
          entity.AssignedUserId,
          FullName = entity.AssignedUser!.FullName
      })
      .Select(group => new {
          UserId = group.Key.AssignedUserId,
          group.Key.FullName,
          ActiveAssignments = group.Count(entity => entity.AssignmentStatus == "In Progress"),
          ScheduledAssignments = group.Count(entity => entity.AssignmentStatus == "Scheduled"),
          CompletedAssignments = group.Count(entity => entity.AssignmentStatus == "Completed")
      })
      .OrderByDescending(item => item.ActiveAssignments)
      .ThenByDescending(item => item.ScheduledAssignments)
      .ThenBy(item => item.FullName)
      .ToListAsync(cancellationToken);

  var catalog = new[] {
      new {
          Key = "daily-activity",
          Title = "Daily Activity Summary",
          Scope = "Customers, intake, and dispatch",
          Freshness = "Live",
          Owner = "Tenant operations",
          Description = "Tracks what entered the tenant workflow today across customer intake, service requests, and dispatch."
      },
      new {
          Key = "service-status-distribution",
          Title = "Service Status Distribution",
          Scope = "Service request register",
          Freshness = "Live",
          Owner = "Service management",
          Description = "Shows how work is distributed across queued, scheduled, in-service, and completed states."
      },
      new {
          Key = "technician-workload",
          Title = "Technician Workload",
          Scope = "Assignment register",
          Freshness = "Live",
          Owner = "Dispatch",
          Description = "Summarizes active, scheduled, and completed assignments per assigned staff member."
      },
      new {
          Key = "throughput-readiness",
          Title = "Throughput Readiness",
          Scope = "Operational snapshot",
          Freshness = "Live",
          Owner = "Business owner",
          Description = "Pairs customer, request, and assignment totals to assess current operating load."
      }
  };

  return Results.Ok(new {
      Catalog = catalog,
      DailyActivity = dailyActivity,
      ServiceStatusDistribution = serviceStatusDistribution,
      TechnicianWorkload = technicianWorkload,
      Totals = new {
          Customers = customerCount,
          ServiceRequests = serviceRequestCount,
          ActiveAssignments = activeAssignmentCount,
          CompletedAssignments = completedAssignmentCount
      }
  });
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
  app.MapGet("/t/{tenantDomainSlug}", (string tenantDomainSlug) =>
      Results.Redirect($"/t/{tenantDomainSlug}/sms/"));
  app.MapGet("/t/{tenantDomainSlug}/sms", (string tenantDomainSlug) =>
      Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms/dashboard", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms/customers", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms/service-requests", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms/dispatch", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms/reports", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/sms/users", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
  app.MapGet("/t/{tenantDomainSlug}/mls", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
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

static bool IsTenantAdministrator(ClaimsPrincipal principal) =>
    principal.IsInRole("Administrator");

static bool TryGetCurrentUserId(ClaimsPrincipal principal, out Guid userId) =>
    Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

static string NormalizeAssignmentStatus(string? assignmentStatus) {
  var normalized = assignmentStatus?.Trim();
  return string.IsNullOrWhiteSpace(normalized)
      ? "Scheduled"
      : normalized;
}

static string DeriveServiceStatusFromAssignment(string assignmentStatus) =>
    assignmentStatus switch {
      "Scheduled" => "Scheduled",
      "In Progress" => "In Service",
      "Completed" => "Completed",
      "On Hold" => "On Hold",
      _ => assignmentStatus
    };

static string DeriveFinanceHandoffStatus(
    string serviceStatus,
    bool hasInvoice,
    bool hasMicroLoan,
    decimal? outstandingAmount,
    decimal? interestableAmount) {
  if (hasMicroLoan) {
    return "Loan created";
  }

  if (hasInvoice && CanConvertToLoan(hasInvoice, hasMicroLoan, outstandingAmount, interestableAmount)) {
    return "Ready for loan conversion";
  }

  if (hasInvoice) {
    return "Invoice finalized";
  }

  return string.Equals(serviceStatus, "Completed", StringComparison.OrdinalIgnoreCase)
      ? "Ready for invoicing"
      : "Awaiting service completion";
}

static bool CanFinalizeInvoice(string serviceStatus, bool hasInvoice) =>
    !hasInvoice && string.Equals(serviceStatus, "Completed", StringComparison.OrdinalIgnoreCase);

static bool CanConvertToLoan(
    bool hasInvoice,
    bool hasMicroLoan,
    decimal? outstandingAmount,
    decimal? interestableAmount) =>
    hasInvoice &&
    !hasMicroLoan &&
    (interestableAmount ?? 0m) > 0m &&
    (outstandingAmount ?? 0m) > 0m;

static TenantServiceRequestRowResponse CreateTenantServiceRequestResponse(
    Guid id,
    Guid customerId,
    string customerCode,
    string customerName,
    string requestNumber,
    string itemType,
    string itemDescription,
    string issueDescription,
    DateTime? requestedServiceDate,
    string priority,
    string currentStatus,
    DateTime createdAtUtc,
    string createdByUserName,
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
      priority,
      currentStatus,
      createdAtUtc,
      createdByUserName,
      invoiceId,
      invoiceNumber,
      invoiceStatus,
      invoiceTotalAmount,
      invoiceOutstandingAmount,
      interestableAmount,
      DeriveFinanceHandoffStatus(currentStatus, hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount),
      CanFinalizeInvoice(currentStatus, hasInvoice),
      CanConvertToLoan(hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount),
      hasMicroLoan);
}

static TenantDispatchAssignmentRowResponse CreateTenantDispatchAssignmentResponse(
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
      DeriveFinanceHandoffStatus(serviceStatus, hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount),
      invoiceNumber,
      invoiceStatus,
      CanConvertToLoan(hasInvoice, hasMicroLoan, invoiceOutstandingAmount, interestableAmount),
      hasMicroLoan);
}

static string GenerateReferenceCode(string prefix) =>
    $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}";

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
internal sealed record ToggleTenantStateRequest(bool IsActive);
internal sealed record CreateCustomerRecordRequest(string FullName, string MobileNumber, string Email, string Address);
internal sealed record CreateServiceRequestRecordRequest(
    Guid CustomerId,
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    DateTime? RequestedServiceDate,
    string Priority);
internal sealed record CreateTenantAssignmentRequest(
    Guid ServiceRequestId,
    Guid AssignedUserId,
    DateTime? ScheduledStartUtc,
    DateTime? ScheduledEndUtc,
    string AssignmentStatus);
internal sealed record UpdateTenantAssignmentStatusRequest(
    string AssignmentStatus,
    string? ServiceStatus,
    string? Remarks);
internal sealed record FinalizeTenantServiceInvoiceRequest(
    decimal SubtotalAmount,
    decimal InterestableAmount,
    decimal DiscountAmount,
    string? Remarks);
internal sealed record TenantServiceRequestRowResponse(
    Guid Id,
    Guid CustomerId,
    string CustomerCode,
    string CustomerName,
    string RequestNumber,
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    DateTime? RequestedServiceDate,
    string Priority,
    string CurrentStatus,
    DateTime CreatedAtUtc,
    string CreatedByUserName,
    Guid? InvoiceId,
    string? InvoiceNumber,
    string? InvoiceStatus,
    decimal? InvoiceTotalAmount,
    decimal? InvoiceOutstandingAmount,
    decimal? InterestableAmount,
    string FinanceHandoffStatus,
    bool CanFinalizeInvoice,
    bool CanConvertToLoan,
    bool HasMicroLoan);
internal sealed record TenantServiceRequestAuditRowResponse(
    Guid Id,
    string Status,
    string Remarks,
    string ChangedByUserName,
    DateTime ChangedAtUtc);
internal sealed record TenantServiceRequestDetailResponse(
    TenantServiceRequestRowResponse ServiceRequest,
    IReadOnlyList<TenantServiceRequestAuditRowResponse> AuditTrail);
internal sealed record TenantDispatchAssignmentRowResponse(
    Guid Id,
    Guid ServiceRequestId,
    string RequestNumber,
    string CustomerName,
    string ItemType,
    string Priority,
    string ServiceStatus,
    Guid AssignedUserId,
    string AssignedUserName,
    Guid AssignedByUserId,
    string AssignedByUserName,
    DateTime? ScheduledStartUtc,
    DateTime? ScheduledEndUtc,
    string AssignmentStatus,
    DateTime CreatedAtUtc,
    string FinanceHandoffStatus,
    string? InvoiceNumber,
    string? InvoiceStatus,
    bool CanConvertToLoan,
    bool HasMicroLoan);

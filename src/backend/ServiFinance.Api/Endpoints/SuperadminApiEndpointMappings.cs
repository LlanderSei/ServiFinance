namespace ServiFinance.Api.Endpoints;

using System.Diagnostics;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Infrastructure.Configuration;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class SuperadminApiEndpointMappings {
  public static RouteGroupBuilder MapSuperadminApiEndpoints(this RouteGroupBuilder api) {
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

    return superadminApi;
  }
}
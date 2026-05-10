namespace ServiFinance.Api.Services;

using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Auditing;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

internal sealed class SubscriptionRecoveryReconciliationHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<SubscriptionRecoveryReconciliationHostedService> logger,
    TimeProvider timeProvider) : BackgroundService {
  private static readonly TimeSpan InitialDelay = TimeSpan.FromSeconds(30);
  private static readonly TimeSpan ReconciliationInterval = TimeSpan.FromHours(6);

  protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
    try {
      await Task.Delay(InitialDelay, stoppingToken);
    } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) {
      return;
    }

    while (!stoppingToken.IsCancellationRequested) {
      try {
        await ReconcileAsync(stoppingToken);
      } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) {
        return;
      } catch (Exception ex) {
        logger.LogError(ex, "Subscription recovery reconciliation failed.");
      }

      try {
        await Task.Delay(ReconciliationInterval, stoppingToken);
      } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) {
        return;
      }
    }
  }

  private async Task ReconcileAsync(CancellationToken cancellationToken) {
    await using var scope = scopeFactory.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ServiFinanceDbContext>();
    var auditLogService = scope.ServiceProvider.GetRequiredService<IAuditLogService>();
    var utcNow = timeProvider.GetUtcNow().UtcDateTime;

    var tenants = await dbContext.Tenants
        .IgnoreQueryFilters()
        .Include(entity => entity.BillingRecords)
        .Where(entity => entity.Id != ServiFinanceDatabaseDefaults.PlatformTenantId)
        .Where(entity => entity.IsActive)
        .ToListAsync(cancellationToken);

    var tenantsToSuspend = tenants
        .Where(tenant => !string.Equals(tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase))
        .Select(tenant => new {
          Tenant = tenant,
          RecoveryPolicy = ProgramEndpointSupport.ResolveTenantBillingRecoveryPolicy(tenant)
        })
        .Where(entity =>
          string.Equals(entity.RecoveryPolicy.Stage, "Suspension review", StringComparison.OrdinalIgnoreCase) &&
          (entity.RecoveryPolicy.OverdueDays ?? 0) >= ProgramEndpointSupport.BillingRecoverySuspensionReviewGracePeriodDays)
        .ToArray();

    if (tenantsToSuspend.Length == 0) {
      logger.LogDebug("Subscription recovery reconciliation completed with no automatic suspensions.");
      return;
    }

    foreach (var entry in tenantsToSuspend) {
      entry.Tenant.SubscriptionStatus = "Suspended";
      entry.Tenant.IsActive = false;
    }

    await dbContext.SaveChangesAsync(cancellationToken);

    foreach (var entry in tenantsToSuspend) {
      await auditLogService.WriteAsync(
        new AuditLogEntry(
          ServiFinanceDatabaseDefaults.PlatformTenantId,
          "Superadmin",
          "System",
          "SubscriptionAutoSuspension",
          "Suspended",
          null,
          "System",
          "system@servifinance",
          "Tenant",
          entry.Tenant.Id,
          entry.Tenant.Name,
          $"Automatically suspended tenant {entry.Tenant.DomainSlug} after subscription recovery reached {entry.RecoveryPolicy.OverdueDays ?? 0} overdue day(s).",
          null,
          nameof(SubscriptionRecoveryReconciliationHostedService)),
        cancellationToken);
    }

    logger.LogInformation(
      "Subscription recovery reconciliation automatically suspended {TenantCount} tenant(s) at {UtcTimestamp}.",
      tenantsToSuspend.Length,
      utcNow);
  }
}

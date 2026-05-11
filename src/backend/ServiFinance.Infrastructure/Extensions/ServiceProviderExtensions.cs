using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

namespace ServiFinance.Infrastructure.Extensions;

public static class ServiceProviderExtensions {
  public static async Task EnsureServiFinanceDatabaseAsync(
      this IServiceProvider services,
      CancellationToken cancellationToken = default) {
    await using var scope = services.CreateAsyncScope();

    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
        .CreateLogger("ServiFinance.Database");
    var dbContext = scope.ServiceProvider.GetRequiredService<ServiFinanceDbContext>();
    var seeder = scope.ServiceProvider.GetRequiredService<DevelopmentDataSeeder>();
    var productionSeeder = scope.ServiceProvider.GetRequiredService<ProductionPlaythroughDataSeeder>();
    var seedOptions = scope.ServiceProvider.GetRequiredService<DevelopmentSeedOptions>();

    if (seedOptions.ResetDatabaseBeforeProductionPlaythrough) {
      if (!seedOptions.ProductionPlaythroughEnabled) {
        logger.LogWarning("Database reset was requested, but production playthrough seeding is disabled. Reset skipped.");
      } else {
        logger.LogWarning("Resetting SQL Server database '{Database}' before production playthrough seeding.", dbContext.Database.GetDbConnection().Database);
        await dbContext.Database.EnsureDeletedAsync(cancellationToken);
      }
    }

    logger.LogInformation("Applying SQL Server migrations to database '{Database}'.", dbContext.Database.GetDbConnection().Database);
    await dbContext.Database.MigrateAsync(cancellationToken);
    await seeder.SeedAsync(seedOptions, cancellationToken);
    if (seedOptions.ProductionPlaythroughEnabled) {
      await productionSeeder.SeedAsync(seedOptions, cancellationToken);
    }
    logger.LogInformation("SQL Server database is ready.");
  }
}

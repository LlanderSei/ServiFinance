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
    var seedOptions = scope.ServiceProvider.GetRequiredService<DevelopmentSeedOptions>();

    logger.LogInformation("Applying SQL Server migrations to database '{Database}'.", dbContext.Database.GetDbConnection().Database);
    await dbContext.Database.MigrateAsync(cancellationToken);
    await seeder.SeedAsync(seedOptions, cancellationToken);
    logger.LogInformation("SQL Server database is ready.");
  }
}

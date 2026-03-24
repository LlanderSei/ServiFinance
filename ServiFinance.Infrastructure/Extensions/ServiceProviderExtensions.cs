using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
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

    logger.LogInformation("Ensuring SQL Server database '{Database}' exists.", dbContext.Database.GetDbConnection().Database);
    await dbContext.Database.EnsureCreatedAsync(cancellationToken);
    logger.LogInformation("SQL Server database is ready.");
  }
}

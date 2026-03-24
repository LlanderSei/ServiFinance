using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;

namespace ServiFinance.Infrastructure.Extensions;

public static class ServiceCollectionExtensions {
  public static IServiceCollection AddServiFinanceSqlServer(
      this IServiceCollection services,
      IConfiguration configuration) {
    var connectionString = configuration.GetConnectionString(ServiFinanceDatabaseDefaults.ConnectionStringName);
    return services.AddServiFinanceSqlServer(connectionString);
  }

  public static IServiceCollection AddServiFinanceSqlServer(
      this IServiceCollection services,
      string? connectionString) {
    var resolvedConnectionString = ServiFinanceDatabaseDefaults.ResolveConnectionString(connectionString);

    services.AddDbContext<ServiFinanceDbContext>(options =>
        options.UseSqlServer(resolvedConnectionString));

    return services;
  }
}

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ServiFinance.Infrastructure.Auth;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;
using ServiFinance.Infrastructure.Domain;
using ServiFinance.Infrastructure.Subscriptions;
using ServiFinance.Infrastructure.Tenancy;

namespace ServiFinance.Infrastructure.Extensions;

public static class ServiceCollectionExtensions {
  public static IServiceCollection AddServiFinanceSqlServer(
      this IServiceCollection services,
      IConfiguration configuration) {
    var connectionString = configuration.GetConnectionString(ServiFinanceDatabaseDefaults.ConnectionStringName);
    return services.AddServiFinanceSqlServer(connectionString, configuration);
  }

  public static IServiceCollection AddServiFinanceSqlServer(
      this IServiceCollection services,
      string? connectionString) {
    return services.AddServiFinanceSqlServer(connectionString, configuration: null);
  }

  private static IServiceCollection AddServiFinanceSqlServer(
      this IServiceCollection services,
      string? connectionString,
      IConfiguration? configuration) {
    var resolvedConnectionString = ServiFinanceDatabaseDefaults.ResolveConnectionString(connectionString);

    services.AddScoped<ITenantProvider, ConfigurationTenantProvider>();
    services.AddScoped<IUserAuthenticationService, UserAuthenticationService>();
    services.AddScoped<IUserManagementService, UserManagementService>();
    services.AddScoped<ISubscriptionTierCatalogService, SubscriptionTierCatalogService>();
    services.AddScoped<DevelopmentDataSeeder>();
    services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
    services.AddSingleton(new DevelopmentSeedOptions {
        TenantId = ServiFinanceDatabaseDefaults.ResolveDevelopmentTenantId(
            configuration?[ServiFinanceDatabaseDefaults.DevelopmentTenantIdConfigurationKey]),
        AdminEmail = ServiFinanceDatabaseDefaults.ResolveDevelopmentAdminEmail(
            configuration?[ServiFinanceDatabaseDefaults.DevelopmentAdminEmailConfigurationKey]),
        SuperAdminEmail = configuration?["ServiFinance:SuperAdminEmail"] ?? ServiFinanceDatabaseDefaults.DefaultSuperAdminEmail,
        SuperAdminPassword = configuration?["ServiFinance:SuperAdminPassword"] ?? ServiFinanceDatabaseDefaults.DefaultSuperAdminPassword,
        AdminPassword = ServiFinanceDatabaseDefaults.ResolveDevelopmentAdminPassword(
            configuration?[ServiFinanceDatabaseDefaults.DevelopmentAdminPasswordConfigurationKey])
    });
    services.AddDbContext<ServiFinanceDbContext>((serviceProvider, options) =>
        options.UseSqlServer(resolvedConnectionString));

    return services;
  }
}

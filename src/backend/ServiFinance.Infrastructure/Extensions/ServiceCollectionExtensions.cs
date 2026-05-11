using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Auth;
using ServiFinance.Application.Notifications;
using ServiFinance.Application.Onboarding;
using ServiFinance.Application.Payments;
using ServiFinance.Application.Subscriptions;
using ServiFinance.Application.Tenancy;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Auditing;
using ServiFinance.Infrastructure.Auth;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;
using ServiFinance.Infrastructure.Onboarding;
using ServiFinance.Infrastructure.Notifications;
using ServiFinance.Infrastructure.Payments;
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
    services.AddScoped<ICustomerAuthenticationService, CustomerAuthenticationService>();
    services.AddScoped<IUserManagementService, UserManagementService>();
    services.AddScoped<IRolePermissionManagementService, RolePermissionManagementService>();
    services.AddScoped<IRolePermissionAuthorizationService, RolePermissionAuthorizationService>();
    services.AddScoped<IAuditLogService, AuditLogService>();
    services.AddScoped<IAuthProtectionService, AuthProtectionService>();
    services.AddSingleton<IPasswordPolicyService, PasswordPolicyService>();
    services.AddSingleton<IEmailSender, SmtpEmailSender>();
    services.Configure<TurnstileOptions>(options => {
      options.SiteKey = configuration?["ServiFinance:ExternalServices:Turnstile:SiteKey"]?.Trim()
          ?? configuration?["ExternalServices:Turnstile:SiteKey"]?.Trim()
          ?? configuration?["TURNSTILE_SITE_KEY"]?.Trim()
          ?? string.Empty;
      options.SecretKey = configuration?["ServiFinance:ExternalServices:Turnstile:SecretKey"]?.Trim()
          ?? configuration?["ExternalServices:Turnstile:SecretKey"]?.Trim()
          ?? configuration?["TURNSTILE_SECRET_KEY"]?.Trim()
          ?? string.Empty;
    });
    services.Configure<SmtpEmailOptions>(options => {
      options.Host = configuration?["ServiFinance:Email:Smtp:Host"]?.Trim()
          ?? configuration?["Email:Smtp:Host"]?.Trim()
          ?? configuration?["SMTP_HOST"]?.Trim()
          ?? string.Empty;
      options.Port = ResolveIntConfigurationValue(
          configuration,
          587,
          "ServiFinance:Email:Smtp:Port",
          "Email:Smtp:Port",
          "SMTP_PORT");
      options.Username = configuration?["ServiFinance:Email:Smtp:Username"]?.Trim()
          ?? configuration?["Email:Smtp:Username"]?.Trim()
          ?? configuration?["SMTP_USERNAME"]?.Trim()
          ?? string.Empty;
      options.Password = configuration?["ServiFinance:Email:Smtp:Password"]?.Trim()
          ?? configuration?["Email:Smtp:Password"]?.Trim()
          ?? configuration?["SMTP_PASSWORD"]?.Trim()
          ?? string.Empty;
      options.FromEmail = configuration?["ServiFinance:Email:Smtp:FromEmail"]?.Trim()
          ?? configuration?["Email:Smtp:FromEmail"]?.Trim()
          ?? configuration?["SMTP_FROM_EMAIL"]?.Trim()
          ?? string.Empty;
      options.FromName = configuration?["ServiFinance:Email:Smtp:FromName"]?.Trim()
          ?? configuration?["Email:Smtp:FromName"]?.Trim()
          ?? configuration?["SMTP_FROM_NAME"]?.Trim()
          ?? "ServiFinance";
      options.EnableSsl = ResolveBoolConfigurationValue(
          configuration,
          true,
          "ServiFinance:Email:Smtp:EnableSsl",
          "Email:Smtp:EnableSsl",
          "SMTP_ENABLE_SSL");
    });
    services.AddHttpClient(AuthProtectionService.TurnstileHttpClientName, client => {
      client.BaseAddress = new Uri("https://challenges.cloudflare.com/");
      client.Timeout = TimeSpan.FromSeconds(10);
      client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
    });
    services.AddScoped<IPlatformTenantOnboardingService, StripePlatformTenantOnboardingService>();
    services.AddScoped<IStripeServiceInvoicePaymentService, StripeServiceInvoicePaymentService>();
    services.AddScoped<ISubscriptionTierCatalogService, SubscriptionTierCatalogService>();
    services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
    services.AddScoped<IPasswordHasher<Customer>, PasswordHasher<Customer>>();
    services.AddSingleton(TimeProvider.System);
    services.Configure<SessionTokenOptions>(configuration?.GetSection(SessionTokenOptions.SectionName) ?? new ConfigurationBuilder().Build().GetSection(SessionTokenOptions.SectionName));
    services.Configure<StripeBillingOptions>(configuration?.GetSection(StripeBillingOptions.SectionName) ?? new ConfigurationBuilder().Build().GetSection(StripeBillingOptions.SectionName));
    services.AddScoped<ISessionTokenService, JwtSessionTokenService>();
    services.AddScoped<DevelopmentDataSeeder>();
    services.AddSingleton(new DevelopmentSeedOptions {
        TenantId = ServiFinanceDatabaseDefaults.ResolveDevelopmentTenantId(
            configuration?[ServiFinanceDatabaseDefaults.DevelopmentTenantIdConfigurationKey]),
        AdminEmail = ServiFinanceDatabaseDefaults.ResolveDevelopmentAdminEmail(
            configuration?[ServiFinanceDatabaseDefaults.DevelopmentAdminEmailConfigurationKey]),
        SuperAdminEmail = ServiFinanceDatabaseDefaults.ResolveSuperAdminEmail(
            configuration?[ServiFinanceDatabaseDefaults.SuperAdminEmailConfigurationKey]),
        SuperAdminPassword = ServiFinanceDatabaseDefaults.ResolveSuperAdminPassword(
            configuration?[ServiFinanceDatabaseDefaults.SuperAdminPasswordConfigurationKey]),
        AdminPassword = ServiFinanceDatabaseDefaults.ResolveDevelopmentAdminPassword(
            configuration?[ServiFinanceDatabaseDefaults.DevelopmentAdminPasswordConfigurationKey])
    });
    services.AddDbContext<ServiFinanceDbContext>((serviceProvider, options) =>
        options.UseSqlServer(resolvedConnectionString));

    return services;
  }

  private static int ResolveIntConfigurationValue(
      IConfiguration? configuration,
      int fallback,
      params string[] keys) {
    foreach (var key in keys) {
      if (int.TryParse(configuration?[key], out var value)) {
        return value;
      }
    }

    return fallback;
  }

  private static bool ResolveBoolConfigurationValue(
      IConfiguration? configuration,
      bool fallback,
      params string[] keys) {
    foreach (var key in keys) {
      if (bool.TryParse(configuration?[key], out var value)) {
        return value;
      }
    }

    return fallback;
  }
}


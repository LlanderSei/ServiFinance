namespace ServiFinance.Infrastructure.Configuration;

public static class ServiFinanceDatabaseDefaults {
  public const string ConnectionStringName = "DefaultConnection";
  public const string ConnectionStringEnvironmentVariable = "ConnectionStrings__DefaultConnection";
  public const string DevelopmentTenantIdConfigurationKey = "ServiFinance:DevelopmentTenantId";
  public const string DevelopmentTenantIdEnvironmentVariable = "SERVIFINANCE__DEVELOPMENTTENANTID";
  public const string DevelopmentAdminEmailConfigurationKey = "ServiFinance:DevelopmentAdminEmail";
  public const string DevelopmentAdminEmailEnvironmentVariable = "SERVIFINANCE__DEVELOPMENTADMINEMAIL";
  public const string DevelopmentAdminPasswordConfigurationKey = "ServiFinance:DevelopmentAdminPassword";
  public const string DevelopmentAdminPasswordEnvironmentVariable = "SERVIFINANCE__DEVELOPMENTADMINPASSWORD";
  public const string SuperAdminEmailConfigurationKey = "ServiFinance:SuperAdminEmail";
  public const string SuperAdminEmailEnvironmentVariable = "SERVIFINANCE__SUPERADMINEMAIL";
  public const string SuperAdminPasswordConfigurationKey = "ServiFinance:SuperAdminPassword";
  public const string SuperAdminPasswordEnvironmentVariable = "SERVIFINANCE__SUPERADMINPASSWORD";
  public static readonly Guid PlatformTenantId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  public static readonly Guid DefaultDevelopmentTenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
  public static readonly Guid MicroStandardSubscriptionTierId = Guid.Parse("99999999-1111-1111-1111-111111111111");
  public static readonly Guid MicroPremiumSubscriptionTierId = Guid.Parse("99999999-2222-2222-2222-222222222222");
  public static readonly Guid SmallStandardSubscriptionTierId = Guid.Parse("99999999-3333-3333-3333-333333333333");
  public static readonly Guid SmallPremiumSubscriptionTierId = Guid.Parse("99999999-4444-4444-4444-444444444444");
  public static readonly Guid MediumStandardSubscriptionTierId = Guid.Parse("99999999-5555-5555-5555-555555555555");
  public static readonly Guid MediumPremiumSubscriptionTierId = Guid.Parse("99999999-6666-6666-6666-666666666666");
  public static readonly Guid DefaultSuperAdminRoleId = Guid.Parse("66666666-6666-6666-6666-666666666666");
  public static readonly Guid DefaultSuperAdminUserId = Guid.Parse("77777777-7777-7777-7777-777777777777");
  public static readonly Guid DefaultSuperAdminUserRoleId = Guid.Parse("88888888-8888-8888-8888-888888888888");
  public static readonly Guid DefaultDevelopmentAdminUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");
  public static readonly Guid DefaultDevelopmentAdminRoleId = Guid.Parse("33333333-3333-3333-3333-333333333333");
  public static readonly Guid DefaultDevelopmentStaffRoleId = Guid.Parse("55555555-5555-5555-5555-555555555555");
  public static readonly Guid DefaultDevelopmentAdminUserRoleId = Guid.Parse("44444444-4444-4444-4444-444444444444");
  public const string PlatformTenantCode = "PLATFORM";
  public const string PlatformTenantDomainSlug = "platform";

  public static string ResolveConnectionString(string? configuredConnectionString) {
    if (!string.IsNullOrWhiteSpace(configuredConnectionString)) {
      return configuredConnectionString;
    }

    var environmentConnectionString = Environment.GetEnvironmentVariable(ConnectionStringEnvironmentVariable);
    if (!string.IsNullOrWhiteSpace(environmentConnectionString)) {
      return environmentConnectionString;
    }

    throw new InvalidOperationException(
        "Missing SQL Server connection string. Set ConnectionStrings__DefaultConnection in .env or host environment variables.");
  }

  public static Guid ResolveDevelopmentTenantId(string? configuredTenantId) {
    if (Guid.TryParse(configuredTenantId, out var tenantId)) {
      return tenantId;
    }

    var environmentTenantId = Environment.GetEnvironmentVariable(DevelopmentTenantIdEnvironmentVariable);
    return Guid.TryParse(environmentTenantId, out tenantId)
        ? tenantId
        : DefaultDevelopmentTenantId;
  }

  public static string ResolveDevelopmentAdminEmail(string? configuredEmail) {
    return ResolveRequiredValue(
        configuredEmail,
        DevelopmentAdminEmailEnvironmentVariable,
        "ServiFinance:DevelopmentAdminEmail");
  }

  public static string ResolveDevelopmentAdminPassword(string? configuredPassword) {
    return ResolveRequiredValue(
        configuredPassword,
        DevelopmentAdminPasswordEnvironmentVariable,
        "ServiFinance:DevelopmentAdminPassword");
  }

  public static string ResolveSuperAdminEmail(string? configuredEmail) {
    return ResolveRequiredValue(
        configuredEmail,
        SuperAdminEmailEnvironmentVariable,
        SuperAdminEmailConfigurationKey);
  }

  public static string ResolveSuperAdminPassword(string? configuredPassword) {
    return ResolveRequiredValue(
        configuredPassword,
        SuperAdminPasswordEnvironmentVariable,
        SuperAdminPasswordConfigurationKey);
  }

  private static string ResolveRequiredValue(
      string? configuredValue,
      string environmentVariableName,
      string configurationKey) {
    if (!string.IsNullOrWhiteSpace(configuredValue)) {
      return configuredValue;
    }

    var environmentValue = Environment.GetEnvironmentVariable(environmentVariableName);
    if (!string.IsNullOrWhiteSpace(environmentValue)) {
      return environmentValue;
    }

    throw new InvalidOperationException(
        $"Missing configuration value '{configurationKey}'. Set it in .env or host environment variables.");
  }
}

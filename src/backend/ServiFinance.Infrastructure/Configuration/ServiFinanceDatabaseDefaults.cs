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

  public const string DefaultConnectionString =
      "Server=.\\SQLEXPRESS;Database=ServiFinance;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;";
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
  public const string DefaultSuperAdminEmail = "superadmin@local.servifinance";
  public const string DefaultSuperAdminPassword = "SuperAdmin123!";
  public const string DefaultDevelopmentAdminEmail = "admin@local.servifinance";
  public const string DefaultDevelopmentAdminPassword = "Admin123!";

  public static string ResolveConnectionString(string? configuredConnectionString) {
    if (!string.IsNullOrWhiteSpace(configuredConnectionString)) {
      return configuredConnectionString;
    }

    var environmentConnectionString = Environment.GetEnvironmentVariable(ConnectionStringEnvironmentVariable);
    return string.IsNullOrWhiteSpace(environmentConnectionString)
        ? DefaultConnectionString
        : environmentConnectionString;
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
    if (!string.IsNullOrWhiteSpace(configuredEmail)) {
      return configuredEmail;
    }

    var environmentEmail = Environment.GetEnvironmentVariable(DevelopmentAdminEmailEnvironmentVariable);
    return string.IsNullOrWhiteSpace(environmentEmail)
        ? DefaultDevelopmentAdminEmail
        : environmentEmail;
  }

  public static string ResolveDevelopmentAdminPassword(string? configuredPassword) {
    if (!string.IsNullOrWhiteSpace(configuredPassword)) {
      return configuredPassword;
    }

    var environmentPassword = Environment.GetEnvironmentVariable(DevelopmentAdminPasswordEnvironmentVariable);
    return string.IsNullOrWhiteSpace(environmentPassword)
        ? DefaultDevelopmentAdminPassword
        : environmentPassword;
  }
}

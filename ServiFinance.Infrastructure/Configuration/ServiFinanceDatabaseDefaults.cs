namespace ServiFinance.Infrastructure.Configuration;

public static class ServiFinanceDatabaseDefaults {
  public const string ConnectionStringName = "DefaultConnection";
  public const string ConnectionStringEnvironmentVariable = "ConnectionStrings__DefaultConnection";

  public const string DefaultConnectionString =
      "Server=.\\SQLEXPRESS;Database=ServiFinance;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;";

  public static string ResolveConnectionString(string? configuredConnectionString) {
    if (!string.IsNullOrWhiteSpace(configuredConnectionString)) {
      return configuredConnectionString;
    }

    var environmentConnectionString = Environment.GetEnvironmentVariable(ConnectionStringEnvironmentVariable);
    return string.IsNullOrWhiteSpace(environmentConnectionString)
        ? DefaultConnectionString
        : environmentConnectionString;
  }
}

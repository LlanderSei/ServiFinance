namespace ServiFinance.Infrastructure.Configuration;

public sealed class SessionTokenOptions {
  public const string SectionName = "ServiFinance:Auth";

  public string Issuer { get; set; } = "ServiFinance";
  public string Audience { get; set; } = "ServiFinance.Clients";
  public string SigningKey { get; set; } = "servifinance-dev-signing-key-change-me-2026";
  public int AccessTokenMinutes { get; set; } = 30;
  public int RefreshTokenDays { get; set; } = 1;
  public int PersistentRefreshTokenDays { get; set; } = 14;
}

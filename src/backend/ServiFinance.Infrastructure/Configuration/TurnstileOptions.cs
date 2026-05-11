namespace ServiFinance.Infrastructure.Configuration;

public sealed class TurnstileOptions {
  public const string SectionName = "ServiFinance:ExternalServices:Turnstile";

  public string SiteKey { get; set; } = string.Empty;
  public string SecretKey { get; set; } = string.Empty;

  public bool IsConfigured =>
    !string.IsNullOrWhiteSpace(SiteKey) &&
    !string.IsNullOrWhiteSpace(SecretKey);
}

namespace ServiFinance.Infrastructure.Configuration;

public sealed class StripeBillingOptions {
  public const string SectionName = "ServiFinance:Stripe";

  public string SecretKey { get; init; } = string.Empty;
  public string WebhookSecret { get; init; } = string.Empty;
}

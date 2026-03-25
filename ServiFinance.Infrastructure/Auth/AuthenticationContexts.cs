namespace ServiFinance.Infrastructure.Auth;

public enum AuthenticationSurface {
  Root,
  TenantWeb,
  TenantDesktop
}

public sealed record AuthenticationRequest(
    string Email,
    string Password,
    AuthenticationSurface Surface,
    string? TenantDomainSlug = null);

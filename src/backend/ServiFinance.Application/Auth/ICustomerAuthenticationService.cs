namespace ServiFinance.Application.Auth;

using ServiFinance.Domain;

public interface ICustomerAuthenticationService {
  Task<AuthenticatedUser?> AuthenticateAsync(string email, string password, string tenantDomainSlug, CancellationToken cancellationToken = default);
  Task<AuthenticatedUser> RegisterAsync(CustomerRegisterRequest request, CancellationToken cancellationToken = default);
}

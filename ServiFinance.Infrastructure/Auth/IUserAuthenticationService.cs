namespace ServiFinance.Infrastructure.Auth;

public interface IUserAuthenticationService {
  Task<AuthenticatedUser?> AuthenticateAsync(AuthenticationRequest request, CancellationToken cancellationToken = default);
}

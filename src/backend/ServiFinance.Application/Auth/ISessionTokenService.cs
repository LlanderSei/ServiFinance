namespace ServiFinance.Application.Auth;

public interface ISessionTokenService {
  Task<AuthSessionTokens> CreateSessionAsync(
      AuthenticatedUser user,
      AuthenticationSurface surface,
      bool rememberMe = false,
      CancellationToken cancellationToken = default);

  Task<AuthSessionTokens?> RefreshSessionAsync(
      string refreshToken,
      CancellationToken cancellationToken = default);

  Task RevokeSessionAsync(
      string refreshToken,
      CancellationToken cancellationToken = default);

  CurrentSessionUser? ReadAccessToken(string accessToken);
}

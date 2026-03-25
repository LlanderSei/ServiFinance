using System.Security.Claims;
using Microsoft.AspNetCore.Components.Authorization;

namespace ServiFinance.Services;

public sealed class DesktopAuthenticationStateProvider : AuthenticationStateProvider {
  private static readonly AuthenticationState AnonymousState =
      new(new ClaimsPrincipal(new ClaimsIdentity()));

  public override Task<AuthenticationState> GetAuthenticationStateAsync() =>
      Task.FromResult(AnonymousState);
}

namespace ServiFinance.Application.Auth;

using System.Security.Claims;

public static class SessionModuleAccessClaims {
  public const string ClaimType = "module_access";

  public static string ToClaimValue(SessionModuleAccess moduleAccess) =>
    string.Join('|', moduleAccess.ModuleCode, moduleAccess.Channel, moduleAccess.AccessLevel);

  public static IReadOnlyList<SessionModuleAccess> FromClaims(IEnumerable<Claim> claims) =>
    claims
      .Where(claim => string.Equals(claim.Type, ClaimType, StringComparison.OrdinalIgnoreCase))
      .Select(claim => TryParse(claim.Value))
      .Where(moduleAccess => moduleAccess is not null)
      .Cast<SessionModuleAccess>()
      .GroupBy(moduleAccess => moduleAccess.ModuleCode, StringComparer.OrdinalIgnoreCase)
      .Select(group => group.First())
      .OrderBy(moduleAccess => moduleAccess.Channel, StringComparer.OrdinalIgnoreCase)
      .ThenBy(moduleAccess => moduleAccess.ModuleCode, StringComparer.OrdinalIgnoreCase)
      .ToArray();

  private static SessionModuleAccess? TryParse(string value) {
    var parts = value.Split('|', 3, StringSplitOptions.TrimEntries);
    if (parts.Length != 3 ||
        string.IsNullOrWhiteSpace(parts[0]) ||
        string.IsNullOrWhiteSpace(parts[1]) ||
        string.IsNullOrWhiteSpace(parts[2])) {
      return null;
    }

    return new SessionModuleAccess(parts[0], parts[1], parts[2]);
  }
}

namespace ServiFinance.Infrastructure.Auth;

using System.Text.RegularExpressions;
using ServiFinance.Application.Auth;

public sealed partial class PasswordPolicyService : IPasswordPolicyService {
  private const int MinimumLength = 12;

  private static readonly HashSet<string> AdditionalBlockedPasswords = new(StringComparer.OrdinalIgnoreCase) {
    "admin",
    "admin123",
    "administrator",
    "changeme",
    "change-me",
    "servifinance",
    "servifinanceadmin",
    "servifinanceroot",
    "superadmin",
    "rootadmin",
    "tenantadmin",
    "customerportal",
    "microfinance",
    "mlsdesktop",
    "smsportal"
  };

  public PasswordPolicyResult Validate(string password, PasswordPolicyContext context) {
    var errors = new List<string>();
    if (string.IsNullOrWhiteSpace(password)) {
      return new PasswordPolicyResult(false, ["Password is required."]);
    }

    if (password.Length < MinimumLength) {
      errors.Add($"Password must be at least {MinimumLength} characters.");
    }

    var normalizedPassword = NormalizeToken(password);
    var personalTokens = BuildPersonalTokens(context).ToArray();
    var zxcvbnResult = Zxcvbn.Core.EvaluatePassword(password, BuildZxcvbnUserInputs(personalTokens));
    if (zxcvbnResult.Score <= 1) {
      errors.Add("Password is too common or easily guessed.");
    }

    if (AdditionalBlockedPasswords.Contains(normalizedPassword) ||
        AdditionalBlockedPasswords.Any(blocked => normalizedPassword.Contains(NormalizeToken(blocked), StringComparison.OrdinalIgnoreCase))) {
      errors.Add("Password cannot contain blocked project or account terms.");
    }

    if (HasRepeatedRun(password)) {
      errors.Add("Password cannot contain long repeated character runs.");
    }

    if (HasSequentialRun(password)) {
      errors.Add("Password cannot contain obvious keyboard or numeric sequences.");
    }

    if (personalTokens.Any(token => token.Length >= 4 && normalizedPassword.Contains(token, StringComparison.OrdinalIgnoreCase))) {
      errors.Add("Password cannot contain similar words from the email, name, tenant, or business name.");
    }

    return new PasswordPolicyResult(errors.Count == 0, errors);
  }

  private static IEnumerable<string> BuildZxcvbnUserInputs(IEnumerable<string> personalTokens) =>
    personalTokens
      .Concat(AdditionalBlockedPasswords)
      .Where(input => !string.IsNullOrWhiteSpace(input))
      .Select(NormalizeToken)
      .Where(input => input.Length >= 4)
      .Distinct(StringComparer.OrdinalIgnoreCase);

  private static IEnumerable<string> BuildPersonalTokens(PasswordPolicyContext context) {
    foreach (var value in new[] {
        context.Email,
        context.FullName,
        context.TenantDomainSlug,
        context.BusinessName
    }) {
      foreach (var token in Tokenize(value)) {
        yield return token;
      }
    }
  }

  private static IEnumerable<string> Tokenize(string? value) {
    if (string.IsNullOrWhiteSpace(value)) {
      yield break;
    }

    foreach (var part in TokenSplitPattern().Split(value.Trim())) {
      var token = NormalizeToken(part);
      if (token.Length >= 4) {
        yield return token;
      }
    }
  }

  private static bool HasRepeatedRun(string password) {
    var runLength = 1;
    for (var index = 1; index < password.Length; index++) {
      if (char.ToLowerInvariant(password[index]) == char.ToLowerInvariant(password[index - 1])) {
        runLength++;
        if (runLength >= 4) {
          return true;
        }
      } else {
        runLength = 1;
      }
    }

    return false;
  }

  private static bool HasSequentialRun(string password) {
    var normalized = NormalizeToken(password);
    var sequences = new[] {
      "abcdefghijklmnopqrstuvwxyz",
      "zyxwvutsrqponmlkjihgfedcba",
      "0123456789",
      "9876543210",
      "qwertyuiop",
      "poiuytrewq",
      "asdfghjkl",
      "lkjhgfdsa",
      "zxcvbnm",
      "mnbvcxz"
    };

    return sequences.Any(sequence =>
      Enumerable.Range(0, Math.Max(sequence.Length - 3, 0))
        .Select(index => sequence.Substring(index, 4))
        .Any(normalized.Contains));
  }

  private static string NormalizeToken(string value) =>
    new([.. value.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant)]);

  [GeneratedRegex(@"[^A-Za-z0-9]+")]
  private static partial Regex TokenSplitPattern();
}

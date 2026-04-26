namespace ServiFinance.Infrastructure.Configuration;

public static class DotEnvLoader {
  public static void LoadFromCurrentDirectory(string fileName = ".env") {
    var envFilePath = FindInCurrentOrParentDirectories(Directory.GetCurrentDirectory(), fileName);
    if (envFilePath is null) {
      return;
    }

    foreach (var rawLine in File.ReadLines(envFilePath)) {
      var line = rawLine.Trim();
      if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#')) {
        continue;
      }

      var separatorIndex = line.IndexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      var key = line[..separatorIndex].Trim();
      var value = line[(separatorIndex + 1)..].Trim();
      if (string.IsNullOrWhiteSpace(key)) {
        continue;
      }

      value = Unquote(value);
      if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(key))) {
        Environment.SetEnvironmentVariable(key, value);
      }
    }
  }

  private static string? FindInCurrentOrParentDirectories(string startDirectory, string fileName) {
    var currentDirectory = new DirectoryInfo(startDirectory);
    while (currentDirectory is not null) {
      var candidatePath = Path.Combine(currentDirectory.FullName, fileName);
      if (File.Exists(candidatePath)) {
        return candidatePath;
      }

      currentDirectory = currentDirectory.Parent;
    }

    return null;
  }

  private static string Unquote(string value) {
    if (value.Length < 2) {
      return value;
    }

    return value[0] == value[^1] && (value[0] == '"' || value[0] == '\'')
        ? value[1..^1]
        : value;
  }
}

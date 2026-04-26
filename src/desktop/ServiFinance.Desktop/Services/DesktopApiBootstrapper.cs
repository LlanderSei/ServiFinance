using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;

namespace ServiFinance.Services;

public interface IDesktopApiBootstrapper : IAsyncDisposable {
  Task<string> EnsureAvailableAsync(CancellationToken cancellationToken = default);
}

public sealed class DesktopApiBootstrapper : IDesktopApiBootstrapper {
  private const string DefaultWebApiBaseUrl = "http://127.0.0.1:5228";
  private const string ApiAssemblyFileName = "ServiFinance.Api.dll";
  private const string ApiProjectFileName = "ServiFinance.Api.csproj";
  private static readonly TimeSpan HealthCheckTimeout = TimeSpan.FromSeconds(90);
  private static readonly TimeSpan HealthProbeDelay = TimeSpan.FromMilliseconds(500);
  private static readonly string DesktopRuntimeRoot = Path.Combine(
      Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
      "ServiFinance",
      "desktop-api");

  private readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(2) };
  private readonly SemaphoreSlim _lock = new(1, 1);
  private readonly string? _configuredApiBaseUrl;

  private Task<string>? _availabilityTask;
  private Process? _ownedProcess;
  private TaskCompletionSource<bool>? _ownedBackendReadySource;
  private string? _resolvedApiBaseUrl;
  private string? _shadowRuntimeDirectory;

  public DesktopApiBootstrapper() {
    var configuredApiBaseUrl = Environment.GetEnvironmentVariable("SERVIFINANCE_API_BASE_URL");
    _configuredApiBaseUrl = string.IsNullOrWhiteSpace(configuredApiBaseUrl)
        ? null
        : configuredApiBaseUrl.TrimEnd('/');
    CleanupStaleShadowCopies();
  }

  public Task<string> EnsureAvailableAsync(CancellationToken cancellationToken = default) {
    var availabilityTask = _availabilityTask;
    if (availabilityTask is null) {
      availabilityTask = EnsureAvailableCoreAsync(cancellationToken);
      _availabilityTask = availabilityTask;
    }

    return availabilityTask.WaitAsync(cancellationToken);
  }

  private async Task<string> EnsureAvailableCoreAsync(CancellationToken cancellationToken) {
    await _lock.WaitAsync(cancellationToken);
    try {
      if (!string.IsNullOrWhiteSpace(_resolvedApiBaseUrl) &&
          await IsHealthyAsync(_resolvedApiBaseUrl, cancellationToken)) {
        return _resolvedApiBaseUrl;
      }

      if (!string.IsNullOrWhiteSpace(_configuredApiBaseUrl)) {
        if (await IsHealthyAsync(_configuredApiBaseUrl, cancellationToken)) {
          _resolvedApiBaseUrl = _configuredApiBaseUrl;
          return _resolvedApiBaseUrl;
        }

        if (ShouldAttemptLocalStartup(_configuredApiBaseUrl)) {
          TryStartLocalApiHost(_configuredApiBaseUrl);
          await WaitForHealthyAsync(_configuredApiBaseUrl, cancellationToken);
          _resolvedApiBaseUrl = _configuredApiBaseUrl;
          return _resolvedApiBaseUrl;
        }

        throw new InvalidOperationException($"Configured ServiFinance backend '{_configuredApiBaseUrl}' is not reachable.");
      }

      var ownedApiBaseUrl = CreateOwnedApiBaseUrl();
      TryStartLocalApiHost(ownedApiBaseUrl);
      await WaitForHealthyAsync(ownedApiBaseUrl, cancellationToken);
      _resolvedApiBaseUrl = ownedApiBaseUrl;
      return _resolvedApiBaseUrl;
    } finally {
      _lock.Release();
    }
  }

  private static bool ShouldAttemptLocalStartup(string apiBaseUrl) {
    if (!Uri.TryCreate(apiBaseUrl, UriKind.Absolute, out var apiUri)) {
      return false;
    }

    return apiUri.IsLoopback &&
           string.Equals(apiUri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase);
  }

  private async Task WaitForHealthyAsync(string apiBaseUrl, CancellationToken cancellationToken) {
    if (_ownedProcess is { HasExited: false } && _ownedBackendReadySource is not null) {
      await WaitForOwnedBackendReadyAsync(cancellationToken);
      if (await IsHealthyAsync(apiBaseUrl, cancellationToken)) {
        return;
      }
    }

    var startedAt = DateTimeOffset.UtcNow;

    while (DateTimeOffset.UtcNow - startedAt < HealthCheckTimeout) {
      cancellationToken.ThrowIfCancellationRequested();
      if (await IsHealthyAsync(apiBaseUrl, cancellationToken)) {
        return;
      }

      await Task.Delay(HealthProbeDelay, cancellationToken);
    }

    throw new InvalidOperationException($"ServiFinance backend did not become reachable at '{apiBaseUrl}' within {HealthCheckTimeout.TotalSeconds:N0} seconds.");
  }

  private async Task<bool> IsHealthyAsync(string apiBaseUrl, CancellationToken cancellationToken) {
    try {
      var response = await _httpClient.GetFromJsonAsync<HealthResponse>($"{apiBaseUrl}/api/health", cancellationToken);
      return string.Equals(response?.Status, "ok", StringComparison.OrdinalIgnoreCase);
    } catch {
      return false;
    }
  }

  private async Task WaitForOwnedBackendReadyAsync(CancellationToken cancellationToken) {
    var readinessTask = _ownedBackendReadySource?.Task;
    if (readinessTask is null) {
      return;
    }

    var timeoutTask = Task.Delay(HealthCheckTimeout, cancellationToken);
    var completedTask = await Task.WhenAny(readinessTask, timeoutTask);
    if (completedTask == timeoutTask) {
      throw new InvalidOperationException(
          $"ServiFinance backend did not become reachable within {HealthCheckTimeout.TotalSeconds:N0} seconds.");
    }

    await readinessTask.WaitAsync(cancellationToken);
  }

  private void TryStartLocalApiHost(string apiBaseUrl) {
    if (_ownedProcess is { HasExited: false }) {
      return;
    }

    var webProjectDirectory = TryFindWebProjectDirectory();
    if (webProjectDirectory is null) {
      return;
    }

    var processStartInfo = CreateProcessStartInfo(webProjectDirectory, apiBaseUrl);
    if (processStartInfo is null) {
      return;
    }

    var process = new Process {
        StartInfo = processStartInfo,
        EnableRaisingEvents = true
    };
    _ownedBackendReadySource = new(TaskCreationOptions.RunContinuationsAsynchronously);

    process.OutputDataReceived += (_, eventArgs) => {
      if (!string.IsNullOrWhiteSpace(eventArgs.Data)) {
        TrySignalBackendReady(eventArgs.Data, apiBaseUrl);
        Debug.WriteLine($"[ServiFinance.Api] {eventArgs.Data}");
      }
    };
    process.ErrorDataReceived += (_, eventArgs) => {
      if (!string.IsNullOrWhiteSpace(eventArgs.Data)) {
        TrySignalBackendReady(eventArgs.Data, apiBaseUrl);
        Debug.WriteLine($"[ServiFinance.Api] {eventArgs.Data}");
      }
    };
    process.Exited += (_, _) => {
      if (_ownedBackendReadySource is { Task.IsCompleted: false } readinessSource) {
        readinessSource.TrySetException(new InvalidOperationException("Owned ServiFinance backend exited before becoming ready."));
      }
    };

    if (!process.Start()) {
      _ownedBackendReadySource = null;
      return;
    }

    Debug.WriteLine($"[ServiFinance.Desktop] Started owned backend at {apiBaseUrl}");
    process.BeginOutputReadLine();
    process.BeginErrorReadLine();
    _ownedProcess = process;
  }

  private void TrySignalBackendReady(string outputLine, string apiBaseUrl) {
    if (_ownedBackendReadySource is not { Task.IsCompleted: false } readinessSource) {
      return;
    }

    var normalizedLine = outputLine.Trim();
    if (normalizedLine.Contains($"Now listening on: {apiBaseUrl}", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(normalizedLine, "Application started. Press Ctrl+C to shut down.", StringComparison.OrdinalIgnoreCase)) {
      readinessSource.TrySetResult(true);
    }
  }

  private ProcessStartInfo? CreateProcessStartInfo(string webProjectDirectory, string apiBaseUrl) {
    var runtimeDirectory = TryFindWebRuntimeDirectory(webProjectDirectory);
    if (runtimeDirectory is null) {
      return null;
    }

    _shadowRuntimeDirectory = CreateShadowRuntimeDirectory(runtimeDirectory);
    var shadowDll = Path.Combine(_shadowRuntimeDirectory, ApiAssemblyFileName);
    if (!File.Exists(shadowDll)) {
      return null;
    }

    var processStartInfo = CreateHiddenStartInfo("dotnet", $"\"{shadowDll}\" --urls \"{apiBaseUrl}\"", _shadowRuntimeDirectory);
    processStartInfo.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
    processStartInfo.Environment["DisableServiFinanceFrontendBuild"] = "true";
    processStartInfo.Environment["SERVIFINANCE_OWNED_API"] = "1";
    return processStartInfo;
  }

  private static ProcessStartInfo CreateHiddenStartInfo(string fileName, string arguments, string workingDirectory) =>
      new() {
          FileName = fileName,
          Arguments = arguments,
          WorkingDirectory = workingDirectory,
          UseShellExecute = false,
          CreateNoWindow = true,
          RedirectStandardOutput = true,
          RedirectStandardError = true
      };

  private static string? TryFindWebRuntimeDirectory(string webProjectDirectory) {
    var candidates = new[] {
        Path.Combine(webProjectDirectory, "bin", "Debug", "net10.0"),
        Path.Combine(webProjectDirectory, "bin", "Release", "net10.0")
    };

    return candidates.FirstOrDefault(candidate =>
        File.Exists(Path.Combine(candidate, ApiAssemblyFileName)));
  }

  private static string? TryFindWebProjectDirectory() {
    var currentDirectory = new DirectoryInfo(AppContext.BaseDirectory);
    while (currentDirectory is not null) {
      var candidate = Path.Combine(currentDirectory.FullName, "src", "backend", "ServiFinance.Api");
      if (Directory.Exists(candidate) &&
          File.Exists(Path.Combine(candidate, ApiProjectFileName))) {
        return candidate;
      }

      currentDirectory = currentDirectory.Parent;
    }

    return null;
  }

  private static string CreateOwnedApiBaseUrl() =>
      $"http://127.0.0.1:{ReserveTcpPort()}";

  private static int ReserveTcpPort() {
    var listener = new TcpListener(IPAddress.Loopback, 0);
    listener.Start();
    try {
      return ((IPEndPoint)listener.LocalEndpoint).Port;
    } finally {
      listener.Stop();
    }
  }

  private static string CreateShadowRuntimeDirectory(string sourceRuntimeDirectory) {
    Directory.CreateDirectory(DesktopRuntimeRoot);

    var shadowDirectory = Path.Combine(
        DesktopRuntimeRoot,
        $"{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}");

    CopyDirectory(sourceRuntimeDirectory, shadowDirectory);
    return shadowDirectory;
  }

  private static void CopyDirectory(string sourceDirectory, string destinationDirectory) {
    Directory.CreateDirectory(destinationDirectory);

    foreach (var directory in Directory.GetDirectories(sourceDirectory, "*", SearchOption.AllDirectories)) {
      var relativePath = Path.GetRelativePath(sourceDirectory, directory);
      Directory.CreateDirectory(Path.Combine(destinationDirectory, relativePath));
    }

    foreach (var file in Directory.GetFiles(sourceDirectory, "*", SearchOption.AllDirectories)) {
      var relativePath = Path.GetRelativePath(sourceDirectory, file);
      var destinationPath = Path.Combine(destinationDirectory, relativePath);
      Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
      File.Copy(file, destinationPath, overwrite: true);
    }
  }

  private static void CleanupStaleShadowCopies() {
    if (!Directory.Exists(DesktopRuntimeRoot)) {
      return;
    }

    foreach (var directory in Directory.GetDirectories(DesktopRuntimeRoot)) {
      try {
        var lastWriteUtc = Directory.GetLastWriteTimeUtc(directory);
        if (DateTime.UtcNow - lastWriteUtc > TimeSpan.FromDays(2)) {
          Directory.Delete(directory, recursive: true);
        }
      } catch {
        // Best-effort cleanup only.
      }
    }
  }

  public async ValueTask DisposeAsync() {
    _httpClient.Dispose();
    _lock.Dispose();

    if (_ownedProcess is null) {
      return;
    }

    try {
      if (!_ownedProcess.HasExited) {
        _ownedProcess.Kill(entireProcessTree: true);
        await _ownedProcess.WaitForExitAsync();
      }
    } catch {
      // Best-effort cleanup only.
    } finally {
      _ownedProcess.Dispose();
      _ownedBackendReadySource = null;
      if (!string.IsNullOrWhiteSpace(_shadowRuntimeDirectory) && Directory.Exists(_shadowRuntimeDirectory)) {
        try {
          Directory.Delete(_shadowRuntimeDirectory, recursive: true);
        } catch {
          // Best-effort cleanup only.
        }
      }
    }
  }

  private sealed record HealthResponse(string Status);
}

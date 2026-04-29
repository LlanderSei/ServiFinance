namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.StaticFiles;

internal static class FrontendAppEndpointMappings {
  static void MapReactPublicApp(WebApplication app) {
    var distRoot = ResolveDistRoot(app.Environment);
    if (distRoot is null) {
      return;
    }

    var assetsRoot = Path.Combine(distRoot, "assets");
    var brandingRoot = Path.Combine(distRoot, "branding");
    var desktopBridgeScript = Path.Combine(distRoot, "desktop-shell-bridge.js");
    var faviconSvg = Path.Combine(distRoot, "favicon.svg");
    var faviconIco = Path.Combine(distRoot, "favicon.ico");
    var indexHtml = Path.Combine(distRoot, "index.html");

    app.MapGet("/", () => Results.File(indexHtml, "text/html"));
    app.MapGet("/register", () => Results.File(indexHtml, "text/html"));
    app.MapGet("/dashboard", () => Results.File(indexHtml, "text/html"));
    app.MapGet("/tenants", () => Results.File(indexHtml, "text/html"));
    app.MapGet("/subscriptions", () => Results.File(indexHtml, "text/html"));
    app.MapGet("/desktop-required", () => Results.File(indexHtml, "text/html"));
    app.MapGet("/forbidden", () => Results.File(indexHtml, "text/html"));
    app.MapGet("/error", () => Results.File(indexHtml, "text/html"));
    app.MapGet("/not-found", () => Results.File(indexHtml, "text/html"));
    app.MapGet("/t/mls", () => Results.Redirect("/desktop-required"));
    app.MapGet("/t/mls/{**mlsPath}", () => Results.Redirect("/desktop-required"));
    app.MapGet("/t/{tenantDomainSlug}", (string tenantDomainSlug) =>
        Results.Redirect($"/t/{tenantDomainSlug}/sms/"));
    app.MapGet("/t/{tenantDomainSlug}/sms", (string tenantDomainSlug) =>
        Results.File(indexHtml, "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/dashboard", (string tenantDomainSlug) => Results.File(indexHtml, "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/customers", (string tenantDomainSlug) => Results.File(indexHtml, "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/service-requests", (string tenantDomainSlug) => Results.File(indexHtml, "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/dispatch", (string tenantDomainSlug) => Results.File(indexHtml, "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/reports", (string tenantDomainSlug) => Results.File(indexHtml, "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/users", (string tenantDomainSlug) => Results.File(indexHtml, "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/mls", (string tenantDomainSlug) => Results.Redirect("/desktop-required"));
    app.MapGet("/t/{tenantDomainSlug}/mls/{**mlsPath}", (string tenantDomainSlug, string? mlsPath) => Results.Redirect("/desktop-required"));
    app.MapGet("/favicon.svg", () => File.Exists(faviconSvg)
        ? Results.File(faviconSvg, "image/svg+xml")
        : Results.NotFound());
    app.MapGet("/favicon.ico", () => File.Exists(faviconIco)
        ? Results.File(faviconIco, "image/x-icon")
        : Results.Redirect("/favicon.svg"));
    app.MapGet("/_framework/hybridwebview.js", () => Results.Text("window.HybridWebView = window.HybridWebView || {};", "application/javascript"));
    app.MapGet("/desktop-shell-bridge.js", () => File.Exists(desktopBridgeScript)
        ? Results.File(desktopBridgeScript, "application/javascript")
        : Results.NotFound());
    app.MapGet("/assets/{**assetPath}", (string assetPath) => {
      return TryServeStaticAsset(assetsRoot, assetPath);
    });
    app.MapGet("/branding/{**assetPath}", (string assetPath) => {
      return TryServeStaticAsset(brandingRoot, assetPath);
    });
  }

  static string? ResolveDistRoot(IWebHostEnvironment environment) {
    var candidateRoots = new[] {
        environment.WebRootPath is null ? null : Path.Combine(environment.WebRootPath, "frontend"),
        Path.Combine(environment.ContentRootPath, "wwwroot", "frontend"),
        Path.Combine(environment.ContentRootPath, "frontend")
    };

    foreach (var candidateRoot in candidateRoots) {
      if (!string.IsNullOrWhiteSpace(candidateRoot) && File.Exists(Path.Combine(candidateRoot, "index.html"))) {
        return candidateRoot;
      }
    }

    var sourceDistRoot = Path.GetFullPath(Path.Combine(
        environment.ContentRootPath,
        "..",
        "..",
        "frontend",
        "ServiFinance.Frontend",
        "dist"));
    return File.Exists(Path.Combine(sourceDistRoot, "index.html"))
        ? sourceDistRoot
        : null;
  }

  static IResult TryServeStaticAsset(string rootPath, string assetPath) {
    var fullPath = Path.GetFullPath(Path.Combine(rootPath, assetPath));
    if (!fullPath.StartsWith(Path.GetFullPath(rootPath), StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath)) {
      return Results.NotFound();
    }

    var contentTypeProvider = new FileExtensionContentTypeProvider();
    if (!contentTypeProvider.TryGetContentType(fullPath, out var contentType)) {
      contentType = "application/octet-stream";
    }

    return Results.File(fullPath, contentType);
  }


  public static WebApplication MapFrontendAppEndpoints(this WebApplication app) {
    MapReactPublicApp(app);
    return app;
  }
}

namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.StaticFiles;

internal static class FrontendAppEndpointMappings {
  static void MapReactPublicApp(WebApplication app) {
    var distRoot = Path.GetFullPath(Path.Combine(
        app.Environment.ContentRootPath,
        "..",
        "..",
        "frontend",
        "ServiFinance.Frontend",
        "dist"));
    var assetsRoot = Path.Combine(distRoot, "assets");
    var desktopBridgeScript = Path.Combine(distRoot, "desktop-shell-bridge.js");
    var faviconSvg = Path.Combine(distRoot, "favicon.svg");
    var faviconIco = Path.Combine(distRoot, "favicon.ico");
    if (!File.Exists(Path.Combine(distRoot, "index.html"))) {
      return;
    }

    app.MapGet("/", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/register", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/dashboard", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/tenants", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/subscriptions", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/desktop-required", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/forbidden", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/error", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/not-found", () => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/t/mls", () => Results.Redirect("/desktop-required"));
    app.MapGet("/t/mls/{**mlsPath}", () => Results.Redirect("/desktop-required"));
    app.MapGet("/t/{tenantDomainSlug}", (string tenantDomainSlug) =>
        Results.Redirect($"/t/{tenantDomainSlug}/sms/"));
    app.MapGet("/t/{tenantDomainSlug}/sms", (string tenantDomainSlug) =>
        Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/dashboard", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/customers", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/service-requests", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/dispatch", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/reports", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
    app.MapGet("/t/{tenantDomainSlug}/sms/users", (string tenantDomainSlug) => Results.File(Path.Combine(distRoot, "index.html"), "text/html"));
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
      var fullPath = Path.GetFullPath(Path.Combine(assetsRoot, assetPath));
      if (!fullPath.StartsWith(Path.GetFullPath(assetsRoot), StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath)) {
        return (IResult)Results.NotFound();
      }

      var contentTypeProvider = new FileExtensionContentTypeProvider();
      if (!contentTypeProvider.TryGetContentType(fullPath, out var contentType)) {
        contentType = "application/octet-stream";
      }

      return Results.File(fullPath, contentType);
    });
  }


  public static WebApplication MapFrontendAppEndpoints(this WebApplication app) {
    MapReactPublicApp(app);
    return app;
  }
}

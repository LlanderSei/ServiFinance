namespace ServiFinance.Api.Infrastructure;

public static class SecurityHeadersMiddlewareExtensions {
  private const string ContentSecurityPolicy = "default-src 'self'; " +
      "base-uri 'self'; " +
      "object-src 'none'; " +
      "frame-ancestors 'none'; " +
      "form-action 'self'; " +
      "script-src 'self' https://challenges.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://challenges.cloudflare.com https://api.imgbb.com https://nominatim.openstreetmap.org; " +
      "frame-src https://challenges.cloudflare.com";

  public static IApplicationBuilder UseServiFinanceSecurityHeaders(this IApplicationBuilder app) =>
    app.Use(async (context, next) => {
      context.Response.OnStarting(() => {
        SetHeaderIfMissing(context, "X-Content-Type-Options", "nosniff");
        SetHeaderIfMissing(context, "X-Frame-Options", "DENY");
        SetHeaderIfMissing(context, "Referrer-Policy", "strict-origin-when-cross-origin");
        SetHeaderIfMissing(context, "Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        SetHeaderIfMissing(context, "Content-Security-Policy", ContentSecurityPolicy);
        return Task.CompletedTask;
      });

      await next();
    });

  private static void SetHeaderIfMissing(HttpContext context, string header, string value) {
    if (context.Response.Headers.ContainsKey(header)) {
      return;
    }

    context.Response.Headers[header] = value;
  }
}

using Microsoft.AspNetCore.Http;

namespace ServiFinance.Services;

public sealed class DesktopHttpContextAccessor : IHttpContextAccessor {
  public HttpContext? HttpContext { get; set; }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using ServiFinance.Infrastructure.Configuration;

namespace ServiFinance.Infrastructure.Tenancy;

public sealed class ConfigurationTenantProvider(
    IConfiguration configuration,
    IHttpContextAccessor httpContextAccessor) : ITenantProvider {
  public bool HasRequestContext => httpContextAccessor.HttpContext is not null;

  public Guid CurrentTenantId {
    get {
      var tenantIdClaim = httpContextAccessor.HttpContext?.User.FindFirstValue("tenant_id");
      if (Guid.TryParse(tenantIdClaim, out var claimedTenantId)) {
        return claimedTenantId;
      }

      return ServiFinanceDatabaseDefaults.ResolveDevelopmentTenantId(
          configuration[ServiFinanceDatabaseDefaults.DevelopmentTenantIdConfigurationKey]);
    }
  }
}

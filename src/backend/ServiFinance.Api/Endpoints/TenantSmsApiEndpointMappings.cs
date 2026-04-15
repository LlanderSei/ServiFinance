
namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using ServiFinance.Api.Endpoints.TenantMls;
using ServiFinance.Api.Endpoints.TenantSms;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantSmsApiEndpointMappings {
  public static RouteGroupBuilder MapTenantSmsApiEndpoints(this RouteGroupBuilder api) {
    var tenantApi = api.MapGroup("/tenants/{tenantDomainSlug}").RequireAuthorization(new AuthorizeAttribute {
      AuthenticationSchemes = ApiAuthenticationSchemes
    });

    tenantApi.MapTenantSmsUsersEndpoints();
    tenantApi.MapTenantSmsCustomersEndpoints();
    tenantApi.MapTenantSmsServiceRequestsEndpoints();
    tenantApi.MapTenantSmsDispatchEndpoints();
    tenantApi.MapTenantSmsReportsEndpoints();
    tenantApi.MapTenantMlsDashboardEndpoints();
    tenantApi.MapTenantMlsLoanConversionEndpoints();
    tenantApi.MapTenantMlsLoanAccountsEndpoints();
    tenantApi.MapTenantMlsCustomerFinanceEndpoints();
    tenantApi.MapTenantMlsCollectionsEndpoints();
    tenantApi.MapTenantMlsAuditEndpoints();
    tenantApi.MapTenantMlsStandaloneLoanEndpoints();
    tenantApi.MapTenantMlsLedgerEndpoints();

    return tenantApi;
  }
}


namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using ServiFinance.Api.Endpoints.TenantBilling;
using ServiFinance.Api.Endpoints.TenantMls;
using ServiFinance.Api.Endpoints.TenantSms;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantSmsApiEndpointMappings {
  public static RouteGroupBuilder MapTenantSmsApiEndpoints(this RouteGroupBuilder api) {
    var tenantApi = api.MapGroup("/tenants/{tenantDomainSlug}").RequireAuthorization(new AuthorizeAttribute {
      AuthenticationSchemes = ApiAuthenticationSchemes
    });

    tenantApi.MapTenantPlatformUsersEndpoints();
    tenantApi.MapTenantRolePermissionEndpoints();
    tenantApi.MapTenantSmsCustomersEndpoints();
    tenantApi.MapTenantSmsServiceRequestsEndpoints();
    tenantApi.MapTenantSmsDispatchEndpoints();
    tenantApi.MapTenantSmsReportsEndpoints();
    tenantApi.MapTenantSmsPricingEndpoints();
    tenantApi.MapTenantSmsMediumControlsEndpoints();
    tenantApi.MapTenantBillingEndpoints();
    tenantApi.MapTenantMlsDashboardEndpoints();
    tenantApi.MapTenantMlsLoanConversionEndpoints();
    tenantApi.MapTenantMlsLoanAccountsEndpoints();
    tenantApi.MapTenantMlsCustomerFinanceEndpoints();
    tenantApi.MapTenantMlsCollectionsEndpoints();
    tenantApi.MapTenantMlsAuditEndpoints();
    tenantApi.MapTenantMlsStandaloneLoanEndpoints();
    tenantApi.MapTenantMlsReportsEndpoints();
    tenantApi.MapTenantMlsLedgerEndpoints();
    tenantApi.MapTenantMlsMediumControlsEndpoints();

    return tenantApi;
  }
}

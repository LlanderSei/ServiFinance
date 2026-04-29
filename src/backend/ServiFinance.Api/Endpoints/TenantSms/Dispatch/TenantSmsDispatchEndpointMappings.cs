namespace ServiFinance.Api.Endpoints.TenantSms;

using Microsoft.AspNetCore.Routing;

internal static class TenantSmsDispatchEndpointMappings {
    public static RouteGroupBuilder MapTenantSmsDispatchEndpoints(this RouteGroupBuilder tenantApi) {
        tenantApi.MapGetAssignments();
        tenantApi.MapGetAssignmentDetails();
        tenantApi.MapGetDispatchMeta();
        tenantApi.MapCreateAssignment();
        tenantApi.MapRescheduleAssignment();
        tenantApi.MapUpdateAssignmentStatus();
        tenantApi.MapSubmitAssignmentEvidence();
        tenantApi.MapUpdateAssignmentEvidenceNote();
        tenantApi.MapDeleteAssignmentEvidence();
        tenantApi.MapCancelAssignment();
        tenantApi.MapHandoverAssignment();
        tenantApi.MapAcceptAssignment();
        tenantApi.MapRejectAssignment();
        tenantApi.MapAbandonAssignment();

        return tenantApi;
    }
}

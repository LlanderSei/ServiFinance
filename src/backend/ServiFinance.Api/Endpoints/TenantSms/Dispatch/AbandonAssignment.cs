namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class AbandonAssignment {
    public static void MapAbandonAssignment(this RouteGroupBuilder tenantApi) {
        tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/abandon", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            [FromBody] AbandonAssignmentRequest request,
            ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
            CancellationToken cancellationToken) => {
              if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) return Results.Forbid();
              if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) return Results.Unauthorized();

              var assignment = await dbContext.Assignments.SingleOrDefaultAsync(a => a.Id == assignmentId, cancellationToken);
              if (assignment is null) return Results.NotFound();

              var isAdmin = IsTenantAdministrator(httpContext.User);
              if (!isAdmin && assignment.AssignedUserId != currentUserId) {
                  return Results.Forbid();
              }

              if (assignment.AssignmentStatus == "Completed" || assignment.AssignmentStatus == "Cancelled" || assignment.AssignmentStatus == "Abandoned") {
                  return Results.BadRequest(new { error = "Cannot abandon an assignment that is already completed, cancelled, or abandoned." });
              }

              if (string.IsNullOrWhiteSpace(request.Reason)) {
                  return Results.BadRequest(new { error = "Abandon reason is required." });
              }

              assignment.AssignmentStatus = "Abandoned";

              dbContext.AssignmentEvents.Add(new AssignmentEvent {
                  AssignmentId = assignment.Id,
                  EventType = "Abandoned",
                  AssignedUserId = assignment.AssignedUserId,
                  ScheduledStartUtc = assignment.ScheduledStartUtc,
                  ScheduledEndUtc = assignment.ScheduledEndUtc,
                  AssignmentStatus = assignment.AssignmentStatus,
                  Remarks = request.Reason,
                  ChangedByUserId = currentUserId,
                  CreatedAtUtc = DateTime.UtcNow
              });

              await dbContext.SaveChangesAsync(cancellationToken);
              return Results.NoContent();
            });
    }
}

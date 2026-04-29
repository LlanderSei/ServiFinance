namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class RejectAssignment {
    public static void MapRejectAssignment(this RouteGroupBuilder tenantApi) {
        tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/reject", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            [FromBody] RejectAssignmentRequest request,
            ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
            CancellationToken cancellationToken) => {
              if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) return Results.Forbid();
              if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) return Results.Unauthorized();

              var assignment = await dbContext.Assignments
                  .Include(a => a.AssignedUser)
                  .SingleOrDefaultAsync(a => a.Id == assignmentId, cancellationToken);
              if (assignment is null) return Results.NotFound();

              var isAdmin = IsTenantAdministrator(httpContext.User);
              if (!isAdmin && assignment.AssignedUserId != currentUserId) {
                  return Results.Forbid();
              }

              if (assignment.AssignmentStatus != "Pending Acceptance") {
                  return Results.BadRequest(new { error = "Only pending acceptance assignments can be rejected." });
              }

              if (string.IsNullOrWhiteSpace(request.Reason)) {
                  return Results.BadRequest(new { error = "Rejection reason is required." });
              }

              // Optionally, we could unassign or cancel. We'll cancel and keep it for history.
              assignment.AssignmentStatus = "Cancelled";

              dbContext.AssignmentEvents.Add(new AssignmentEvent {
                  AssignmentId = assignment.Id,
                  EventType = "Rejected",
                  PreviousAssignedUserId = assignment.AssignedUserId,
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

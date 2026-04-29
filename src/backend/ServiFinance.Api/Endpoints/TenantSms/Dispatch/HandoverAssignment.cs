namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class HandoverAssignment {
    public static void MapHandoverAssignment(this RouteGroupBuilder tenantApi) {
        tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/handover", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            [FromBody] HandoverAssignmentRequest request,
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

              if (assignment.AssignmentStatus == "Completed" || assignment.AssignmentStatus == "Cancelled" || assignment.AssignmentStatus == "In Progress" || assignment.AssignmentStatus == "Pending Acceptance") {
                  return Results.BadRequest(new { error = "Cannot handover an assignment that is already completed, cancelled, in progress, or pending acceptance." });
              }

              if (request.NewAssigneeUserId == Guid.Empty) {
                  return Results.BadRequest(new { error = "New assignee is required." });
              }

              if (string.IsNullOrWhiteSpace(request.Reason)) {
                  return Results.BadRequest(new { error = "Handover reason is required." });
              }

              var newAssignee = await dbContext.Users
                  .AsNoTracking()
                  .SingleOrDefaultAsync(u => u.Id == request.NewAssigneeUserId && u.IsActive, cancellationToken);
              if (newAssignee is null) {
                  return Results.BadRequest(new { error = "The selected staff member is not found or inactive." });
              }

               // Prevent reassigning to the same user
               if (assignment.AssignedUserId == request.NewAssigneeUserId) {
                   return Results.BadRequest(new { error = "The assignment is already assigned to this user." });
               }

               var previousAssignedUserId = assignment.AssignedUserId;
               assignment.AssignedUserId = request.NewAssigneeUserId;
               assignment.AssignmentStatus = "Pending Acceptance";

               dbContext.AssignmentEvents.Add(new AssignmentEvent {
                   AssignmentId = assignment.Id,
                   EventType = "Handover",
                   PreviousAssignedUserId = previousAssignedUserId,
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

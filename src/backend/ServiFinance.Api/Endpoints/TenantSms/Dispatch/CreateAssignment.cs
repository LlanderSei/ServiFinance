namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class CreateAssignment {
    public static void MapCreateAssignment(this RouteGroupBuilder tenantApi) {
        tenantApi.MapPost("/sms/dispatch", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            [FromBody] CreateTenantAssignmentRequest request,
            ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
            CancellationToken cancellationToken) => {
              if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
                return Results.Forbid();
              }

              if (request.ServiceRequestId == Guid.Empty || request.AssignedUserId == Guid.Empty) {
                return Results.BadRequest(new { error = "A service request and assigned staff member are required." });
              }

              if (!TryGetCurrentUserId(httpContext.User, out var assignedByUserId)) {
                return Results.Unauthorized();
              }

              if (request.ScheduledStartUtc is not null &&
              request.ScheduledEndUtc is not null &&
              request.ScheduledEndUtc < request.ScheduledStartUtc) {
                return Results.BadRequest(new { error = "Scheduled end cannot be earlier than scheduled start." });
              }

              var serviceRequest = await dbContext.ServiceRequests
              .Include(entity => entity.Customer)
              .SingleOrDefaultAsync(entity => entity.Id == request.ServiceRequestId, cancellationToken);
              if (serviceRequest is null) {
                return Results.BadRequest(new { error = "The selected service request was not found." });
              }

              var assignedUser = await dbContext.Users
              .AsNoTracking()
              .SingleOrDefaultAsync(entity => entity.Id == request.AssignedUserId && entity.IsActive, cancellationToken);
              if (assignedUser is null) {
                return Results.BadRequest(new { error = "The selected staff member was not found or is inactive." });
              }

              var assignmentStatus = NormalizeAssignmentStatus(request.AssignmentStatus);
              var serviceStatus = DeriveServiceStatusFromAssignment(assignmentStatus);
              var scheduleConflictCount = await CountScheduleConflictsAsync(
              dbContext,
              request.AssignedUserId,
              request.ScheduledStartUtc,
              request.ScheduledEndUtc,
              assignmentStatus,
              null,
              cancellationToken);
              if (ShouldBlockScheduleConflict(
                assignmentStatus,
                request.ScheduledStartUtc,
                request.ScheduledEndUtc,
                scheduleConflictCount)) {
                return Results.BadRequest(new {
                  error = "The selected technician already has an overlapping scheduled or in-progress assignment in that time window."
                });
              }
              var assignment = new ServiFinance.Domain.Assignment {
                ServiceRequestId = request.ServiceRequestId,
                AssignedUserId = request.AssignedUserId,
                AssignedByUserId = assignedByUserId,
                ScheduledStartUtc = request.ScheduledStartUtc,
                ScheduledEndUtc = request.ScheduledEndUtc,
                AssignmentStatus = assignmentStatus,
                CreatedAtUtc = DateTime.UtcNow
              };

              dbContext.Assignments.Add(assignment);
              dbContext.AssignmentEvents.Add(new ServiFinance.Domain.AssignmentEvent {
                AssignmentId = assignment.Id,
                EventType = "Scheduled",
                AssignedUserId = assignment.AssignedUserId,
                ScheduledStartUtc = assignment.ScheduledStartUtc,
                ScheduledEndUtc = assignment.ScheduledEndUtc,
                AssignmentStatus = assignment.AssignmentStatus,
                Remarks = $"Assignment created for {assignedUser.FullName}.",
                ChangedByUserId = assignedByUserId,
                CreatedAtUtc = DateTime.UtcNow
              });
              serviceRequest.CurrentStatus = serviceStatus;
              dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
                ServiceRequestId = serviceRequest.Id,
                Status = serviceStatus,
                Remarks = $"Assignment scheduled for {assignedUser.FullName}.",
                ChangedByUserId = assignedByUserId,
                ChangedAtUtc = DateTime.UtcNow
              });
              await dbContext.SaveChangesAsync(cancellationToken);

              var assignedByUserName = await dbContext.Users
              .Where(entity => entity.Id == assignedByUserId)
              .Select(entity => entity.FullName)
              .SingleAsync(cancellationToken);

              return Results.Ok(CreateTenantDispatchAssignmentResponse(
              assignment.Id,
              assignment.ServiceRequestId,
              serviceRequest.RequestNumber,
              serviceRequest.Customer!.FullName,
              serviceRequest.ItemType,
              serviceRequest.Priority,
              serviceRequest.CurrentStatus,
              assignment.AssignedUserId,
              assignedUser.FullName,
              assignment.AssignedByUserId,
              assignedByUserName,
              assignment.ScheduledStartUtc,
              assignment.ScheduledEndUtc,
              assignment.AssignmentStatus,
              assignment.CreatedAtUtc,
              null,
              null,
              null,
              null,
              scheduleConflictCount,
              false));
            });
    }
}

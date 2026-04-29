namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class RescheduleAssignment {
    public static void MapRescheduleAssignment(this RouteGroupBuilder tenantApi) {
        tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/reschedule", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            [FromBody] RescheduleTenantAssignmentRequest request,
            ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
            CancellationToken cancellationToken) => {
              if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
                return Results.Forbid();
              }

              if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
                return Results.Unauthorized();
              }

              if (request.AssignedUserId == Guid.Empty) {
                return Results.BadRequest(new { error = "An assigned staff member is required." });
              }

              if (request.ScheduledStartUtc is not null &&
              request.ScheduledEndUtc is not null &&
              request.ScheduledEndUtc < request.ScheduledStartUtc) {
                return Results.BadRequest(new { error = "Scheduled end cannot be earlier than scheduled start." });
              }

              var assignment = await dbContext.Assignments
              .Include(entity => entity.ServiceRequest)
                  .ThenInclude(entity => entity!.Customer)
              .Include(entity => entity.ServiceRequest)
                  .ThenInclude(entity => entity!.Invoices)
                      .ThenInclude(entity => entity.MicroLoan)
              .Include(entity => entity.AssignedUser)
              .Include(entity => entity.AssignedByUser)
              .SingleOrDefaultAsync(entity => entity.Id == assignmentId, cancellationToken);
              if (assignment is null) {
                return Results.NotFound();
              }

              var reassignedUser = await dbContext.Users
              .AsNoTracking()
              .SingleOrDefaultAsync(entity => entity.Id == request.AssignedUserId && entity.IsActive, cancellationToken);
              if (reassignedUser is null) {
                return Results.BadRequest(new { error = "The selected staff member was not found or is inactive." });
              }

              var previousAssignedUserId = assignment.AssignedUserId;
              var previousAssignedUserName = assignment.AssignedUser!.FullName;
              var previousScheduledStartUtc = assignment.ScheduledStartUtc;
              var previousScheduledEndUtc = assignment.ScheduledEndUtc;
              var previousAssignmentStatus = assignment.AssignmentStatus;

              assignment.AssignedUserId = request.AssignedUserId;
              assignment.ScheduledStartUtc = request.ScheduledStartUtc;
              assignment.ScheduledEndUtc = request.ScheduledEndUtc;
              assignment.AssignmentStatus = NormalizeAssignmentStatus(request.AssignmentStatus);

              var scheduleConflictCount = await CountScheduleConflictsAsync(
              dbContext,
              assignment.AssignedUserId,
              assignment.ScheduledStartUtc,
              assignment.ScheduledEndUtc,
              assignment.AssignmentStatus,
              assignment.Id,
              cancellationToken);
              if (ShouldBlockScheduleConflict(
                assignment.AssignmentStatus,
                assignment.ScheduledStartUtc,
                assignment.ScheduledEndUtc,
                scheduleConflictCount)) {
                return Results.BadRequest(new {
                  error = "The updated technician schedule overlaps an existing scheduled or in-progress assignment."
                });
              }

              dbContext.AssignmentEvents.Add(new ServiFinance.Domain.AssignmentEvent {
                AssignmentId = assignment.Id,
                EventType = previousAssignedUserId == assignment.AssignedUserId ? "Rescheduled" : "Reassigned",
                PreviousAssignedUserId = previousAssignedUserId,
                AssignedUserId = assignment.AssignedUserId,
                PreviousScheduledStartUtc = previousScheduledStartUtc,
                PreviousScheduledEndUtc = previousScheduledEndUtc,
                ScheduledStartUtc = assignment.ScheduledStartUtc,
                ScheduledEndUtc = assignment.ScheduledEndUtc,
                AssignmentStatus = assignment.AssignmentStatus,
                Remarks = string.IsNullOrWhiteSpace(request.Remarks)
                  ? $"Assignment updated from {previousAssignedUserName} ({previousAssignmentStatus})."
                  : request.Remarks.Trim(),
                ChangedByUserId = currentUserId,
                CreatedAtUtc = DateTime.UtcNow
              });

              await dbContext.SaveChangesAsync(cancellationToken);

              return Results.Ok(CreateTenantDispatchAssignmentResponse(
              assignment.Id,
              assignment.ServiceRequestId,
              assignment.ServiceRequest!.RequestNumber,
              assignment.ServiceRequest.Customer!.FullName,
              assignment.ServiceRequest.ItemType,
              assignment.ServiceRequest.Priority,
              assignment.ServiceRequest.CurrentStatus,
              assignment.AssignedUserId,
              reassignedUser.FullName,
              assignment.AssignedByUserId,
              assignment.AssignedByUser!.FullName,
              assignment.ScheduledStartUtc,
              assignment.ScheduledEndUtc,
              assignment.AssignmentStatus,
              assignment.CreatedAtUtc,
              assignment.ServiceRequest.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => invoice.InvoiceNumber)
                  .FirstOrDefault(),
              assignment.ServiceRequest.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => invoice.InvoiceStatus)
                  .FirstOrDefault(),
              assignment.ServiceRequest.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => (decimal?)invoice.OutstandingAmount)
                  .FirstOrDefault(),
              assignment.ServiceRequest.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => (decimal?)invoice.InterestableAmount)
                  .FirstOrDefault(),
              scheduleConflictCount,
              assignment.ServiceRequest.Invoices.Any(invoice => invoice.MicroLoan != null)));
            });
    }
}

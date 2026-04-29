namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class UpdateAssignmentStatus {
    public static void MapUpdateAssignmentStatus(this RouteGroupBuilder tenantApi) {
        tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/status", async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            [FromBody] UpdateTenantAssignmentStatusRequest request,
            ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
            CancellationToken cancellationToken) => {
              if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
                return Results.Forbid();
              }

              if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
                return Results.Unauthorized();
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

              var isAdmin = IsTenantAdministrator(httpContext.User);
              if (!isAdmin && assignment.AssignedUserId != currentUserId) {
                return Results.Forbid();
              }

              var assignmentStatus = NormalizeAssignmentStatus(request.AssignmentStatus);
              var serviceStatus = string.IsNullOrWhiteSpace(request.ServiceStatus)
              ? DeriveServiceStatusFromAssignment(assignmentStatus)
              : request.ServiceStatus.Trim();
              var scheduleConflictCount = await CountScheduleConflictsAsync(
              dbContext,
              assignment.AssignedUserId,
              assignment.ScheduledStartUtc,
              assignment.ScheduledEndUtc,
              assignmentStatus,
              assignment.Id,
              cancellationToken);
              if (ShouldBlockScheduleConflict(
                assignmentStatus,
                assignment.ScheduledStartUtc,
                assignment.ScheduledEndUtc,
                scheduleConflictCount)) {
                return Results.BadRequest(new {
                  error = "This status change would keep the assignment in a conflicting scheduled window."
                });
              }

              assignment.AssignmentStatus = assignmentStatus;
              assignment.ServiceRequest!.CurrentStatus = serviceStatus;
              dbContext.AssignmentEvents.Add(new ServiFinance.Domain.AssignmentEvent {
                AssignmentId = assignment.Id,
                EventType = "StatusUpdated",
                PreviousAssignedUserId = assignment.AssignedUserId,
                AssignedUserId = assignment.AssignedUserId,
                PreviousScheduledStartUtc = assignment.ScheduledStartUtc,
                PreviousScheduledEndUtc = assignment.ScheduledEndUtc,
                ScheduledStartUtc = assignment.ScheduledStartUtc,
                ScheduledEndUtc = assignment.ScheduledEndUtc,
                AssignmentStatus = assignment.AssignmentStatus,
                Remarks = string.IsNullOrWhiteSpace(request.Remarks)
                  ? $"Assignment moved to {assignmentStatus}."
                  : request.Remarks.Trim(),
                ChangedByUserId = currentUserId,
                CreatedAtUtc = DateTime.UtcNow
              });
              dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
                ServiceRequestId = assignment.ServiceRequestId,
                Status = serviceStatus,
                Remarks = string.IsNullOrWhiteSpace(request.Remarks)
                  ? $"Assignment moved to {assignmentStatus}."
                  : request.Remarks.Trim(),
                ChangedByUserId = currentUserId,
                ChangedAtUtc = DateTime.UtcNow
              });
              await dbContext.SaveChangesAsync(cancellationToken);

              return Results.Ok(CreateTenantDispatchAssignmentResponse(
              assignment.Id,
              assignment.ServiceRequestId,
              assignment.ServiceRequest.RequestNumber,
              assignment.ServiceRequest.Customer!.FullName,
              assignment.ServiceRequest.ItemType,
              assignment.ServiceRequest.Priority,
              assignment.ServiceRequest.CurrentStatus,
              assignment.AssignedUserId,
              assignment.AssignedUser!.FullName,
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

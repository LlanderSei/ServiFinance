namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class GetAssignmentDetails {
    public static void MapGetAssignmentDetails(this RouteGroupBuilder tenantApi) {
        tenantApi.MapGet("/sms/dispatch/{assignmentId:guid}/details", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
            CancellationToken cancellationToken) => {
              if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
                return Results.Forbid();
              }

              if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
                return Results.Unauthorized();
              }

              var assignment = await dbContext.Assignments
              .AsNoTracking()
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

              var auditTrail = await dbContext.StatusLogs
              .AsNoTracking()
              .Where(entity => entity.ServiceRequestId == assignment.ServiceRequestId)
              .OrderByDescending(entity => entity.ChangedAtUtc)
              .Select(entity => new TenantServiceRequestAuditRowResponse(
                  entity.Id,
                  entity.Status,
                  entity.Remarks,
                  entity.ChangedByUser!.FullName,
                  entity.ChangedAtUtc))
              .ToListAsync(cancellationToken);

              var events = await dbContext.AssignmentEvents
              .AsNoTracking()
              .Where(entity => entity.AssignmentId == assignmentId)
              .OrderByDescending(entity => entity.CreatedAtUtc)
              .Select(entity => new TenantDispatchAssignmentEventRowResponse(
                  entity.Id,
                  entity.EventType,
                  entity.AssignedUser!.FullName,
                  entity.PreviousAssignedUser != null ? entity.PreviousAssignedUser.FullName : null,
                  entity.ScheduledStartUtc,
                  entity.ScheduledEndUtc,
                  entity.PreviousScheduledStartUtc,
                  entity.PreviousScheduledEndUtc,
                  entity.AssignmentStatus,
                  entity.Remarks,
                  entity.ChangedByUser!.FullName,
                  entity.CreatedAtUtc))
              .ToListAsync(cancellationToken);

              var evidence = await dbContext.AssignmentEvidenceItems
              .AsNoTracking()
              .Where(entity => entity.AssignmentId == assignmentId)
              .OrderByDescending(entity => entity.CreatedAtUtc)
              .Select(entity => new TenantDispatchAssignmentEvidenceRowResponse(
                  entity.Id,
                  entity.SubmittedByUserId,
                  entity.Note,
                  entity.OriginalFileName,
                  entity.RelativeUrl,
                  entity.SubmittedByUser!.FullName,
                  entity.CreatedAtUtc))
              .ToListAsync(cancellationToken);

              var conflicts = await dbContext.Assignments
              .AsNoTracking()
              .Include(entity => entity.ServiceRequest)
                  .ThenInclude(entity => entity!.Customer)
              .Include(entity => entity.AssignedUser)
              .Where(entity => entity.Id != assignment.Id && entity.AssignedUserId == assignment.AssignedUserId)
              .Where(entity => entity.AssignmentStatus == "Scheduled" || entity.AssignmentStatus == "In Progress" || entity.AssignmentStatus == "On Hold")
              .ToListAsync(cancellationToken);

              var conflictRows = IsConflictEligibleStatus(assignment.AssignmentStatus)
              ? conflicts
                  .Where(entity => SchedulesOverlap(
                      entity.ScheduledStartUtc,
                      entity.ScheduledEndUtc,
                      assignment.ScheduledStartUtc,
                      assignment.ScheduledEndUtc))
                  .Select(entity => new TenantDispatchConflictRowResponse(
                      entity.Id,
                      entity.ServiceRequest!.RequestNumber,
                      entity.ServiceRequest.Customer!.FullName,
                      entity.AssignedUser!.FullName,
                      entity.ScheduledStartUtc,
                      entity.ScheduledEndUtc,
                      entity.AssignmentStatus))
                  .ToList()
              : [];

              return Results.Ok(new TenantDispatchAssignmentDetailResponse(
              CreateTenantDispatchAssignmentResponse(
                  assignment.Id,
                  assignment.ServiceRequestId,
                  assignment.ServiceRequest!.RequestNumber,
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
                  conflictRows.Count,
                  assignment.ServiceRequest.Invoices.Any(invoice => invoice.MicroLoan != null)),
              auditTrail,
              events,
              evidence,
              conflictRows));
            });
    }
}

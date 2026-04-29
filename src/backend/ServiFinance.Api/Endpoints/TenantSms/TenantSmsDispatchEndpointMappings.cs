namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

// Request DTOs for assignment actions
internal sealed record CancelAssignmentRequest(string Reason);
internal sealed record HandoverAssignmentRequest(Guid NewAssigneeUserId, string Reason);
internal sealed record AbandonAssignmentRequest(string Reason);

internal static class TenantSmsDispatchEndpointMappings {
  public static RouteGroupBuilder MapTenantSmsDispatchEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/sms/dispatch", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid? assignedUserId,
        string? assignmentStatus,
        string? priority,
        DateTime? dateFrom,
        DateTime? dateTo,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var assignmentQuery = dbContext.Assignments
          .AsNoTracking()
          .Include(entity => entity.ServiceRequest)
              .ThenInclude(entity => entity!.Customer)
          .Include(entity => entity.AssignedUser)
          .Include(entity => entity.AssignedByUser)
          .AsQueryable();

          if (!IsTenantAdministrator(httpContext.User)) {
            assignmentQuery = assignmentQuery.Where(entity => entity.AssignedUserId == currentUserId);
          }

          if (assignedUserId.HasValue) {
            assignmentQuery = assignmentQuery.Where(entity => entity.AssignedUserId == assignedUserId.Value);
          }

          if (!string.IsNullOrWhiteSpace(assignmentStatus)) {
            var normalizedAssignmentStatus = NormalizeAssignmentStatus(assignmentStatus);
            assignmentQuery = assignmentQuery.Where(entity => entity.AssignmentStatus == normalizedAssignmentStatus);
          }

          if (!string.IsNullOrWhiteSpace(priority)) {
            var normalizedPriority = priority.Trim();
            assignmentQuery = assignmentQuery.Where(entity => entity.ServiceRequest!.Priority == normalizedPriority);
          }

          if (dateFrom.HasValue) {
            assignmentQuery = assignmentQuery.Where(entity =>
            (entity.ScheduledEndUtc ?? entity.ScheduledStartUtc ?? entity.CreatedAtUtc) >= dateFrom.Value);
          }

          if (dateTo.HasValue) {
            assignmentQuery = assignmentQuery.Where(entity =>
            (entity.ScheduledStartUtc ?? entity.ScheduledEndUtc ?? entity.CreatedAtUtc) <= dateTo.Value);
          }

          var assignments = await assignmentQuery
          .OrderByDescending(entity => entity.CreatedAtUtc)
          .Select(entity => new {
            entity.Id,
            entity.ServiceRequestId,
            RequestNumber = entity.ServiceRequest!.RequestNumber,
            CustomerName = entity.ServiceRequest!.Customer!.FullName,
            ItemType = entity.ServiceRequest!.ItemType,
            Priority = entity.ServiceRequest!.Priority,
            ServiceStatus = entity.ServiceRequest!.CurrentStatus,
            entity.AssignedUserId,
            AssignedUserName = entity.AssignedUser!.FullName,
            entity.AssignedByUserId,
            AssignedByUserName = entity.AssignedByUser!.FullName,
            entity.ScheduledStartUtc,
            entity.ScheduledEndUtc,
            entity.AssignmentStatus,
            entity.CreatedAtUtc,
            InvoiceNumber = entity.ServiceRequest!.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => invoice.InvoiceNumber)
                  .FirstOrDefault(),
            InvoiceStatus = entity.ServiceRequest.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => invoice.InvoiceStatus)
                  .FirstOrDefault(),
            InvoiceOutstandingAmount = entity.ServiceRequest.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => (decimal?)invoice.OutstandingAmount)
                  .FirstOrDefault(),
            InterestableAmount = entity.ServiceRequest.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => (decimal?)invoice.InterestableAmount)
                  .FirstOrDefault(),
            HasMicroLoan = entity.ServiceRequest.Invoices.Any(invoice => invoice.MicroLoan != null)
          })
          .ToListAsync(cancellationToken);

          return Results.Ok(assignments.Select(entity => CreateTenantDispatchAssignmentResponse(
          entity.Id,
          entity.ServiceRequestId,
          entity.RequestNumber,
          entity.CustomerName,
          entity.ItemType,
          entity.Priority,
          entity.ServiceStatus,
          entity.AssignedUserId,
          entity.AssignedUserName,
          entity.AssignedByUserId,
          entity.AssignedByUserName,
          entity.ScheduledStartUtc,
          entity.ScheduledEndUtc,
          entity.AssignmentStatus,
          entity.CreatedAtUtc,
          entity.InvoiceNumber,
          entity.InvoiceStatus,
          entity.InvoiceOutstandingAmount,
          entity.InterestableAmount,
          CountScheduleConflictsInList(
              assignments,
              entity,
              item => item.Id,
              item => item.AssignedUserId,
              item => item.AssignmentStatus,
              item => item.ScheduledStartUtc,
              item => item.ScheduledEndUtc),
          entity.HasMicroLoan)));
        });
    tenantApi.MapGet("/sms/dispatch/{assignmentId:guid}/details", async Task<IResult> (
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
    tenantApi.MapGet("/sms/dispatch/meta", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var assignableUsers = await dbContext.Users
          .AsNoTracking()
          .Where(entity => entity.IsActive)
          .OrderBy(entity => entity.FullName)
          .Select(entity => new {
            entity.Id,
            entity.FullName,
            entity.Email,
            Roles = entity.UserRoles.Select(role => role.Role!.Name).ToArray()
          })
          .ToListAsync(cancellationToken);

          var schedulableRequests = await dbContext.ServiceRequests
          .AsNoTracking()
          .Where(entity => entity.CurrentStatus != "Completed")
          .OrderByDescending(entity => entity.CreatedAtUtc)
          .Select(entity => new {
            entity.Id,
            entity.RequestNumber,
            CustomerName = entity.Customer!.FullName,
            entity.ItemType,
            entity.Priority,
            entity.CurrentStatus
          })
          .ToListAsync(cancellationToken);

          return Results.Ok(new {
            AssignableUsers = assignableUsers,
            ServiceRequests = schedulableRequests
          });
        });
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
    tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/evidence", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid assignmentId,
        [FromForm] SubmitTenantAssignmentEvidenceRequest request,
        IWebHostEnvironment environment,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var assignment = await dbContext.Assignments
          .Include(entity => entity.AssignedUser)
          .SingleOrDefaultAsync(entity => entity.Id == assignmentId, cancellationToken);
          if (assignment is null) {
            return Results.NotFound();
          }

          var isAdmin = IsTenantAdministrator(httpContext.User);
          if (!isAdmin && assignment.AssignedUserId != currentUserId) {
            return Results.Forbid();
          }

          if (string.IsNullOrWhiteSpace(request.Note) && request.Files.Count == 0) {
            return Results.BadRequest(new { error = "Add a note or at least one photo attachment." });
          }

          var webRootPath = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
          var uploadDirectory = Path.Combine(
          webRootPath,
          "uploads",
          "assignment-evidence",
          tenantDomainSlug,
          assignmentId.ToString("N"));
          Directory.CreateDirectory(uploadDirectory);

          foreach (var file in request.Files) {
            if (file.Length <= 0) {
              continue;
            }

            if (file.Length > 5 * 1024 * 1024) {
              return Results.BadRequest(new { error = $"File '{file.FileName}' exceeds the 5 MB upload limit." });
            }

            var extension = Path.GetExtension(file.FileName);
            var storedFileName = $"evidence-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{extension}";
            var absoluteFilePath = Path.Combine(uploadDirectory, storedFileName);

            await using (var stream = File.Create(absoluteFilePath)) {
              await file.CopyToAsync(stream, cancellationToken);
            }

            dbContext.AssignmentEvidenceItems.Add(new ServiFinance.Domain.AssignmentEvidence {
              AssignmentId = assignment.Id,
              SubmittedByUserId = currentUserId,
              Note = request.Note?.Trim() ?? string.Empty,
              OriginalFileName = file.FileName,
              StoredFileName = storedFileName,
              ContentType = file.ContentType,
              RelativeUrl = $"/uploads/assignment-evidence/{tenantDomainSlug}/{assignmentId:N}/{storedFileName}",
              CreatedAtUtc = DateTime.UtcNow
            });
          }

          if (request.Files.Count == 0) {
            dbContext.AssignmentEvidenceItems.Add(new ServiFinance.Domain.AssignmentEvidence {
              AssignmentId = assignment.Id,
              SubmittedByUserId = currentUserId,
              Note = request.Note?.Trim() ?? string.Empty,
              CreatedAtUtc = DateTime.UtcNow
            });
          }

          dbContext.AssignmentEvents.Add(new ServiFinance.Domain.AssignmentEvent {
            AssignmentId = assignment.Id,
            EventType = "EvidenceSubmitted",
            PreviousAssignedUserId = assignment.AssignedUserId,
            AssignedUserId = assignment.AssignedUserId,
            PreviousScheduledStartUtc = assignment.ScheduledStartUtc,
            PreviousScheduledEndUtc = assignment.ScheduledEndUtc,
            ScheduledStartUtc = assignment.ScheduledStartUtc,
            ScheduledEndUtc = assignment.ScheduledEndUtc,
            AssignmentStatus = assignment.AssignmentStatus,
            Remarks = string.IsNullOrWhiteSpace(request.Note)
              ? $"Evidence submitted with {request.Files.Count} attachment(s)."
              : request.Note.Trim(),
            ChangedByUserId = currentUserId,
            CreatedAtUtc = DateTime.UtcNow
          });

          await dbContext.SaveChangesAsync(cancellationToken);

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

          return Results.Ok(evidence);
        });
    tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/evidence/{evidenceId:guid}/note", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid assignmentId,
        Guid evidenceId,
        [FromBody] UpdateTenantAssignmentEvidenceRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var evidence = await dbContext.AssignmentEvidenceItems
          .Include(entity => entity.Assignment)
          .Include(entity => entity.SubmittedByUser)
          .SingleOrDefaultAsync(entity => entity.Id == evidenceId && entity.AssignmentId == assignmentId, cancellationToken);
          if (evidence is null) {
            return Results.NotFound();
          }

          var isAdmin = IsTenantAdministrator(httpContext.User);
          if (!isAdmin && evidence.SubmittedByUserId != currentUserId) {
            return Results.Forbid();
          }

          evidence.Note = request.Note?.Trim() ?? string.Empty;
          dbContext.AssignmentEvents.Add(new ServiFinance.Domain.AssignmentEvent {
            AssignmentId = assignmentId,
            EventType = "EvidenceUpdated",
            PreviousAssignedUserId = evidence.Assignment!.AssignedUserId,
            AssignedUserId = evidence.Assignment.AssignedUserId,
            PreviousScheduledStartUtc = evidence.Assignment.ScheduledStartUtc,
            PreviousScheduledEndUtc = evidence.Assignment.ScheduledEndUtc,
            ScheduledStartUtc = evidence.Assignment.ScheduledStartUtc,
            ScheduledEndUtc = evidence.Assignment.ScheduledEndUtc,
            AssignmentStatus = evidence.Assignment.AssignmentStatus,
            Remarks = string.IsNullOrWhiteSpace(evidence.Note)
              ? "Technician evidence note cleared."
              : "Technician evidence note updated.",
            ChangedByUserId = currentUserId,
            CreatedAtUtc = DateTime.UtcNow
          });

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new TenantDispatchAssignmentEvidenceRowResponse(
            evidence.Id,
            evidence.SubmittedByUserId,
            evidence.Note,
            evidence.OriginalFileName,
            evidence.RelativeUrl,
            evidence.SubmittedByUser!.FullName,
            evidence.CreatedAtUtc));
        });
    tenantApi.MapDelete("/sms/dispatch/{assignmentId:guid}/evidence/{evidenceId:guid}", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid assignmentId,
        Guid evidenceId,
        IWebHostEnvironment environment,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var evidence = await dbContext.AssignmentEvidenceItems
          .Include(entity => entity.Assignment)
          .SingleOrDefaultAsync(entity => entity.Id == evidenceId && entity.AssignmentId == assignmentId, cancellationToken);
          if (evidence is null) {
            return Results.NotFound();
          }

          var isAdmin = IsTenantAdministrator(httpContext.User);
          if (!isAdmin && evidence.SubmittedByUserId != currentUserId) {
            return Results.Forbid();
          }

          if (!string.IsNullOrWhiteSpace(evidence.StoredFileName)) {
            var webRootPath = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
            var filePath = Path.Combine(
              webRootPath,
              "uploads",
              "assignment-evidence",
              tenantDomainSlug,
              assignmentId.ToString("N"),
              evidence.StoredFileName);
            if (File.Exists(filePath)) {
              File.Delete(filePath);
            }
          }

          dbContext.AssignmentEvents.Add(new ServiFinance.Domain.AssignmentEvent {
            AssignmentId = assignmentId,
            EventType = "EvidenceRemoved",
            PreviousAssignedUserId = evidence.Assignment!.AssignedUserId,
            AssignedUserId = evidence.Assignment.AssignedUserId,
            PreviousScheduledStartUtc = evidence.Assignment.ScheduledStartUtc,
            PreviousScheduledEndUtc = evidence.Assignment.ScheduledEndUtc,
            ScheduledStartUtc = evidence.Assignment.ScheduledStartUtc,
            ScheduledEndUtc = evidence.Assignment.ScheduledEndUtc,
            AssignmentStatus = evidence.Assignment.AssignmentStatus,
            Remarks = string.IsNullOrWhiteSpace(evidence.OriginalFileName)
              ? "Technician evidence note removed."
              : $"Technician evidence '{evidence.OriginalFileName}' removed.",
            ChangedByUserId = currentUserId,
            CreatedAtUtc = DateTime.UtcNow
          });
          dbContext.AssignmentEvidenceItems.Remove(evidence);
          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.NoContent();
        });

      // Cancel assignment
      tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/cancel", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
          HttpContext httpContext,
          string tenantDomainSlug,
          Guid assignmentId,
          [FromBody] CancelAssignmentRequest request,
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

            if (assignment.AssignmentStatus == "Completed" || assignment.AssignmentStatus == "Cancelled") {
                return Results.BadRequest(new { error = "Cannot cancel an assignment that is already completed or cancelled." });
            }

            if (string.IsNullOrWhiteSpace(request.Reason)) {
                return Results.BadRequest(new { error = "Cancellation reason is required." });
            }

            assignment.AssignmentStatus = "Cancelled";

            dbContext.AssignmentEvents.Add(new AssignmentEvent {
                AssignmentId = assignment.Id,
                EventType = "Cancelled",
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

       // Handover assignment (reassign to another user)
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

            if (assignment.AssignmentStatus == "Completed" || assignment.AssignmentStatus == "Cancelled") {
                return Results.BadRequest(new { error = "Cannot handover an assignment that is already completed or cancelled." });
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

      // Abandon assignment
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

    return tenantApi;
  }
}

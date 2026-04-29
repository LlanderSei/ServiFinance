namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class GetAssignments {
    public static void MapGetAssignments(this RouteGroupBuilder tenantApi) {
        tenantApi.MapGet("/sms/dispatch", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
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
    }
}

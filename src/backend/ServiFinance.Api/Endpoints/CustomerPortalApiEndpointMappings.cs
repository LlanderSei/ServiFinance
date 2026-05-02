namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;
using System.Security.Claims;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class CustomerPortalApiEndpointMappings {
  private const int FeedbackCommentsMaxLength = 1000;

  public static RouteGroupBuilder MapCustomerPortalApiEndpoints(this RouteGroupBuilder api) {
    var customerApi = api.MapGroup("/customer-portal")
        .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = ApiAuthenticationSchemes })
        .RequireAuthorization(policy => policy.RequireAssertion(context =>
            context.User.HasClaim(c => c.Type == "surface" && c.Value == "CustomerWeb")));

    customerApi.MapGet("/requests", async Task<IResult> (
        ClaimsPrincipal user,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

          var requests = await dbContext.ServiceRequests
              .AsNoTracking()
              .Where(r => r.CustomerId == customerId)
              .OrderByDescending(r => r.CreatedAtUtc)
              .Select(r => new {
                r.Id,
                r.RequestNumber,
                r.ItemType,
                r.ItemDescription,
                r.IssueDescription,
                r.Priority,
                r.CurrentStatus,
                r.CreatedAtUtc,
                r.Rating,
                r.FeedbackComments
              })
              .ToListAsync(cancellationToken);

          return Results.Ok(requests);
        });

    customerApi.MapGet("/requests/{id:guid}/details", async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

          var request = await dbContext.ServiceRequests
              .AsNoTracking()
              .Where(r => r.Id == id && r.CustomerId == customerId)
              .Select(r => new CustomerPortalRequestDetailRecord(
                  r.Id,
                  r.RequestNumber,
                  r.ItemType,
                  r.ItemDescription,
                  r.IssueDescription,
                  r.RequestedServiceDate,
                  r.Priority,
                  r.CurrentStatus,
                  r.CreatedAtUtc,
                  r.Rating,
                  r.FeedbackComments,
                  r.Invoices
                      .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                      .Select(invoice => new CustomerPortalRequestInvoiceRecord(
                          invoice.Id,
                          invoice.InvoiceNumber,
                          invoice.InvoiceStatus,
                          invoice.TotalAmount,
                          invoice.OutstandingAmount,
                          invoice.InvoiceDateUtc,
                          invoice.MicroLoan != null,
                          invoice.MicroLoan != null ? invoice.MicroLoan.LoanStatus : null))
                      .FirstOrDefault()))
              .SingleOrDefaultAsync(cancellationToken);

          if (request is null) {
            return Results.NotFound();
          }

          var timeline = await dbContext.StatusLogs
              .AsNoTracking()
              .Where(log => log.ServiceRequestId == id)
              .OrderByDescending(log => log.ChangedAtUtc)
              .Select(log => new CustomerPortalTimelineEntryRecord(
                  log.Id,
                  log.Status,
                  log.Remarks,
                  log.ChangedAtUtc,
                  log.ChangedByUser != null ? log.ChangedByUser.FullName : "Customer portal"))
              .ToListAsync(cancellationToken);

          var assignments = await dbContext.Assignments
              .AsNoTracking()
              .Where(assignment => assignment.ServiceRequestId == id)
              .OrderByDescending(assignment => assignment.CreatedAtUtc)
              .Select(assignment => new CustomerPortalAssignmentRecord(
                  assignment.Id,
                  assignment.AssignmentStatus,
                  assignment.ScheduledStartUtc,
                  assignment.ScheduledEndUtc,
                  assignment.CreatedAtUtc,
                  assignment.AssignedUser != null ? assignment.AssignedUser.FullName : "Pending assignment",
                  assignment.AssignedByUser != null ? assignment.AssignedByUser.FullName : "Tenant staff"))
              .ToListAsync(cancellationToken);

          return Results.Ok(new CustomerPortalRequestDetailsResponse(
              request,
              timeline,
              assignments));
        });

    customerApi.MapPost("/requests", async Task<IResult> (
        ClaimsPrincipal user,
        [FromBody] CreateCustomerRequestPayload payload,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var tenantId = Guid.Parse(user.FindFirstValue("tenant_id")!);

          var request = new ServiceRequest {
              Id = Guid.NewGuid(),
              TenantId = tenantId,
              CustomerId = customerId,
              RequestNumber = "SR-" + Guid.NewGuid().ToString()[..6].ToUpper(),
              ItemType = payload.ItemType,
              ItemDescription = payload.ItemDescription,
              IssueDescription = payload.IssueDescription,
              Priority = "Normal",
              CurrentStatus = "New",
              CreatedByUserId = customerId,
              CreatedAtUtc = DateTime.UtcNow
          };

          dbContext.ServiceRequests.Add(request);
          
          var statusLog = new StatusLog {
              Id = Guid.NewGuid(),
              TenantId = tenantId,
              ServiceRequestId = request.Id,
              Status = "New",
              Remarks = "Request created by customer",
              ChangedByUserId = customerId,
              ChangedAtUtc = DateTime.UtcNow
          };
          dbContext.StatusLogs.Add(statusLog);

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new { request.Id, request.RequestNumber });
        });

    customerApi.MapGet("/invoices", async Task<IResult> (
        ClaimsPrincipal user,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

          var invoices = await dbContext.Invoices
              .AsNoTracking()
              .Include(i => i.ServiceRequest)
              .Where(i => i.CustomerId == customerId)
              .OrderByDescending(i => i.InvoiceDateUtc)
              .Select(i => new {
                i.Id,
                i.InvoiceNumber,
                i.InvoiceDateUtc,
                i.TotalAmount,
                i.OutstandingAmount,
                i.InvoiceStatus,
                ServiceRequestId = i.ServiceRequestId,
                ServiceRequestNumber = i.ServiceRequest != null ? i.ServiceRequest.RequestNumber : null,
                HasMicroLoan = i.MicroLoan != null,
                MicroLoanStatus = i.MicroLoan != null ? i.MicroLoan.LoanStatus : null
              })
              .ToListAsync(cancellationToken);

          return Results.Ok(invoices);
        });

    customerApi.MapPost("/requests/{id:guid}/feedback", async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        [FromBody] SubmitFeedbackPayload payload,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

          var request = await dbContext.ServiceRequests
              .Where(r => r.Id == id && r.CustomerId == customerId)
              .FirstOrDefaultAsync(cancellationToken);

          if (request is null) {
            return Results.NotFound();
          }

          if (payload.Rating < 1 || payload.Rating > 5) {
            return Results.BadRequest(new { error = "Rating must be between 1 and 5." });
          }
          if ((payload.FeedbackComments?.Length ?? 0) > FeedbackCommentsMaxLength) {
            return Results.BadRequest(new { error = $"Feedback comments must be {FeedbackCommentsMaxLength} characters or fewer." });
          }

          request.Rating = payload.Rating;
          request.FeedbackComments = payload.FeedbackComments;

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok();
        });

    return customerApi;
  }
}

public sealed record CreateCustomerRequestPayload(string ItemType, string ItemDescription, string IssueDescription);
public sealed record SubmitFeedbackPayload(int Rating, string? FeedbackComments);
public sealed record CustomerPortalRequestInvoiceRecord(
    Guid Id,
    string InvoiceNumber,
    string InvoiceStatus,
    decimal TotalAmount,
    decimal OutstandingAmount,
    DateTime InvoiceDateUtc,
    bool HasMicroLoan,
    string? MicroLoanStatus);
public sealed record CustomerPortalRequestDetailRecord(
    Guid Id,
    string RequestNumber,
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    DateTime? RequestedServiceDate,
    string Priority,
    string CurrentStatus,
    DateTime CreatedAtUtc,
    int? Rating,
    string? FeedbackComments,
    CustomerPortalRequestInvoiceRecord? Invoice);
public sealed record CustomerPortalTimelineEntryRecord(
    Guid Id,
    string Status,
    string Remarks,
    DateTime ChangedAtUtc,
    string ChangedByLabel);
public sealed record CustomerPortalAssignmentRecord(
    Guid Id,
    string AssignmentStatus,
    DateTime? ScheduledStartUtc,
    DateTime? ScheduledEndUtc,
    DateTime CreatedAtUtc,
    string AssignedUserName,
    string AssignedByUserName);
public sealed record CustomerPortalRequestDetailsResponse(
    CustomerPortalRequestDetailRecord Request,
    IReadOnlyList<CustomerPortalTimelineEntryRecord> Timeline,
    IReadOnlyList<CustomerPortalAssignmentRecord> Assignments);

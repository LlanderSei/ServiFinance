namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;
using System.Security.Claims;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class CustomerPortalApiEndpointMappings {
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
                ServiceRequestNumber = i.ServiceRequest != null ? i.ServiceRequest.RequestNumber : null
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

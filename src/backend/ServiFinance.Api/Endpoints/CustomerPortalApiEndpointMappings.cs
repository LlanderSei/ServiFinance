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
  private const int FeedbackSuggestionCategoryMaxLength = 80;
  private const int FeedbackWindowDays = 7;
  private const long AttachmentMaxBytes = 5 * 1024 * 1024;

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
                r.FeedbackComments,
                r.FeedbackSuggestionCategory,
                r.CompletedAtUtc,
                r.FeedbackSubmittedAtUtc,
                r.FeedbackExpiresAtUtc
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
                  r.FeedbackSuggestionCategory,
                  r.CompletedAtUtc,
                  r.FeedbackSubmittedAtUtc,
                  r.FeedbackExpiresAtUtc,
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
                  log.ChangedByUser != null
                      ? log.ChangedByUser.FullName
                      : log.ChangedByCustomer != null
                          ? log.ChangedByCustomer.FullName
                          : "Customer portal"))
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

          var attachments = await dbContext.ServiceRequestAttachments
              .AsNoTracking()
              .Where(attachment => attachment.ServiceRequestId == id)
              .OrderByDescending(attachment => attachment.CreatedAtUtc)
              .Select(attachment => new CustomerPortalRequestAttachmentRecord(
                  attachment.Id,
                  attachment.OriginalFileName,
                  attachment.ContentType,
                  attachment.RelativeUrl,
                  attachment.CreatedAtUtc))
              .ToListAsync(cancellationToken);

          return Results.Ok(new CustomerPortalRequestDetailsResponse(
              request,
              timeline,
              assignments,
              attachments));
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
              CreatedByCustomerId = customerId,
              CreatedAtUtc = DateTime.UtcNow
          };

          dbContext.ServiceRequests.Add(request);
          
          var statusLog = new StatusLog {
              Id = Guid.NewGuid(),
              TenantId = tenantId,
              ServiceRequestId = request.Id,
              Status = "New",
              Remarks = "Request created by customer",
              ChangedByCustomerId = customerId,
              ChangedAtUtc = DateTime.UtcNow
          };
          dbContext.StatusLogs.Add(statusLog);

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new { request.Id, request.RequestNumber });
        });

    customerApi.MapPost("/requests/{id:guid}/attachments", async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        [FromForm] SubmitCustomerServiceRequestAttachmentRequest payload,
        IWebHostEnvironment environment,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var tenantDomainSlug = user.FindFirstValue("tenant_domain_slug") ?? "tenant";

          var request = await dbContext.ServiceRequests
              .AsNoTracking()
              .Where(r => r.Id == id && r.CustomerId == customerId)
              .Select(r => new {
                r.Id,
                r.CurrentStatus
              })
              .SingleOrDefaultAsync(cancellationToken);

          if (request is null) {
            return Results.NotFound();
          }

          if (IsFeedbackEligibleStatus(request.CurrentStatus)) {
            return Results.BadRequest(new { error = "Attachments cannot be added after the service request is completed." });
          }

          if (payload.Files.Count == 0) {
            return Results.BadRequest(new { error = "Select at least one picture to upload." });
          }

          var webRootPath = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
          var uploadDirectory = Path.Combine(
              webRootPath,
              "uploads",
              "service-request-attachments",
              tenantDomainSlug,
              id.ToString("N"));
          Directory.CreateDirectory(uploadDirectory);

          foreach (var file in payload.Files) {
            if (file.Length <= 0) {
              continue;
            }

            if (file.Length > AttachmentMaxBytes) {
              return Results.BadRequest(new { error = $"File '{file.FileName}' exceeds the 5 MB upload limit." });
            }

            if (!IsSupportedImage(file)) {
              return Results.BadRequest(new { error = $"File '{file.FileName}' must be an image." });
            }

            var extension = Path.GetExtension(file.FileName);
            var storedFileName = $"request-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{extension}";
            var absoluteFilePath = Path.Combine(uploadDirectory, storedFileName);

            await using (var stream = File.Create(absoluteFilePath)) {
              await file.CopyToAsync(stream, cancellationToken);
            }

            dbContext.ServiceRequestAttachments.Add(new ServiceRequestAttachment {
              ServiceRequestId = id,
              SubmittedByCustomerId = customerId,
              OriginalFileName = file.FileName,
              StoredFileName = storedFileName,
              ContentType = file.ContentType,
              RelativeUrl = $"/uploads/service-request-attachments/{tenantDomainSlug}/{id:N}/{storedFileName}",
              CreatedAtUtc = DateTime.UtcNow
            });
          }

          await dbContext.SaveChangesAsync(cancellationToken);

          var attachments = await dbContext.ServiceRequestAttachments
              .AsNoTracking()
              .Where(attachment => attachment.ServiceRequestId == id)
              .OrderByDescending(attachment => attachment.CreatedAtUtc)
              .Select(attachment => new CustomerPortalRequestAttachmentRecord(
                  attachment.Id,
                  attachment.OriginalFileName,
                  attachment.ContentType,
                  attachment.RelativeUrl,
                  attachment.CreatedAtUtc))
              .ToListAsync(cancellationToken);

          return Results.Ok(attachments);
        }).DisableAntiforgery();

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

          if (!IsFeedbackEligibleStatus(request.CurrentStatus)) {
            return Results.BadRequest(new { error = "Feedback can only be submitted after the service request is completed." });
          }

          if (request.Rating is not null) {
            return Results.BadRequest(new { error = "Feedback has already been submitted for this service request." });
          }

          if (payload.Rating < 1 || payload.Rating > 5) {
            return Results.BadRequest(new { error = "Rating must be between 1 and 5." });
          }

          var feedbackComments = NormalizeOptionalText(payload.FeedbackComments);
          var suggestionCategory = NormalizeOptionalText(payload.SuggestionCategory);

          if ((feedbackComments?.Length ?? 0) > FeedbackCommentsMaxLength) {
            return Results.BadRequest(new { error = $"Feedback comments must be {FeedbackCommentsMaxLength} characters or fewer." });
          }
          if ((suggestionCategory?.Length ?? 0) > FeedbackSuggestionCategoryMaxLength) {
            return Results.BadRequest(new { error = $"Suggestion category must be {FeedbackSuggestionCategoryMaxLength} characters or fewer." });
          }

          var now = DateTime.UtcNow;
          var completionLogUtc = await dbContext.StatusLogs
              .AsNoTracking()
              .Where(log => log.ServiceRequestId == request.Id &&
                  (log.Status == "Completed" || log.Status == "Closed"))
              .OrderBy(log => log.ChangedAtUtc)
              .Select(log => (DateTime?)log.ChangedAtUtc)
              .FirstOrDefaultAsync(cancellationToken);
          var completedAtUtc = request.CompletedAtUtc ?? completionLogUtc ?? now;
          request.CompletedAtUtc ??= completedAtUtc;
          request.FeedbackExpiresAtUtc ??= completedAtUtc.AddDays(FeedbackWindowDays);

          if (now > request.FeedbackExpiresAtUtc.Value) {
            return Results.BadRequest(new { error = "The feedback window for this completed service request has expired." });
          }

          request.Rating = payload.Rating;
          request.FeedbackComments = feedbackComments;
          request.FeedbackSuggestionCategory = suggestionCategory;
          request.FeedbackSubmittedAtUtc = now;

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok();
        });

    return customerApi;
  }

  private static bool IsFeedbackEligibleStatus(string status) =>
    string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(status, "Closed", StringComparison.OrdinalIgnoreCase);

  private static string? NormalizeOptionalText(string? value) {
    var normalized = value?.Trim();
    return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
  }

  private static bool IsSupportedImage(IFormFile file) =>
    file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
}

public sealed record CreateCustomerRequestPayload(string ItemType, string ItemDescription, string IssueDescription);
public sealed record SubmitFeedbackPayload(int Rating, string? FeedbackComments, string? SuggestionCategory);
public sealed class SubmitCustomerServiceRequestAttachmentRequest {
  public List<IFormFile> Files { get; init; } = [];
}
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
    string? FeedbackSuggestionCategory,
    DateTime? CompletedAtUtc,
    DateTime? FeedbackSubmittedAtUtc,
    DateTime? FeedbackExpiresAtUtc,
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
public sealed record CustomerPortalRequestAttachmentRecord(
    Guid Id,
    string OriginalFileName,
    string ContentType,
    string RelativeUrl,
    DateTime CreatedAtUtc);
public sealed record CustomerPortalRequestDetailsResponse(
    CustomerPortalRequestDetailRecord Request,
    IReadOnlyList<CustomerPortalTimelineEntryRecord> Timeline,
    IReadOnlyList<CustomerPortalAssignmentRecord> Assignments,
    IReadOnlyList<CustomerPortalRequestAttachmentRecord> Attachments);

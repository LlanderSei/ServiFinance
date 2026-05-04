namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;
using System.Security.Claims;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class CustomerPortalApiEndpointMappings {
  private const int ContactLabelMaxLength = 120;
  private const int ContactNameMaxLength = 200;
  private const int ContactPhoneMaxLength = 50;
  private const int ServiceAddressMaxLength = 500;
  private const int CancellationReasonMaxLength = 500;
  private const int FeedbackCommentsMaxLength = 1000;
  private const int FeedbackSuggestionCategoryMaxLength = 80;
  private const int FeedbackWindowDays = 7;
  private const long AttachmentMaxBytes = 5 * 1024 * 1024;

  public static RouteGroupBuilder MapCustomerPortalApiEndpoints(this RouteGroupBuilder api) {
    var customerApi = api.MapGroup("/customer-portal")
        .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = ApiAuthenticationSchemes })
        .RequireAuthorization(policy => policy.RequireAssertion(context =>
            context.User.HasClaim(c => c.Type == "surface" && c.Value == "CustomerWeb")));

    customerApi.MapGet("/profile", async Task<IResult> (
        ClaimsPrincipal user,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var profile = await LoadCustomerProfileAsync(dbContext, customerId, cancellationToken);
          return profile is null ? Results.NotFound() : Results.Ok(profile);
        });

    customerApi.MapPut("/profile", async Task<IResult> (
        ClaimsPrincipal user,
        [FromBody] UpdateCustomerProfilePayload payload,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var customer = await dbContext.Customers.SingleOrDefaultAsync(entity => entity.Id == customerId, cancellationToken);
          if (customer is null) {
            return Results.NotFound();
          }

          var fullName = (payload.FullName ?? string.Empty).Trim();
          var mobileNumber = (payload.MobileNumber ?? string.Empty).Trim();
          var address = (payload.Address ?? string.Empty).Trim();
          if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(mobileNumber)) {
            return Results.BadRequest(new { error = "Full name and mobile number are required." });
          }
          if (fullName.Length > ContactNameMaxLength) {
            return Results.BadRequest(new { error = $"Full name must be {ContactNameMaxLength} characters or fewer." });
          }
          if (mobileNumber.Length > ContactPhoneMaxLength) {
            return Results.BadRequest(new { error = $"Mobile number must be {ContactPhoneMaxLength} characters or fewer." });
          }
          if (address.Length > ServiceAddressMaxLength) {
            return Results.BadRequest(new { error = $"Address must be {ServiceAddressMaxLength} characters or fewer." });
          }

          customer.FullName = fullName;
          customer.MobileNumber = mobileNumber;
          customer.Address = address;
          await dbContext.SaveChangesAsync(cancellationToken);

          var profile = await LoadCustomerProfileAsync(dbContext, customerId, cancellationToken);
          return Results.Ok(profile);
        });

    customerApi.MapPost("/profile/contact-options", async Task<IResult> (
        ClaimsPrincipal user,
        [FromBody] UpsertCustomerContactOptionPayload payload,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var tenantId = Guid.Parse(user.FindFirstValue("tenant_id")!);
          var validationError = ValidateContactOptionPayload(payload);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var hasExistingOptions = await dbContext.CustomerContactOptions
              .AnyAsync(entity => entity.CustomerId == customerId, cancellationToken);
          var shouldSetDefault = payload.IsDefault || !hasExistingOptions;
          if (shouldSetDefault) {
            await ClearDefaultContactOptionsAsync(dbContext, customerId, cancellationToken);
          }

          dbContext.CustomerContactOptions.Add(new CustomerContactOption {
            TenantId = tenantId,
            CustomerId = customerId,
            Label = (payload.Label ?? string.Empty).Trim(),
            ContactName = (payload.ContactName ?? string.Empty).Trim(),
            PhoneNumber = (payload.PhoneNumber ?? string.Empty).Trim(),
            Address = (payload.Address ?? string.Empty).Trim(),
            IsDefault = shouldSetDefault,
            CreatedAtUtc = DateTime.UtcNow
          });
          await dbContext.SaveChangesAsync(cancellationToken);

          var profile = await LoadCustomerProfileAsync(dbContext, customerId, cancellationToken);
          return Results.Ok(profile);
        });

    customerApi.MapPut("/profile/contact-options/{optionId:guid}", async Task<IResult> (
        Guid optionId,
        ClaimsPrincipal user,
        [FromBody] UpsertCustomerContactOptionPayload payload,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var option = await dbContext.CustomerContactOptions
              .SingleOrDefaultAsync(entity => entity.Id == optionId && entity.CustomerId == customerId, cancellationToken);
          if (option is null) {
            return Results.NotFound();
          }

          var validationError = ValidateContactOptionPayload(payload);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          if (payload.IsDefault) {
            await ClearDefaultContactOptionsAsync(dbContext, customerId, cancellationToken);
          }

          option.Label = (payload.Label ?? string.Empty).Trim();
          option.ContactName = (payload.ContactName ?? string.Empty).Trim();
          option.PhoneNumber = (payload.PhoneNumber ?? string.Empty).Trim();
          option.Address = (payload.Address ?? string.Empty).Trim();
          option.IsDefault = payload.IsDefault;
          await dbContext.SaveChangesAsync(cancellationToken);

          var profile = await LoadCustomerProfileAsync(dbContext, customerId, cancellationToken);
          return Results.Ok(profile);
        });

    customerApi.MapDelete("/profile/contact-options/{optionId:guid}", async Task<IResult> (
        Guid optionId,
        ClaimsPrincipal user,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var option = await dbContext.CustomerContactOptions
              .SingleOrDefaultAsync(entity => entity.Id == optionId && entity.CustomerId == customerId, cancellationToken);
          if (option is null) {
            return Results.NotFound();
          }

          var wasDefault = option.IsDefault;
          dbContext.CustomerContactOptions.Remove(option);
          await dbContext.SaveChangesAsync(cancellationToken);

          if (wasDefault) {
            var nextDefault = await dbContext.CustomerContactOptions
                .Where(entity => entity.CustomerId == customerId)
                .OrderBy(entity => entity.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
            if (nextDefault is not null) {
              nextDefault.IsDefault = true;
              await dbContext.SaveChangesAsync(cancellationToken);
            }
          }

          var profile = await LoadCustomerProfileAsync(dbContext, customerId, cancellationToken);
          return Results.Ok(profile);
        });

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
                r.RequestedServiceDate,
                r.ServiceMode,
                r.ServiceAddress,
                r.ContactName,
                r.ContactPhone,
                r.PreferredScheduleStartUtc,
                r.PreferredScheduleEndUtc,
                r.NeededByUtc,
                r.Priority,
                r.CurrentStatus,
                r.CreatedAtUtc,
                r.Rating,
                r.FeedbackComments,
                r.FeedbackSuggestionCategory,
                r.CompletedAtUtc,
                r.FeedbackSubmittedAtUtc,
                r.FeedbackExpiresAtUtc,
                r.CancellationRequestedAtUtc,
                r.CancelledAtUtc,
                r.CancellationReason,
                HasAssignments = r.Assignments.Any()
              })
              .ToListAsync(cancellationToken);

          return Results.Ok(requests.Select(request => new CustomerPortalRequestRecord(
              request.Id,
              request.RequestNumber,
              request.ItemType,
              request.ItemDescription,
              request.IssueDescription,
              request.RequestedServiceDate,
              request.ServiceMode,
              request.ServiceAddress,
              request.ContactName,
              request.ContactPhone,
              request.PreferredScheduleStartUtc,
              request.PreferredScheduleEndUtc,
              request.NeededByUtc,
              request.Priority,
              request.CurrentStatus,
              request.CreatedAtUtc,
              request.Rating,
              request.FeedbackComments,
              request.FeedbackSuggestionCategory,
              request.CompletedAtUtc,
              request.FeedbackSubmittedAtUtc,
              request.FeedbackExpiresAtUtc,
              request.CancellationRequestedAtUtc,
              request.CancelledAtUtc,
              request.CancellationReason,
              CanCancelDirectly(request.CurrentStatus, request.HasAssignments),
              CanRequestCancellation(request.CurrentStatus, request.HasAssignments))));
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
              .Select(r => new {
                r.Id,
                r.RequestNumber,
                r.ItemType,
                r.ItemDescription,
                r.IssueDescription,
                r.RequestedServiceDate,
                r.ServiceMode,
                r.ServiceAddress,
                r.ContactName,
                r.ContactPhone,
                r.PreferredScheduleStartUtc,
                r.PreferredScheduleEndUtc,
                r.NeededByUtc,
                r.Priority,
                r.CurrentStatus,
                r.CreatedAtUtc,
                r.Rating,
                r.FeedbackComments,
                r.FeedbackSuggestionCategory,
                r.CompletedAtUtc,
                r.FeedbackSubmittedAtUtc,
                r.FeedbackExpiresAtUtc,
                r.CancellationRequestedAtUtc,
                r.CancelledAtUtc,
                r.CancellationReason,
                HasAssignments = r.Assignments.Any(),
                Invoice = r.Invoices
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
                    .FirstOrDefault()
              })
              .SingleOrDefaultAsync(cancellationToken);

          if (request is null) {
            return Results.NotFound();
          }

          var requestRecord = new CustomerPortalRequestDetailRecord(
              request.Id,
              request.RequestNumber,
              request.ItemType,
              request.ItemDescription,
              request.IssueDescription,
              request.RequestedServiceDate,
              request.ServiceMode,
              request.ServiceAddress,
              request.ContactName,
              request.ContactPhone,
              request.PreferredScheduleStartUtc,
              request.PreferredScheduleEndUtc,
              request.NeededByUtc,
              request.Priority,
              request.CurrentStatus,
              request.CreatedAtUtc,
              request.Rating,
              request.FeedbackComments,
              request.FeedbackSuggestionCategory,
              request.CompletedAtUtc,
              request.FeedbackSubmittedAtUtc,
              request.FeedbackExpiresAtUtc,
              request.CancellationRequestedAtUtc,
              request.CancelledAtUtc,
              request.CancellationReason,
              CanCancelDirectly(request.CurrentStatus, request.HasAssignments),
              CanRequestCancellation(request.CurrentStatus, request.HasAssignments),
              request.Invoice);

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
              requestRecord,
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
          var customer = await dbContext.Customers
              .AsNoTracking()
              .SingleOrDefaultAsync(entity => entity.Id == customerId, cancellationToken);
          if (customer is null) {
            return Results.NotFound();
          }

          var itemType = (payload.ItemType ?? string.Empty).Trim();
          var itemDescription = (payload.ItemDescription ?? string.Empty).Trim();
          var issueDescription = (payload.IssueDescription ?? string.Empty).Trim();
          if (string.IsNullOrWhiteSpace(itemType) || string.IsNullOrWhiteSpace(issueDescription)) {
            return Results.BadRequest(new { error = "Item type and issue description are required." });
          }

          var serviceMode = NormalizeServiceMode(payload.ServiceMode);
          var serviceAddress = NormalizeOptionalText(payload.ServiceAddress) ?? customer.Address.Trim();
          var contactName = NormalizeOptionalText(payload.ContactName) ?? customer.FullName.Trim();
          var contactPhone = NormalizeOptionalText(payload.ContactPhone) ?? customer.MobileNumber.Trim();
          if (RequiresServiceAddress(serviceMode) && string.IsNullOrWhiteSpace(serviceAddress)) {
            return Results.BadRequest(new { error = "A service address is required for on-site or pickup requests." });
          }
          if (contactName.Length > ContactNameMaxLength) {
            return Results.BadRequest(new { error = $"Contact name must be {ContactNameMaxLength} characters or fewer." });
          }
          if (contactPhone.Length > ContactPhoneMaxLength) {
            return Results.BadRequest(new { error = $"Contact phone must be {ContactPhoneMaxLength} characters or fewer." });
          }
          if (serviceAddress.Length > ServiceAddressMaxLength) {
            return Results.BadRequest(new { error = $"Service address must be {ServiceAddressMaxLength} characters or fewer." });
          }
          if (payload.PreferredScheduleStartUtc.HasValue &&
              payload.PreferredScheduleEndUtc.HasValue &&
              payload.PreferredScheduleEndUtc.Value <= payload.PreferredScheduleStartUtc.Value) {
            return Results.BadRequest(new { error = "Preferred schedule end must be after the start time." });
          }

          var requestedServiceDate = payload.NeededByUtc?.Date ?? payload.PreferredScheduleStartUtc?.Date;

          var request = new ServiceRequest {
              Id = Guid.NewGuid(),
              TenantId = tenantId,
              CustomerId = customerId,
              RequestNumber = "SR-" + Guid.NewGuid().ToString()[..6].ToUpper(),
              ItemType = itemType,
              ItemDescription = itemDescription,
              IssueDescription = issueDescription,
              RequestedServiceDate = requestedServiceDate,
              ServiceMode = serviceMode,
              ServiceAddress = serviceAddress,
              ContactName = contactName,
              ContactPhone = contactPhone,
              PreferredScheduleStartUtc = payload.PreferredScheduleStartUtc,
              PreferredScheduleEndUtc = payload.PreferredScheduleEndUtc,
              NeededByUtc = payload.NeededByUtc,
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
              Remarks = BuildRequestCreationRemarks(serviceMode, payload.PreferredScheduleStartUtc, payload.NeededByUtc),
              ChangedByCustomerId = customerId,
              ChangedAtUtc = DateTime.UtcNow
          };
          dbContext.StatusLogs.Add(statusLog);

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new { request.Id, request.RequestNumber });
        });

    customerApi.MapPost("/requests/{id:guid}/cancel", async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        [FromBody] CancelCustomerRequestPayload payload,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var request = await dbContext.ServiceRequests
              .Include(entity => entity.Assignments)
              .SingleOrDefaultAsync(entity => entity.Id == id && entity.CustomerId == customerId, cancellationToken);
          if (request is null) {
            return Results.NotFound();
          }

          if (IsTerminalRequestStatus(request.CurrentStatus)) {
            return Results.BadRequest(new { error = "This request is already completed, closed, or cancelled." });
          }

          if (string.Equals(request.CurrentStatus, "Cancellation Requested", StringComparison.OrdinalIgnoreCase)) {
            return Results.BadRequest(new { error = "Cancellation is already waiting for tenant review." });
          }

          var reason = NormalizeOptionalText(payload.Reason);
          if (string.IsNullOrWhiteSpace(reason)) {
            return Results.BadRequest(new { error = "Cancellation reason is required." });
          }
          if (reason.Length > CancellationReasonMaxLength) {
            return Results.BadRequest(new { error = $"Cancellation reason must be {CancellationReasonMaxLength} characters or fewer." });
          }

          var hasAssignments = request.Assignments.Any();
          var now = DateTime.UtcNow;
          if (CanCancelDirectly(request.CurrentStatus, hasAssignments)) {
            request.CurrentStatus = "Cancelled";
            request.CancelledAtUtc = now;
            request.CancellationReason = reason;
            dbContext.StatusLogs.Add(new StatusLog {
              TenantId = request.TenantId,
              ServiceRequestId = request.Id,
              Status = request.CurrentStatus,
              Remarks = $"Request cancelled by customer. Reason: {reason}",
              ChangedByCustomerId = customerId,
              ChangedAtUtc = now
            });

            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(new CustomerPortalCancelRequestResponse(
                request.CurrentStatus,
                "Request cancelled.",
                false,
                false));
          }

          if (!CanRequestCancellation(request.CurrentStatus, hasAssignments)) {
            return Results.BadRequest(new { error = "This request cannot be cancelled from the customer portal right now." });
          }

          request.CurrentStatus = "Cancellation Requested";
          request.CancellationRequestedAtUtc = now;
          request.CancellationReason = reason;
          dbContext.StatusLogs.Add(new StatusLog {
            TenantId = request.TenantId,
            ServiceRequestId = request.Id,
            Status = request.CurrentStatus,
            Remarks = $"Customer requested cancellation. Reason: {reason}",
            ChangedByCustomerId = customerId,
            ChangedAtUtc = now
          });

          await dbContext.SaveChangesAsync(cancellationToken);
          return Results.Ok(new CustomerPortalCancelRequestResponse(
              request.CurrentStatus,
              "Cancellation request sent to the tenant team.",
              false,
              false));
        });

    customerApi.MapPost("/requests/{id:guid}/attachments", async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        HttpRequest httpRequest,
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

          if (IsTerminalRequestStatus(request.CurrentStatus) ||
              string.Equals(request.CurrentStatus, "Cancellation Requested", StringComparison.OrdinalIgnoreCase)) {
            return Results.BadRequest(new { error = "Attachments cannot be added after cancellation or completion starts." });
          }

          var form = await httpRequest.ReadFormAsync(cancellationToken);
          var files = payload.Files is { Count: > 0 }
              ? payload.Files
              : form.Files.ToList();

          if (files.Count == 0) {
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

          foreach (var file in files) {
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

  private static async Task<CustomerPortalProfileResponse?> LoadCustomerProfileAsync(
      ServiFinanceDbContext dbContext,
      Guid customerId,
      CancellationToken cancellationToken) =>
    await dbContext.Customers
        .AsNoTracking()
        .Where(entity => entity.Id == customerId)
        .Select(entity => new CustomerPortalProfileResponse(
            entity.Id,
            entity.Tenant != null ? entity.Tenant.DomainSlug : string.Empty,
            entity.FullName,
            entity.Email,
            entity.MobileNumber,
            entity.Address,
            entity.ContactOptions
                .OrderByDescending(option => option.IsDefault)
                .ThenBy(option => option.Label)
                .Select(option => new CustomerPortalContactOptionRecord(
                    option.Id,
                    option.Label,
                    option.ContactName,
                    option.PhoneNumber,
                    option.Address,
                    option.IsDefault,
                    option.CreatedAtUtc))
                .ToList()))
        .SingleOrDefaultAsync(cancellationToken);

  private static string? ValidateContactOptionPayload(UpsertCustomerContactOptionPayload payload) {
    var label = (payload.Label ?? string.Empty).Trim();
    var contactName = (payload.ContactName ?? string.Empty).Trim();
    var phoneNumber = (payload.PhoneNumber ?? string.Empty).Trim();
    var address = (payload.Address ?? string.Empty).Trim();
    if (string.IsNullOrWhiteSpace(label) ||
        string.IsNullOrWhiteSpace(contactName) ||
        string.IsNullOrWhiteSpace(phoneNumber) ||
        string.IsNullOrWhiteSpace(address)) {
      return "Label, contact name, phone number, and address are required.";
    }

    if (label.Length > ContactLabelMaxLength) {
      return $"Label must be {ContactLabelMaxLength} characters or fewer.";
    }
    if (contactName.Length > ContactNameMaxLength) {
      return $"Contact name must be {ContactNameMaxLength} characters or fewer.";
    }
    if (phoneNumber.Length > ContactPhoneMaxLength) {
      return $"Phone number must be {ContactPhoneMaxLength} characters or fewer.";
    }
    if (address.Length > ServiceAddressMaxLength) {
      return $"Address must be {ServiceAddressMaxLength} characters or fewer.";
    }

    return null;
  }

  private static async Task ClearDefaultContactOptionsAsync(
      ServiFinanceDbContext dbContext,
      Guid customerId,
      CancellationToken cancellationToken) {
    var defaultOptions = await dbContext.CustomerContactOptions
        .Where(entity => entity.CustomerId == customerId && entity.IsDefault)
        .ToListAsync(cancellationToken);
    foreach (var option in defaultOptions) {
      option.IsDefault = false;
    }
  }

  private static string NormalizeServiceMode(string? serviceMode) {
    var normalized = serviceMode?.Trim();
    if (string.IsNullOrWhiteSpace(normalized)) {
      return "Drop-off";
    }

    return normalized.ToLowerInvariant() switch {
      "onsite" or "on site" or "on-site" => "On-site",
      "pickup" or "pick up" or "pick-up" => "Pickup",
      "dropoff" or "drop off" or "drop-off" => "Drop-off",
      _ => "Drop-off"
    };
  }

  private static bool RequiresServiceAddress(string serviceMode) =>
    string.Equals(serviceMode, "On-site", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(serviceMode, "Pickup", StringComparison.OrdinalIgnoreCase);

  private static string BuildRequestCreationRemarks(
      string serviceMode,
      DateTime? preferredScheduleStartUtc,
      DateTime? neededByUtc) {
    var scheduleText = preferredScheduleStartUtc.HasValue
        ? $" Preferred schedule starts {preferredScheduleStartUtc.Value:u}."
        : string.Empty;
    var dueText = neededByUtc.HasValue
        ? $" Needed by {neededByUtc.Value:u}."
        : string.Empty;
    return $"Request created by customer. Service mode: {serviceMode}.{scheduleText}{dueText}";
  }

  private static bool CanCancelDirectly(string status, bool hasAssignments) =>
    !hasAssignments &&
    string.Equals(status, "New", StringComparison.OrdinalIgnoreCase);

  private static bool CanRequestCancellation(string status, bool hasAssignments) =>
    !IsTerminalRequestStatus(status) &&
    !string.Equals(status, "Cancellation Requested", StringComparison.OrdinalIgnoreCase) &&
    !CanCancelDirectly(status, hasAssignments);

  private static bool IsTerminalRequestStatus(string status) =>
    string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(status, "Closed", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(status, "Cancelled", StringComparison.OrdinalIgnoreCase);

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

public sealed record CustomerPortalProfileResponse(
    Guid Id,
    string TenantDomainSlug,
    string FullName,
    string Email,
    string MobileNumber,
    string Address,
    IReadOnlyList<CustomerPortalContactOptionRecord> ContactOptions);
public sealed record CustomerPortalContactOptionRecord(
    Guid Id,
    string Label,
    string ContactName,
    string PhoneNumber,
    string Address,
    bool IsDefault,
    DateTime CreatedAtUtc);
public sealed record UpdateCustomerProfilePayload(string FullName, string MobileNumber, string Address);
public sealed record UpsertCustomerContactOptionPayload(
    string Label,
    string ContactName,
    string PhoneNumber,
    string Address,
    bool IsDefault);
public sealed record CreateCustomerRequestPayload(
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    string? ServiceMode,
    string? ServiceAddress,
    string? ContactName,
    string? ContactPhone,
    DateTime? PreferredScheduleStartUtc,
    DateTime? PreferredScheduleEndUtc,
    DateTime? NeededByUtc);
public sealed record CancelCustomerRequestPayload(string? Reason);
public sealed record CustomerPortalCancelRequestResponse(
    string CurrentStatus,
    string Message,
    bool CanCancelDirectly,
    bool CanRequestCancellation);
public sealed record SubmitFeedbackPayload(int Rating, string? FeedbackComments, string? SuggestionCategory);
public sealed class SubmitCustomerServiceRequestAttachmentRequest {
  public List<IFormFile>? Files { get; init; }
}
public sealed record CustomerPortalRequestRecord(
    Guid Id,
    string RequestNumber,
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    DateTime? RequestedServiceDate,
    string ServiceMode,
    string ServiceAddress,
    string ContactName,
    string ContactPhone,
    DateTime? PreferredScheduleStartUtc,
    DateTime? PreferredScheduleEndUtc,
    DateTime? NeededByUtc,
    string Priority,
    string CurrentStatus,
    DateTime CreatedAtUtc,
    int? Rating,
    string? FeedbackComments,
    string? FeedbackSuggestionCategory,
    DateTime? CompletedAtUtc,
    DateTime? FeedbackSubmittedAtUtc,
    DateTime? FeedbackExpiresAtUtc,
    DateTime? CancellationRequestedAtUtc,
    DateTime? CancelledAtUtc,
    string? CancellationReason,
    bool CanCancelDirectly,
    bool CanRequestCancellation);
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
    string ServiceMode,
    string ServiceAddress,
    string ContactName,
    string ContactPhone,
    DateTime? PreferredScheduleStartUtc,
    DateTime? PreferredScheduleEndUtc,
    DateTime? NeededByUtc,
    string Priority,
    string CurrentStatus,
    DateTime CreatedAtUtc,
    int? Rating,
    string? FeedbackComments,
    string? FeedbackSuggestionCategory,
    DateTime? CompletedAtUtc,
    DateTime? FeedbackSubmittedAtUtc,
    DateTime? FeedbackExpiresAtUtc,
    DateTime? CancellationRequestedAtUtc,
    DateTime? CancelledAtUtc,
    string? CancellationReason,
    bool CanCancelDirectly,
    bool CanRequestCancellation,
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

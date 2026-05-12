namespace ServiFinance.Api.Endpoints;

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Services;
using ServiFinance.Application.Auditing;
using ServiFinance.Application.Auth;
using ServiFinance.Application.Notifications;
using ServiFinance.Application.Payments;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class CustomerPortalApiEndpointMappings {
  private const int ContactLabelMaxLength = 120;
  private const int ContactNameMaxLength = 200;
  private const int ContactPhoneMaxLength = 50;
  private const int ServiceAddressMaxLength = 500;
  private const int AddressDetailsMaxLength = 500;
  private const int CancellationReasonMaxLength = 500;
  private const int FeedbackCommentsMaxLength = 1000;
  private const int FeedbackSuggestionCategoryMaxLength = 80;
  private const int FeedbackWindowDays = 7;
  private const int PaymentMethodMaxLength = 80;
  private const int PaymentReferenceNumberMaxLength = 120;
  private const int PaymentNoteMaxLength = 1000;
  private const int PaymentReviewRemarksMaxLength = 1000;
  private const long PaymentProofMaxBytes = 8 * 1024 * 1024;
  private const string ScopeCustomer = "Customer";
  private const string CategorySecurity = "Security";
  private const string GoogleExternalScheme = "GoogleExternal";
  private const string GoogleLinkProvider = "google-auth";

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
    customerApi.MapGet("/security", GetSecurityAsync);
    customerApi.MapPost("/password", ChangePasswordAsync);
    customerApi.MapPost("/mfa/enable", EnableMfaAsync);
    customerApi.MapPost("/mfa/disable", DisableMfaAsync);
    customerApi.MapGet("/google/link", StartGoogleLinkAsync);
    customerApi.MapGet("/google/callback", CompleteGoogleLinkAsync).AllowAnonymous();
    customerApi.MapPost("/google/unlink", UnlinkGoogleAsync);

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
          var addressDetails = NormalizeOptionalText(payload.AddressDetails);
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
          if ((addressDetails?.Length ?? 0) > AddressDetailsMaxLength) {
            return Results.BadRequest(new { error = $"Address details must be {AddressDetailsMaxLength} characters or fewer." });
          }

          customer.FullName = fullName;
          customer.MobileNumber = mobileNumber;
          customer.Address = address;
          customer.AddressDetails = addressDetails;
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
            AddressDetails = NormalizeOptionalText(payload.AddressDetails),
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
          option.AddressDetails = NormalizeOptionalText(payload.AddressDetails);
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
                r.ServiceAddressDetails,
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
              request.ServiceAddressDetails,
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

    customerApi.MapGet("/requests/notifications", async Task<IResult> (
        ClaimsPrincipal user,
        [FromQuery] DateTime? sinceUtc,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

          var customerEvents = dbContext.StatusLogs
              .AsNoTracking()
              .Where(log =>
                  log.ServiceRequest != null &&
                  log.ServiceRequest.CustomerId == customerId &&
                  log.ChangedByCustomerId == null);

          if (!sinceUtc.HasValue) {
            var latestChangedAtUtc = await customerEvents
                .OrderByDescending(log => log.ChangedAtUtc)
                .Select(log => (DateTime?)log.ChangedAtUtc)
                .FirstOrDefaultAsync(cancellationToken)
                ?? DateTime.UtcNow;

            return Results.Ok(new CustomerPortalRequestNotificationFeedResponse(
                latestChangedAtUtc,
                []));
          }

          var events = await customerEvents
              .Where(log => log.ChangedAtUtc > sinceUtc.Value)
              .OrderBy(log => log.ChangedAtUtc)
              .ThenBy(log => log.Id)
              .Select(log => new CustomerPortalRequestNotificationRecord(
                  log.Id,
                  log.ServiceRequestId,
                  log.ServiceRequest != null ? log.ServiceRequest.RequestNumber : string.Empty,
                  log.ServiceRequest != null ? log.ServiceRequest.ItemType : string.Empty,
                  log.Status,
                  log.Remarks,
                  log.ChangedAtUtc))
              .Take(20)
              .ToListAsync(cancellationToken);

          var cursorUtc = events.Count > 0
              ? events[^1].ChangedAtUtc
              : sinceUtc.Value;

          return Results.Ok(new CustomerPortalRequestNotificationFeedResponse(
              cursorUtc,
              events));
        });

    customerApi.MapGet("/requests/{id:guid}/details", async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        IStripeServiceInvoicePaymentService stripePaymentService,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var canUseOnlineCheckout = stripePaymentService.IsConfigured;

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
                r.ServiceAddressDetails,
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
              .SingleOrDefaultAsync(cancellationToken);

          if (request is null) {
            return Results.NotFound();
          }

          var invoice = await dbContext.Invoices
              .AsNoTracking()
              .Where(entity => entity.ServiceRequestId == id)
              .OrderByDescending(entity => entity.InvoiceDateUtc)
              .Select(entity => new CustomerPortalRequestInvoiceRecord(
                  entity.Id,
                  entity.InvoiceNumber,
                  entity.InvoiceStatus,
                  entity.SubtotalAmount,
                  entity.TaxAmount,
                  entity.DiscountAmount,
                  entity.TotalAmount,
                  entity.OutstandingAmount,
                  entity.InterestableAmount,
                  entity.InvoiceDateUtc,
                  entity.MicroLoan != null,
                  entity.MicroLoan != null ? entity.MicroLoan.LoanStatus : null,
                  entity.MicroLoan == null &&
                    entity.OutstandingAmount > 0m &&
                    entity.InvoiceStatus != ServiceInvoiceFinancePolicy.CheckoutPendingStatus &&
                    !entity.PaymentSubmissions.Any(submission =>
                        submission.Status == ServiceInvoiceFinancePolicy.PaymentSubmittedStatus ||
                        submission.Status == ServiceInvoiceFinancePolicy.LegacyPendingReviewStatus),
                  canUseOnlineCheckout &&
                    entity.MicroLoan == null &&
                    entity.InvoiceStatus == ServiceInvoiceFinancePolicy.FinalizedStatus &&
                    entity.OutstandingAmount > 0m &&
                    entity.OutstandingAmount == entity.TotalAmount &&
                    !entity.PaymentSubmissions.Any(submission =>
                        submission.Status == ServiceInvoiceFinancePolicy.CheckoutPendingStatus ||
                        submission.Status == ServiceInvoiceFinancePolicy.PaymentSubmittedStatus ||
                        submission.Status == ServiceInvoiceFinancePolicy.LegacyPendingReviewStatus),
                  entity.InvoiceLines
                      .OrderBy(line => line.SortOrder)
                      .ThenBy(line => line.Name)
                      .Select(line => new CustomerPortalRequestInvoiceLineRecord(
                          line.Id,
                          line.Category,
                          line.Name,
                          line.Specification,
                          line.Quantity,
                          line.UnitPrice,
                          line.LineTotal))
                      .ToList(),
                  entity.PaymentSubmissions
                      .OrderByDescending(submission => submission.SubmittedAtUtc)
                      .ThenByDescending(submission => submission.Id)
                      .Select(submission => new CustomerPortalInvoicePaymentSubmissionRecord(
                          submission.Id,
                          submission.AmountSubmitted,
                          submission.ApprovedAmount,
                          submission.PaymentMethod,
                          submission.ReferenceNumber,
                          submission.Status,
                          submission.Note,
                          submission.ReviewRemarks,
                          submission.ProofOriginalFileName,
                          submission.ProofRelativeUrl,
                          submission.SubmittedAtUtc,
                          submission.ReviewedAtUtc))
                      .ToList()))
              .FirstOrDefaultAsync(cancellationToken);

          var costSheet = await dbContext.ServiceCostSheets
              .AsNoTracking()
              .Where(entity => entity.ServiceRequestId == id)
              .Select(entity => new {
                entity.Id,
                entity.Status,
                entity.IsTaxEnabled,
                entity.TaxLabel,
                entity.TaxRate,
                entity.Notes,
                entity.UpdatedAtUtc,
                Lines = entity.Lines
                    .OrderBy(line => line.SortOrder)
                    .ThenBy(line => line.Name)
                    .Select(line => new CustomerPortalServiceCostLineRecord(
                        line.Id,
                        line.Category,
                        line.Name,
                        line.Specification,
                        line.Quantity,
                        line.UnitPrice,
                        line.Quantity * line.UnitPrice))
                    .ToList()
              })
              .SingleOrDefaultAsync(cancellationToken);

          var requestRecord = new CustomerPortalRequestDetailRecord(
              request.Id,
              request.RequestNumber,
              request.ItemType,
              request.ItemDescription,
              request.IssueDescription,
              request.RequestedServiceDate,
              request.ServiceMode,
              request.ServiceAddress,
              request.ServiceAddressDetails,
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
              invoice,
              costSheet is null
                  ? null
                  : new CustomerPortalServiceCostSheetRecord(
                      costSheet.Id,
                      costSheet.Status,
                      costSheet.IsTaxEnabled,
                      costSheet.TaxLabel,
                      costSheet.TaxRate,
                      costSheet.Lines.Sum(line => line.LineTotal),
                      costSheet.IsTaxEnabled
                          ? Math.Round(costSheet.Lines.Sum(line => line.LineTotal) * (costSheet.TaxRate / 100m), 2, MidpointRounding.AwayFromZero)
                          : 0m,
                      costSheet.Lines.Sum(line => line.LineTotal) + (
                        costSheet.IsTaxEnabled
                          ? Math.Round(costSheet.Lines.Sum(line => line.LineTotal) * (costSheet.TaxRate / 100m), 2, MidpointRounding.AwayFromZero)
                          : 0m),
                      costSheet.Notes,
                      costSheet.UpdatedAtUtc,
                      costSheet.Lines));

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
          var serviceAddressDetails = NormalizeOptionalText(payload.ServiceAddressDetails) ?? NormalizeOptionalText(customer.AddressDetails);
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
          if ((serviceAddressDetails?.Length ?? 0) > AddressDetailsMaxLength) {
            return Results.BadRequest(new { error = $"Address details must be {AddressDetailsMaxLength} characters or fewer." });
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
              ServiceAddressDetails = serviceAddressDetails,
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
        IImageUploadService imageUploadService,
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

          if (!httpRequest.HasFormContentType) {
            return Results.BadRequest(new { error = "Upload pictures using multipart form data." });
          }

          var form = await httpRequest.ReadFormAsync(cancellationToken);
          var namedFiles = form.Files.GetFiles("files");
          var files = namedFiles.Count > 0 ? namedFiles.ToList() : form.Files.ToList();

          if (files.Count == 0) {
            return Results.BadRequest(new { error = "Select at least one picture to upload." });
          }

          IReadOnlyList<ImageUploadResult> uploads;
          try {
            uploads = await imageUploadService.UploadBatchAsync(
                files,
                new ImageUploadContext(
                    ImageUploadPurpose.CustomerRequestAttachment,
                    tenantDomainSlug,
                    customerId.ToString("N"),
                    $"service-request-{id:N}"),
                cancellationToken);
          } catch (ImageUploadException exception) {
            return Results.Json(
                new { error = exception.Message },
                statusCode: exception.StatusCode);
          }

          foreach (var upload in uploads) {
            dbContext.ServiceRequestAttachments.Add(new ServiceRequestAttachment {
              ServiceRequestId = id,
              SubmittedByCustomerId = customerId,
              OriginalFileName = upload.OriginalFileName,
              StoredFileName = upload.StoredFileName,
              ContentType = upload.ContentType,
              RelativeUrl = upload.PublicUrl,
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
        IStripeServiceInvoicePaymentService stripePaymentService,
        ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var canUseOnlineCheckout = stripePaymentService.IsConfigured;

          var invoices = await dbContext.Invoices
              .AsNoTracking()
              .Include(i => i.ServiceRequest)
              .Where(i => i.CustomerId == customerId)
              .OrderByDescending(i => i.InvoiceDateUtc)
              .Select(i => new CustomerPortalInvoiceSummaryRecord(
                  i.Id,
                  i.InvoiceNumber,
                  i.InvoiceDateUtc,
                  i.TotalAmount,
                  i.OutstandingAmount,
                  i.InvoiceStatus,
                  i.ServiceRequestId,
                  i.ServiceRequest != null ? i.ServiceRequest.RequestNumber : null,
                  i.MicroLoan != null,
                  i.MicroLoan != null ? i.MicroLoan.LoanStatus : null,
                  i.MicroLoan == null &&
                    i.OutstandingAmount > 0m &&
                    i.InvoiceStatus != ServiceInvoiceFinancePolicy.CheckoutPendingStatus &&
                    !i.PaymentSubmissions.Any(submission =>
                        submission.Status == ServiceInvoiceFinancePolicy.PaymentSubmittedStatus ||
                        submission.Status == ServiceInvoiceFinancePolicy.LegacyPendingReviewStatus),
                  canUseOnlineCheckout &&
                    i.MicroLoan == null &&
                    i.InvoiceStatus == ServiceInvoiceFinancePolicy.FinalizedStatus &&
                    i.OutstandingAmount > 0m &&
                    i.OutstandingAmount == i.TotalAmount &&
                    !i.PaymentSubmissions.Any(submission =>
                        submission.Status == ServiceInvoiceFinancePolicy.CheckoutPendingStatus ||
                        submission.Status == ServiceInvoiceFinancePolicy.PaymentSubmittedStatus ||
                        submission.Status == ServiceInvoiceFinancePolicy.LegacyPendingReviewStatus),
                  i.PaymentSubmissions
                      .OrderByDescending(submission => submission.SubmittedAtUtc)
                      .ThenByDescending(submission => submission.Id)
                      .Select(submission => new CustomerPortalInvoicePaymentSubmissionRecord(
                          submission.Id,
                          submission.AmountSubmitted,
                          submission.ApprovedAmount,
                          submission.PaymentMethod,
                          submission.ReferenceNumber,
                          submission.Status,
                          submission.Note,
                          submission.ReviewRemarks,
                          submission.ProofOriginalFileName,
                          submission.ProofRelativeUrl,
                          submission.SubmittedAtUtc,
                          submission.ReviewedAtUtc))
                      .ToList()))
              .ToListAsync(cancellationToken);

          return Results.Ok(invoices);
        });

    customerApi.MapPost("/invoices/{invoiceId:guid}/stripe-checkout", async Task<IResult> (
        Guid invoiceId,
        HttpContext httpContext,
        ClaimsPrincipal user,
        IStripeServiceInvoicePaymentService stripePaymentService,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var tenantDomainSlug = user.FindFirstValue("tenant_domain_slug") ?? string.Empty;
          try {
            var baseUrl = $"{httpContext.Request.Scheme}://{httpContext.Request.Host}{httpContext.Request.PathBase}";
            var session = await stripePaymentService.CreateCheckoutSessionAsync(
                invoiceId,
                customerId,
                tenantDomainSlug,
                baseUrl,
                cancellationToken);

            return Results.Ok(new CustomerPortalStripeCheckoutSessionResponse(
                session.InvoiceId,
                session.CheckoutSessionId,
                session.CheckoutUrl));
          } catch (InvalidOperationException ex) {
            return Results.BadRequest(new { error = ex.Message });
          }
        });

    customerApi.MapPost("/invoices/{invoiceId:guid}/stripe-checkout/sync", async Task<IResult> (
        Guid invoiceId,
        ClaimsPrincipal user,
        [FromBody] SyncCustomerInvoiceStripeCheckoutRequest request,
        IStripeServiceInvoicePaymentService stripePaymentService,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          if (string.IsNullOrWhiteSpace(request.CheckoutSessionId)) {
            return Results.BadRequest(new { error = "Checkout session id is required." });
          }

          try {
            var syncResult = await stripePaymentService.SyncCheckoutSessionAsync(
                invoiceId,
                customerId,
                request.CheckoutSessionId.Trim(),
                cancellationToken);
            return syncResult is null
              ? Results.NotFound()
              : Results.Ok(new CustomerPortalStripeCheckoutSyncResponse(
                  syncResult.InvoiceId,
                  syncResult.InvoiceStatus,
                  syncResult.OutstandingAmount,
                  syncResult.PaymentApplied));
          } catch (InvalidOperationException ex) {
            return Results.BadRequest(new { error = ex.Message });
          }
        });

    customerApi.MapPost("/invoices/{invoiceId:guid}/payment-submissions", async Task<IResult> (
        Guid invoiceId,
        ClaimsPrincipal user,
        [FromForm] SubmitCustomerInvoicePaymentSubmissionRequest request,
        ServiFinanceDbContext dbContext,
        IWebHostEnvironment environment,
        CancellationToken cancellationToken) => {
          var customerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
          var tenantId = Guid.Parse(user.FindFirstValue("tenant_id")!);
          var tenantDomainSlug = user.FindFirstValue("tenant_domain_slug") ?? "tenant";

          var paymentMethod = (request.PaymentMethod ?? string.Empty).Trim();
          if (string.IsNullOrWhiteSpace(paymentMethod)) {
            return Results.BadRequest(new { error = "Select the payment method used for this settlement proof." });
          }
          if (paymentMethod.Length > PaymentMethodMaxLength) {
            return Results.BadRequest(new { error = $"Payment method must be {PaymentMethodMaxLength} characters or fewer." });
          }

          var referenceNumber = (request.ReferenceNumber ?? string.Empty).Trim();
          if (string.IsNullOrWhiteSpace(referenceNumber)) {
            return Results.BadRequest(new { error = "Enter the payment reference number for finance review." });
          }
          if (referenceNumber.Length > PaymentReferenceNumberMaxLength) {
            return Results.BadRequest(new { error = $"Reference number must be {PaymentReferenceNumberMaxLength} characters or fewer." });
          }

          var note = NormalizeOptionalText(request.Note);
          if ((note?.Length ?? 0) > PaymentNoteMaxLength) {
            return Results.BadRequest(new { error = $"Payment note must be {PaymentNoteMaxLength} characters or fewer." });
          }

          if (request.AmountSubmitted <= 0m) {
            return Results.BadRequest(new { error = "Enter the amount you submitted for this invoice." });
          }

          if (request.ProofFile is null || request.ProofFile.Length <= 0) {
            return Results.BadRequest(new { error = "Attach a payment proof image or PDF before submitting." });
          }
          if (request.ProofFile.Length > PaymentProofMaxBytes) {
            return Results.BadRequest(new { error = "Payment proof must be 8 MB or smaller." });
          }
          if (!IsSupportedSettlementProof(request.ProofFile)) {
            return Results.BadRequest(new { error = "Payment proof must be an image or PDF file." });
          }

          var invoice = await dbContext.Invoices
              .Include(entity => entity.MicroLoan)
              .Include(entity => entity.PaymentSubmissions)
              .Include(entity => entity.ServiceRequest)
              .SingleOrDefaultAsync(entity => entity.Id == invoiceId && entity.CustomerId == customerId, cancellationToken);
          if (invoice is null) {
            return Results.NotFound();
          }
          if (invoice.MicroLoan is not null) {
            return Results.BadRequest(new { error = "This invoice has already been converted into an MLS loan account and can no longer accept direct settlement proof." });
          }
          if (invoice.OutstandingAmount <= 0m || string.Equals(invoice.InvoiceStatus, "Paid", StringComparison.OrdinalIgnoreCase)) {
            return Results.BadRequest(new { error = "This invoice is already settled." });
          }
          if (invoice.PaymentSubmissions.Any(entity => entity.Status == ServiceInvoiceFinancePolicy.CheckoutPendingStatus)) {
            return Results.BadRequest(new { error = "An online checkout session is already in progress for this invoice." });
          }
          if (invoice.PaymentSubmissions.Any(entity => ServiceInvoiceFinancePolicy.IsManualReviewPendingStatus(entity.Status))) {
            return Results.BadRequest(new { error = "A payment proof is already pending review for this invoice." });
          }

          var amountSubmitted = RoundCurrency(request.AmountSubmitted);
          if (amountSubmitted > invoice.OutstandingAmount) {
            return Results.BadRequest(new { error = "Submitted amount cannot be greater than the current outstanding balance." });
          }

          var submission = new InvoicePaymentSubmission {
            TenantId = tenantId,
            InvoiceId = invoice.Id,
            CustomerId = customerId,
            ServiceRequestId = invoice.ServiceRequestId,
            AmountSubmitted = amountSubmitted,
            PaymentMethod = paymentMethod,
            ReferenceNumber = referenceNumber,
            Note = note,
            Status = ServiceInvoiceFinancePolicy.PaymentSubmittedStatus,
            SubmittedAtUtc = DateTime.UtcNow
          };

          var webRootPath = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
          var uploadDirectory = Path.Combine(
              webRootPath,
              "uploads",
              "invoice-payment-submissions",
              tenantDomainSlug,
              invoice.Id.ToString("N"),
              submission.Id.ToString("N"));
          Directory.CreateDirectory(uploadDirectory);

          var proofExtension = Path.GetExtension(request.ProofFile.FileName);
          var storedFileName = $"invoice-proof-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{proofExtension}";
          var absoluteFilePath = Path.Combine(uploadDirectory, storedFileName);
          await using (var stream = File.Create(absoluteFilePath)) {
            await request.ProofFile.CopyToAsync(stream, cancellationToken);
          }

          submission.ProofOriginalFileName = request.ProofFile.FileName;
          submission.ProofStoredFileName = storedFileName;
          submission.ProofContentType = request.ProofFile.ContentType;
          submission.ProofRelativeUrl = $"/uploads/invoice-payment-submissions/{tenantDomainSlug}/{invoice.Id:N}/{submission.Id:N}/{storedFileName}";

          dbContext.InvoicePaymentSubmissions.Add(submission);
          invoice.InvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);

          if (invoice.ServiceRequestId.HasValue) {
            dbContext.StatusLogs.Add(new StatusLog {
              ServiceRequestId = invoice.ServiceRequestId.Value,
              Status = invoice.ServiceRequest?.CurrentStatus ?? "Completed",
              Remarks = $"Customer submitted payment proof for invoice {invoice.InvoiceNumber} amounting to {amountSubmitted:0.00}.",
              ChangedByCustomerId = customerId,
              ChangedAtUtc = submission.SubmittedAtUtc
            });
          }

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new CustomerPortalInvoicePaymentSubmissionRecord(
              submission.Id,
              submission.AmountSubmitted,
              submission.ApprovedAmount,
              submission.PaymentMethod,
              submission.ReferenceNumber,
              submission.Status,
              submission.Note,
              submission.ReviewRemarks,
              submission.ProofOriginalFileName,
              submission.ProofRelativeUrl,
              submission.SubmittedAtUtc,
              submission.ReviewedAtUtc));
        }).DisableAntiforgery();

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

  private static async Task<IResult> GetSecurityAsync(
      ClaimsPrincipal user,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      CancellationToken cancellationToken) {
    var customer = await LoadCurrentCustomerAsync(user, dbContext, cancellationToken);
    if (customer is null) {
      return Results.Unauthorized();
    }

    return Results.Ok(await CreateSecurityResponseAsync(dbContext, schemeProvider, customer, cancellationToken));
  }

  private static async Task<IResult> ChangePasswordAsync(
      ClaimsPrincipal user,
      HttpContext httpContext,
      [FromBody] ChangeAccountPasswordRequest request,
      ServiFinanceDbContext dbContext,
      IPasswordHasher<Customer> passwordHasher,
      IPasswordPolicyService passwordPolicyService,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var customer = await LoadCurrentCustomerAsync(user, dbContext, cancellationToken);
    if (customer is null) {
      return Results.Unauthorized();
    }

    if (string.IsNullOrWhiteSpace(request.CurrentPassword)) {
      return Results.BadRequest(new { error = "Current password is required." });
    }

    if (!string.Equals(request.NewPassword, request.ConfirmPassword, StringComparison.Ordinal)) {
      return Results.BadRequest(new { error = "New password confirmation does not match." });
    }

    if (string.Equals(request.CurrentPassword, request.NewPassword, StringComparison.Ordinal)) {
      return Results.BadRequest(new { error = "New password must be different from the current password." });
    }

    var passwordPolicy = passwordPolicyService.Validate(
        request.NewPassword,
        new PasswordPolicyContext(customer.Email, customer.FullName, customer.Tenant?.DomainSlug));
    if (!passwordPolicy.IsValid) {
      return Results.BadRequest(new { error = string.Join(" ", passwordPolicy.Errors) });
    }

    var verificationResult = passwordHasher.VerifyHashedPassword(customer, customer.PasswordHash, request.CurrentPassword);
    if (verificationResult == PasswordVerificationResult.Failed) {
      await WriteCustomerSecurityAuditAsync(
          auditLogService,
          httpContext,
          customer,
          "PasswordChanged",
          "Failed",
          "Password change failed because the current password was incorrect.",
          cancellationToken);

      return Results.BadRequest(new { error = "Current password is incorrect." });
    }

    customer.PasswordHash = passwordHasher.HashPassword(customer, request.NewPassword);
    await dbContext.SaveChangesAsync(cancellationToken);
    await WriteCustomerSecurityAuditAsync(
        auditLogService,
        httpContext,
        customer,
        "PasswordChanged",
        "Success",
        "Password changed from the customer profile page.",
        cancellationToken);

    return Results.Ok(new AccountPasswordChangeResponse("Password updated successfully."));
  }

  private static async Task<IResult> EnableMfaAsync(
      ClaimsPrincipal user,
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      IEmailSender emailSender,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var customer = await LoadCurrentCustomerAsync(user, dbContext, cancellationToken);
    if (customer is null) {
      return Results.Unauthorized();
    }

    var googleLink = await LoadCustomerGoogleLinkAsync(dbContext, customer.Id, cancellationToken);
    if (googleLink is null || string.IsNullOrWhiteSpace(googleLink.Email)) {
      return Results.BadRequest(new { error = "Link a Google account before enabling MFA. Sign-in codes are sent to the linked Google email." });
    }

    if (!emailSender.IsConfigured) {
      return Results.BadRequest(new { error = "SMTP email delivery must be configured before enabling MFA." });
    }

    var stateKey = AuthApiEndpointMappings.BuildMfaStateKey(AuthenticationSurface.CustomerWeb, customer.Id);
    var state = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == AuthApiEndpointMappings.AuthSecurityProvider &&
                entity.StateKey == stateKey,
            cancellationToken);

    if (state is null) {
      state = new ExternalServiceState {
        Provider = AuthApiEndpointMappings.AuthSecurityProvider,
        StateKey = stateKey
      };
      dbContext.ExternalServiceStates.Add(state);
    }

    state.PayloadJson = JsonSerializer.Serialize(new CustomerMfaRegistrationPayload(true, DateTime.UtcNow));
    state.ExpiresAtUtc = null;
    state.UpdatedAtUtc = DateTime.UtcNow;
    await dbContext.SaveChangesAsync(cancellationToken);

    await WriteCustomerSecurityAuditAsync(
        auditLogService,
        httpContext,
        customer,
        "MfaEnabled",
        "Success",
        "MFA was enabled for the customer account.",
        cancellationToken);

    return Results.Ok(await CreateSecurityResponseAsync(dbContext, schemeProvider, customer, cancellationToken));
  }

  private static async Task<IResult> DisableMfaAsync(
      ClaimsPrincipal user,
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var customer = await LoadCurrentCustomerAsync(user, dbContext, cancellationToken);
    if (customer is null) {
      return Results.Unauthorized();
    }

    var state = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == AuthApiEndpointMappings.AuthSecurityProvider &&
                entity.StateKey == AuthApiEndpointMappings.BuildMfaStateKey(AuthenticationSurface.CustomerWeb, customer.Id),
            cancellationToken);

    if (state is not null) {
      dbContext.ExternalServiceStates.Remove(state);
      await dbContext.SaveChangesAsync(cancellationToken);
    }

    await WriteCustomerSecurityAuditAsync(
        auditLogService,
        httpContext,
        customer,
        "MfaDisabled",
        "Success",
        "MFA was disabled for the customer account.",
        cancellationToken);

    return Results.Ok(await CreateSecurityResponseAsync(dbContext, schemeProvider, customer, cancellationToken));
  }

  private static async Task<IResult> StartGoogleLinkAsync(
      ClaimsPrincipal user,
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      CancellationToken cancellationToken) {
    if (!await IsGoogleConfiguredAsync(schemeProvider)) {
      return Results.BadRequest(new { error = "Google authentication is not configured on the API host." });
    }

    var customer = await LoadCurrentCustomerAsync(user, dbContext, cancellationToken);
    if (customer is null) {
      return Results.Unauthorized();
    }

    var returnUrl = SanitizeReturnUrl(httpContext.Request.Query["returnUrl"].ToString(), $"/t/{customer.Tenant?.DomainSlug ?? string.Empty}/c/profile");
    var properties = new AuthenticationProperties {
      RedirectUri = "/api/customer-portal/google/callback"
    };
    properties.Items["customerId"] = customer.Id.ToString("N");
    properties.Items["returnUrl"] = returnUrl;

    return Results.Challenge(properties, [GoogleDefaults.AuthenticationScheme]);
  }

  private static async Task<IResult> CompleteGoogleLinkAsync(
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var result = await httpContext.AuthenticateAsync(GoogleExternalScheme);
    var returnUrl = SanitizeReturnUrl(GetAuthenticationProperty(result.Properties, "returnUrl"), "/");
    if (!result.Succeeded || result.Principal is null || result.Properties is null) {
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "failed"));
    }

    if (!Guid.TryParse(GetAuthenticationProperty(result.Properties, "customerId"), out var customerId)) {
      await httpContext.SignOutAsync(GoogleExternalScheme);
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "failed"));
    }

    var googleSubject = result.Principal.FindFirstValue(ClaimTypes.NameIdentifier)?.Trim();
    var googleEmail = result.Principal.FindFirstValue(ClaimTypes.Email)?.Trim();
    var googleName = result.Principal.FindFirstValue(ClaimTypes.Name)?.Trim();
    if (string.IsNullOrWhiteSpace(googleSubject) || string.IsNullOrWhiteSpace(googleEmail)) {
      await httpContext.SignOutAsync(GoogleExternalScheme);
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "missing-profile"));
    }

    var customer = await dbContext.Customers
        .Include(entity => entity.Tenant)
        .SingleOrDefaultAsync(entity => entity.Id == customerId, cancellationToken);
    if (customer is null) {
      await httpContext.SignOutAsync(GoogleExternalScheme);
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "missing-customer"));
    }

    var staffSubjectStateExists = await dbContext.ExternalServiceStates
        .AnyAsync(
            entity => entity.Provider == GoogleLinkProvider &&
                entity.StateKey == BuildStaffGoogleSubjectStateKey(googleSubject),
            cancellationToken);
    if (staffSubjectStateExists) {
      await httpContext.SignOutAsync(GoogleExternalScheme);
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "already-linked"));
    }

    var existingSubjectState = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == GoogleLinkProvider &&
                entity.StateKey == BuildCustomerGoogleSubjectStateKey(googleSubject),
            cancellationToken);
    var existingSubjectPayload = DeserializeCustomerGoogleLink(existingSubjectState?.PayloadJson);
    if (existingSubjectPayload is not null && existingSubjectPayload.CustomerId != customer.Id) {
      await httpContext.SignOutAsync(GoogleExternalScheme);
      return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "already-linked"));
    }

    var customerState = await GetOrCreateCustomerGoogleStateAsync(dbContext, BuildCustomerGoogleStateKey(customer.Id), cancellationToken);
    var oldCustomerPayload = DeserializeCustomerGoogleLink(customerState.PayloadJson);
    if (oldCustomerPayload is not null && !string.Equals(oldCustomerPayload.Subject, googleSubject, StringComparison.Ordinal)) {
      var oldSubjectState = await dbContext.ExternalServiceStates
          .SingleOrDefaultAsync(
              entity => entity.Provider == GoogleLinkProvider &&
                  entity.StateKey == BuildCustomerGoogleSubjectStateKey(oldCustomerPayload.Subject),
              cancellationToken);
      if (oldSubjectState is not null) {
        dbContext.ExternalServiceStates.Remove(oldSubjectState);
      }
    }

    var subjectState = existingSubjectState ?? await GetOrCreateCustomerGoogleStateAsync(dbContext, BuildCustomerGoogleSubjectStateKey(googleSubject), cancellationToken);
    var payload = new CustomerGoogleAccountLinkPayload(customer.Id, googleSubject, googleEmail, googleName, DateTime.UtcNow);
    customerState.PayloadJson = JsonSerializer.Serialize(payload);
    customerState.ExpiresAtUtc = null;
    customerState.UpdatedAtUtc = DateTime.UtcNow;
    subjectState.PayloadJson = JsonSerializer.Serialize(payload);
    subjectState.ExpiresAtUtc = null;
    subjectState.UpdatedAtUtc = DateTime.UtcNow;

    await dbContext.SaveChangesAsync(cancellationToken);
    await httpContext.SignOutAsync(GoogleExternalScheme);
    await WriteCustomerSecurityAuditAsync(
        auditLogService,
        httpContext,
        customer,
        "GoogleLinked",
        "Success",
        $"Google account {googleEmail} was linked.",
        cancellationToken);

    return Results.LocalRedirect(AppendQuery(returnUrl, "googleLink", "linked"));
  }

  private static async Task<IResult> UnlinkGoogleAsync(
      ClaimsPrincipal user,
      HttpContext httpContext,
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      IAuditLogService auditLogService,
      CancellationToken cancellationToken) {
    var customer = await LoadCurrentCustomerAsync(user, dbContext, cancellationToken);
    if (customer is null) {
      return Results.Unauthorized();
    }

    if (await AuthApiEndpointMappings.IsMfaEnabledAsync(dbContext, AuthenticationSurface.CustomerWeb, customer.Id, cancellationToken)) {
      return Results.BadRequest(new { error = "Disable MFA before unlinking Google. MFA codes are sent to the linked Google email." });
    }

    var customerState = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == GoogleLinkProvider &&
                entity.StateKey == BuildCustomerGoogleStateKey(customer.Id),
            cancellationToken);
    var payload = DeserializeCustomerGoogleLink(customerState?.PayloadJson);
    if (customerState is not null) {
      dbContext.ExternalServiceStates.Remove(customerState);
    }

    if (payload is not null) {
      var subjectState = await dbContext.ExternalServiceStates
          .SingleOrDefaultAsync(
              entity => entity.Provider == GoogleLinkProvider &&
                  entity.StateKey == BuildCustomerGoogleSubjectStateKey(payload.Subject),
              cancellationToken);
      if (subjectState is not null) {
        dbContext.ExternalServiceStates.Remove(subjectState);
      }
    }

    await dbContext.SaveChangesAsync(cancellationToken);
    await WriteCustomerSecurityAuditAsync(
        auditLogService,
        httpContext,
        customer,
        "GoogleUnlinked",
        "Success",
        "Google account link was removed.",
        cancellationToken);

    return Results.Ok(await CreateSecurityResponseAsync(dbContext, schemeProvider, customer, cancellationToken));
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
            entity.AddressDetails,
            entity.ContactOptions
                .OrderByDescending(option => option.IsDefault)
                .ThenBy(option => option.Label)
                .Select(option => new CustomerPortalContactOptionRecord(
                    option.Id,
                    option.Label,
                    option.ContactName,
                    option.PhoneNumber,
                    option.Address,
                    option.AddressDetails,
                    option.IsDefault,
                    option.CreatedAtUtc))
                .ToList()))
        .SingleOrDefaultAsync(cancellationToken);

  internal static async Task<CustomerGoogleAccountLinkPayload?> LoadCustomerGoogleLinkAsync(
      ServiFinanceDbContext dbContext,
      Guid customerId,
      CancellationToken cancellationToken) {
    var state = await dbContext.ExternalServiceStates
        .AsNoTracking()
        .SingleOrDefaultAsync(
            entity => entity.Provider == GoogleLinkProvider &&
                entity.StateKey == BuildCustomerGoogleStateKey(customerId),
            cancellationToken);

    return DeserializeCustomerGoogleLink(state?.PayloadJson);
  }

  private static async Task<Customer?> LoadCurrentCustomerAsync(
      ClaimsPrincipal user,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId)) {
      return null;
    }

    return await dbContext.Customers
        .Include(entity => entity.Tenant)
        .SingleOrDefaultAsync(entity => entity.Id == customerId, cancellationToken);
  }

  private static async Task<object> CreateSecurityResponseAsync(
      ServiFinanceDbContext dbContext,
      IAuthenticationSchemeProvider schemeProvider,
      Customer customer,
      CancellationToken cancellationToken) {
    var mfaEnabled = await AuthApiEndpointMappings.IsMfaEnabledAsync(
        dbContext,
        AuthenticationSurface.CustomerWeb,
        customer.Id,
        cancellationToken);
    var googleLink = await LoadCustomerGoogleLinkAsync(dbContext, customer.Id, cancellationToken);

    return new {
      mfaEnabled,
      surface = AuthenticationSurface.CustomerWeb.ToString(),
      googleConfigured = await IsGoogleConfiguredAsync(schemeProvider),
      googleLinked = googleLink is not null,
      googleEmail = googleLink?.Email,
      googleName = googleLink?.Name,
      googleLinkedAtUtc = googleLink?.LinkedAtUtc
    };
  }

  private static async Task<bool> IsGoogleConfiguredAsync(IAuthenticationSchemeProvider schemeProvider) =>
    await schemeProvider.GetSchemeAsync(GoogleDefaults.AuthenticationScheme) is not null;

  private static async Task<ExternalServiceState> GetOrCreateCustomerGoogleStateAsync(
      ServiFinanceDbContext dbContext,
      string stateKey,
      CancellationToken cancellationToken) {
    var state = await dbContext.ExternalServiceStates
        .SingleOrDefaultAsync(
            entity => entity.Provider == GoogleLinkProvider &&
                entity.StateKey == stateKey,
            cancellationToken);

    if (state is not null) {
      return state;
    }

    state = new ExternalServiceState {
      Provider = GoogleLinkProvider,
      StateKey = stateKey
    };
    dbContext.ExternalServiceStates.Add(state);
    return state;
  }

  private static CustomerGoogleAccountLinkPayload? DeserializeCustomerGoogleLink(string? payloadJson) {
    if (string.IsNullOrWhiteSpace(payloadJson)) {
      return null;
    }

    try {
      return JsonSerializer.Deserialize<CustomerGoogleAccountLinkPayload>(payloadJson);
    } catch (JsonException) {
      return null;
    }
  }

  private static string? GetAuthenticationProperty(AuthenticationProperties? properties, string key) {
    if (properties?.Items is null) {
      return null;
    }

    return properties.Items.TryGetValue(key, out var value) ? value : null;
  }

  internal static string BuildCustomerGoogleStateKey(Guid customerId) =>
    $"google-link:customer:{customerId:N}";

  private static string BuildCustomerGoogleSubjectStateKey(string subject) =>
    $"google-link:customer-subject:{subject.Trim()}";

  private static string BuildStaffGoogleSubjectStateKey(string subject) =>
    $"google-link:subject:{subject.Trim()}";

  private static string AppendQuery(string returnUrl, string key, string value) {
    var separator = returnUrl.Contains('?') ? "&" : "?";
    return $"{returnUrl}{separator}{Uri.EscapeDataString(key)}={Uri.EscapeDataString(value)}";
  }

  private static Task WriteCustomerSecurityAuditAsync(
      IAuditLogService auditLogService,
      HttpContext httpContext,
      Customer customer,
      string actionType,
      string outcome,
      string detail,
      CancellationToken cancellationToken) =>
    auditLogService.WriteAsync(
      new AuditLogEntry(
        customer.TenantId,
        ScopeCustomer,
        CategorySecurity,
        actionType,
        outcome,
        null,
        customer.FullName,
        customer.Email,
        "Customer",
        customer.Id,
        customer.Email,
        detail,
        ResolveIpAddress(httpContext),
        ResolveUserAgent(httpContext)),
      cancellationToken);

  private static string? ResolveIpAddress(HttpContext httpContext) =>
    httpContext.Connection.RemoteIpAddress?.ToString();

  private static string? ResolveUserAgent(HttpContext httpContext) {
    var userAgent = httpContext.Request.Headers.UserAgent.ToString();
    return string.IsNullOrWhiteSpace(userAgent) ? null : userAgent;
  }

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
    if (((payload.AddressDetails ?? string.Empty).Trim().Length) > AddressDetailsMaxLength) {
      return $"Address details must be {AddressDetailsMaxLength} characters or fewer.";
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

  private static bool IsSupportedSettlementProof(IFormFile file) =>
    file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase);

  private static decimal RoundCurrency(decimal value) =>
    Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

public sealed record CustomerPortalProfileResponse(
    Guid Id,
    string TenantDomainSlug,
    string FullName,
    string Email,
    string MobileNumber,
    string Address,
    string? AddressDetails,
    IReadOnlyList<CustomerPortalContactOptionRecord> ContactOptions);
public sealed record CustomerGoogleAccountLinkPayload(
    Guid CustomerId,
    string Subject,
    string Email,
    string? Name,
    DateTime LinkedAtUtc);
public sealed record CustomerMfaRegistrationPayload(bool Enabled, DateTime EnabledAtUtc);
public sealed record CustomerPortalContactOptionRecord(
    Guid Id,
    string Label,
    string ContactName,
    string PhoneNumber,
    string Address,
    string? AddressDetails,
    bool IsDefault,
    DateTime CreatedAtUtc);
public sealed record UpdateCustomerProfilePayload(string FullName, string MobileNumber, string Address, string? AddressDetails);
public sealed record UpsertCustomerContactOptionPayload(
    string Label,
    string ContactName,
    string PhoneNumber,
    string Address,
    string? AddressDetails,
    bool IsDefault);
public sealed record CreateCustomerRequestPayload(
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    string? ServiceMode,
    string? ServiceAddress,
    string? ServiceAddressDetails,
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
public sealed class SubmitCustomerInvoicePaymentSubmissionRequest {
  public decimal AmountSubmitted { get; init; }
  public string? PaymentMethod { get; init; }
  public string? ReferenceNumber { get; init; }
  public string? Note { get; init; }
  public IFormFile? ProofFile { get; init; }
}
public sealed record SyncCustomerInvoiceStripeCheckoutRequest(string CheckoutSessionId);
public sealed record CustomerPortalRequestRecord(
    Guid Id,
    string RequestNumber,
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    DateTime? RequestedServiceDate,
    string ServiceMode,
    string ServiceAddress,
    string? ServiceAddressDetails,
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
    decimal SubtotalAmount,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal TotalAmount,
    decimal OutstandingAmount,
    decimal InterestableAmount,
    DateTime InvoiceDateUtc,
    bool HasMicroLoan,
    string? MicroLoanStatus,
    bool CanSubmitPaymentProof,
    bool CanStartStripeCheckout,
    IReadOnlyList<CustomerPortalRequestInvoiceLineRecord> Lines,
    IReadOnlyList<CustomerPortalInvoicePaymentSubmissionRecord> PaymentSubmissions);
public sealed record CustomerPortalInvoicePaymentSubmissionRecord(
    Guid Id,
    decimal AmountSubmitted,
    decimal? ApprovedAmount,
    string PaymentMethod,
    string ReferenceNumber,
    string Status,
    string? Note,
    string? ReviewRemarks,
    string? ProofOriginalFileName,
    string? ProofRelativeUrl,
    DateTime SubmittedAtUtc,
    DateTime? ReviewedAtUtc);
public sealed record CustomerPortalInvoiceSummaryRecord(
    Guid Id,
    string InvoiceNumber,
    DateTime InvoiceDateUtc,
    decimal TotalAmount,
    decimal OutstandingAmount,
    string InvoiceStatus,
    Guid? ServiceRequestId,
    string? ServiceRequestNumber,
    bool HasMicroLoan,
    string? MicroLoanStatus,
    bool CanSubmitPaymentProof,
    bool CanStartStripeCheckout,
    IReadOnlyList<CustomerPortalInvoicePaymentSubmissionRecord> PaymentSubmissions);
public sealed record CustomerPortalStripeCheckoutSessionResponse(
    Guid InvoiceId,
    string CheckoutSessionId,
    string CheckoutUrl);
public sealed record CustomerPortalStripeCheckoutSyncResponse(
    Guid InvoiceId,
    string InvoiceStatus,
    decimal OutstandingAmount,
    bool PaymentApplied);
public sealed record CustomerPortalRequestInvoiceLineRecord(
    Guid Id,
    string Category,
    string Name,
    string? Specification,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal);
public sealed record CustomerPortalServiceCostLineRecord(
    Guid Id,
    string Category,
    string Name,
    string? Specification,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal);
public sealed record CustomerPortalServiceCostSheetRecord(
    Guid Id,
    string Status,
    bool IsTaxEnabled,
    string TaxLabel,
    decimal TaxRate,
    decimal SubtotalAmount,
    decimal TaxAmount,
    decimal TotalAmount,
    string? Notes,
    DateTime UpdatedAtUtc,
    IReadOnlyList<CustomerPortalServiceCostLineRecord> Lines);
public sealed record CustomerPortalRequestDetailRecord(
    Guid Id,
    string RequestNumber,
    string ItemType,
    string ItemDescription,
    string IssueDescription,
    DateTime? RequestedServiceDate,
    string ServiceMode,
    string ServiceAddress,
    string? ServiceAddressDetails,
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
    CustomerPortalRequestInvoiceRecord? Invoice,
    CustomerPortalServiceCostSheetRecord? CostSheet);
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
public sealed record CustomerPortalRequestNotificationRecord(
    Guid Id,
    Guid RequestId,
    string RequestNumber,
    string ItemType,
    string Status,
    string Remarks,
    DateTime ChangedAtUtc);
public sealed record CustomerPortalRequestNotificationFeedResponse(
    DateTime CursorUtc,
    IReadOnlyList<CustomerPortalRequestNotificationRecord> Events);
public sealed record CustomerPortalRequestDetailsResponse(
    CustomerPortalRequestDetailRecord Request,
    IReadOnlyList<CustomerPortalTimelineEntryRecord> Timeline,
    IReadOnlyList<CustomerPortalAssignmentRecord> Assignments,
    IReadOnlyList<CustomerPortalRequestAttachmentRecord> Attachments);

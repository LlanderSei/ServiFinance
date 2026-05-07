namespace ServiFinance.Api.Endpoints.TenantSms;

using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Payments;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantSmsServiceRequestsEndpointMappings {
  private const int ContactNameMaxLength = 200;
  private const int ContactPhoneMaxLength = 50;
  private const int ServiceAddressMaxLength = 500;
  private const int AddressDetailsMaxLength = 500;
  private const int CostSheetNoteMaxLength = 1000;
  private const int CostTaxLabelMaxLength = 80;
  private const int CostLineNameMaxLength = 160;
  private const int CostLineSpecificationMaxLength = 300;
  private const int PaymentMethodMaxLength = 80;
  private const int PaymentReferenceNumberMaxLength = 120;
  private const int PaymentNoteMaxLength = 1000;

  public static RouteGroupBuilder MapTenantSmsServiceRequestsEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/sms/service-requests", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var serviceRequests = await dbContext.ServiceRequests
          .AsNoTracking()
          .OrderByDescending(entity => entity.CreatedAtUtc)
          .Select(entity => new {
            entity.Id,
            entity.CustomerId,
            CustomerCode = entity.Customer!.CustomerCode,
            CustomerName = entity.Customer!.FullName,
            entity.RequestNumber,
            entity.ItemType,
            entity.ItemDescription,
            entity.IssueDescription,
            entity.RequestedServiceDate,
            entity.ServiceMode,
            entity.ServiceAddress,
            entity.ServiceAddressDetails,
            entity.ContactName,
            entity.ContactPhone,
            entity.PreferredScheduleStartUtc,
            entity.PreferredScheduleEndUtc,
            entity.NeededByUtc,
            entity.Priority,
            entity.CurrentStatus,
            entity.CreatedAtUtc,
            CreatedByUserName = entity.CreatedByUser != null
                ? entity.CreatedByUser.FullName
                : entity.CreatedByCustomer != null
                    ? entity.CreatedByCustomer.FullName
                    : "Customer portal",
            entity.Rating,
            entity.FeedbackComments,
            entity.FeedbackSuggestionCategory,
            entity.CompletedAtUtc,
            entity.FeedbackSubmittedAtUtc,
            entity.FeedbackExpiresAtUtc,
            entity.CancellationRequestedAtUtc,
            entity.CancelledAtUtc,
            entity.CancellationReason,
            InvoiceId = entity.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => (Guid?)invoice.Id)
                  .FirstOrDefault(),
            InvoiceNumber = entity.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => invoice.InvoiceNumber)
                  .FirstOrDefault(),
            InvoiceStatus = entity.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => invoice.InvoiceStatus)
                  .FirstOrDefault(),
            InvoiceTotalAmount = entity.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => (decimal?)invoice.TotalAmount)
                  .FirstOrDefault(),
            InvoiceOutstandingAmount = entity.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => (decimal?)invoice.OutstandingAmount)
                  .FirstOrDefault(),
            InterestableAmount = entity.Invoices
                  .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                  .Select(invoice => (decimal?)invoice.InterestableAmount)
                  .FirstOrDefault(),
            HasMicroLoan = entity.Invoices.Any(invoice => invoice.MicroLoan != null)
          })
          .ToListAsync(cancellationToken);

          return Results.Ok(serviceRequests.Select(entity => CreateTenantServiceRequestResponse(
          entity.Id,
          entity.CustomerId,
          entity.CustomerCode,
          entity.CustomerName,
          entity.RequestNumber,
          entity.ItemType,
          entity.ItemDescription,
          entity.IssueDescription,
          entity.RequestedServiceDate,
          entity.ServiceMode,
          entity.ServiceAddress,
          entity.ServiceAddressDetails,
          entity.ContactName,
          entity.ContactPhone,
          entity.PreferredScheduleStartUtc,
          entity.PreferredScheduleEndUtc,
          entity.NeededByUtc,
          entity.Priority,
          entity.CurrentStatus,
          entity.CreatedAtUtc,
          entity.CreatedByUserName,
          entity.Rating,
          entity.FeedbackComments,
          entity.FeedbackSuggestionCategory,
          entity.CompletedAtUtc,
          entity.FeedbackSubmittedAtUtc,
          entity.FeedbackExpiresAtUtc,
          entity.CancellationRequestedAtUtc,
          entity.CancelledAtUtc,
          entity.CancellationReason,
          entity.InvoiceId,
          entity.InvoiceNumber,
          entity.InvoiceStatus,
          entity.InvoiceTotalAmount,
          entity.InvoiceOutstandingAmount,
          entity.InterestableAmount,
          entity.HasMicroLoan)));
        })
        .RequireTenantSmsPermission("sms.service-requests.view", SmsModuleCodeServiceIntake);
    tenantApi.MapGet("/sms/service-requests/{serviceRequestId:guid}/details", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid serviceRequestId,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var detailResponse = await LoadTenantServiceRequestDetailResponseAsync(
              dbContext,
              serviceRequestId,
              cancellationToken);

          return detailResponse is null
              ? Results.NotFound()
              : Results.Ok(detailResponse);
        })
        .RequireTenantSmsPermission("sms.service-requests.view", SmsModuleCodeServiceIntake);
    tenantApi.MapPost("/sms/service-requests", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] CreateServiceRequestRecordRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (request.CustomerId == Guid.Empty) {
            return Results.BadRequest(new { error = "A customer must be selected." });
          }

          if (string.IsNullOrWhiteSpace(request.ItemType) || string.IsNullOrWhiteSpace(request.IssueDescription)) {
            return Results.BadRequest(new { error = "Item type and issue description are required." });
          }

          var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
          if (!Guid.TryParse(userId, out var createdByUserId)) {
            return Results.Unauthorized();
          }

          var customer = await dbContext.Customers
          .AsNoTracking()
          .SingleOrDefaultAsync(entity => entity.Id == request.CustomerId, cancellationToken);
          if (customer is null) {
            return Results.BadRequest(new { error = "The selected customer was not found." });
          }

          var serviceMode = NormalizeServiceMode(request.ServiceMode);
          var serviceAddress = NormalizeOptionalText(request.ServiceAddress) ?? customer.Address.Trim();
          var serviceAddressDetails = NormalizeOptionalText(request.ServiceAddressDetails) ?? NormalizeOptionalText(customer.AddressDetails);
          var contactName = NormalizeOptionalText(request.ContactName) ?? customer.FullName.Trim();
          var contactPhone = NormalizeOptionalText(request.ContactPhone) ?? customer.MobileNumber.Trim();
          if (RequiresServiceAddress(serviceMode) && string.IsNullOrWhiteSpace(serviceAddress)) {
            return Results.BadRequest(new { error = "A service address is required for on-site or pickup requests." });
          }
          if ((serviceAddress?.Length ?? 0) > ServiceAddressMaxLength) {
            return Results.BadRequest(new { error = $"Service address must be {ServiceAddressMaxLength} characters or fewer." });
          }
          if ((serviceAddressDetails?.Length ?? 0) > AddressDetailsMaxLength) {
            return Results.BadRequest(new { error = $"Address details must be {AddressDetailsMaxLength} characters or fewer." });
          }
          if ((contactName?.Length ?? 0) > ContactNameMaxLength) {
            return Results.BadRequest(new { error = $"Contact name must be {ContactNameMaxLength} characters or fewer." });
          }
          if ((contactPhone?.Length ?? 0) > ContactPhoneMaxLength) {
            return Results.BadRequest(new { error = $"Contact phone must be {ContactPhoneMaxLength} characters or fewer." });
          }
          if (request.PreferredScheduleStartUtc.HasValue &&
              request.PreferredScheduleEndUtc.HasValue &&
              request.PreferredScheduleEndUtc.Value <= request.PreferredScheduleStartUtc.Value) {
            return Results.BadRequest(new { error = "Preferred schedule end must be after the start time." });
          }

          var serviceRequest = new ServiFinance.Domain.ServiceRequest {
            CustomerId = request.CustomerId,
            RequestNumber = GenerateReferenceCode("SR"),
            ItemType = request.ItemType.Trim(),
            ItemDescription = (request.ItemDescription ?? string.Empty).Trim(),
            IssueDescription = request.IssueDescription.Trim(),
            RequestedServiceDate = request.NeededByUtc?.Date ?? request.PreferredScheduleStartUtc?.Date ?? request.RequestedServiceDate,
            ServiceMode = serviceMode,
            ServiceAddress = serviceAddress ?? string.Empty,
            ServiceAddressDetails = serviceAddressDetails,
            ContactName = contactName ?? string.Empty,
            ContactPhone = contactPhone ?? string.Empty,
            PreferredScheduleStartUtc = request.PreferredScheduleStartUtc,
            PreferredScheduleEndUtc = request.PreferredScheduleEndUtc,
            NeededByUtc = request.NeededByUtc,
            Priority = string.IsNullOrWhiteSpace(request.Priority) ? "Normal" : request.Priority.Trim(),
            CurrentStatus = "New",
            CreatedByUserId = createdByUserId,
            CreatedAtUtc = DateTime.UtcNow
          };

          dbContext.ServiceRequests.Add(serviceRequest);
          dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
            ServiceRequestId = serviceRequest.Id,
            Status = serviceRequest.CurrentStatus,
            Remarks = "Service request created.",
            ChangedByUserId = createdByUserId,
            ChangedAtUtc = DateTime.UtcNow
          });
          await dbContext.SaveChangesAsync(cancellationToken);

          var createdByUserName = await dbContext.Users
          .Where(entity => entity.Id == createdByUserId)
          .Select(entity => entity.FullName)
          .SingleAsync(cancellationToken);

          return Results.Ok(CreateTenantServiceRequestResponse(
          serviceRequest.Id,
          serviceRequest.CustomerId,
          customer.CustomerCode,
          customer.FullName,
          serviceRequest.RequestNumber,
          serviceRequest.ItemType,
          serviceRequest.ItemDescription,
          serviceRequest.IssueDescription,
          serviceRequest.RequestedServiceDate,
          serviceRequest.ServiceMode,
          serviceRequest.ServiceAddress ?? string.Empty,
          serviceRequest.ServiceAddressDetails,
          serviceRequest.ContactName ?? string.Empty,
          serviceRequest.ContactPhone ?? string.Empty,
          serviceRequest.PreferredScheduleStartUtc,
          serviceRequest.PreferredScheduleEndUtc,
          serviceRequest.NeededByUtc,
          serviceRequest.Priority,
          serviceRequest.CurrentStatus,
          serviceRequest.CreatedAtUtc,
          createdByUserName,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          false));
        })
        .RequireTenantSmsPermission("sms.service-requests.manage", SmsModuleCodeServiceIntake);
    tenantApi.MapPut("/sms/service-requests/{serviceRequestId:guid}/cost-sheet", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid serviceRequestId,
        [FromBody] SaveTenantServiceCostSheetRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var serviceRequest = await dbContext.ServiceRequests
              .Include(entity => entity.Invoices)
              .Include(entity => entity.CostSheet!)
                  .ThenInclude(entity => entity.Lines)
              .SingleOrDefaultAsync(entity => entity.Id == serviceRequestId, cancellationToken);
          if (serviceRequest is null) {
            return Results.NotFound();
          }

          if (serviceRequest.Invoices.Any()) {
            return Results.BadRequest(new { error = "Costing can no longer be edited after the invoice is finalized." });
          }
          if (string.Equals(serviceRequest.CurrentStatus, "Cancelled", StringComparison.OrdinalIgnoreCase) ||
              string.Equals(serviceRequest.CurrentStatus, "Cancellation Requested", StringComparison.OrdinalIgnoreCase) ||
              string.Equals(serviceRequest.CurrentStatus, "Closed", StringComparison.OrdinalIgnoreCase)) {
            return Results.BadRequest(new { error = "Costing cannot be edited for cancelled or closed service requests." });
          }

          var validationError = ValidateCostSheetRequest(request);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var requestedPresetIds = request.Lines
              .Where(entity => entity.ServiceCostPresetId.HasValue)
              .Select(entity => entity.ServiceCostPresetId!.Value)
              .Distinct()
              .ToList();
          if (requestedPresetIds.Count > 0) {
            var validPresetIds = await dbContext.ServiceCostPresets
                .Where(entity => requestedPresetIds.Contains(entity.Id))
                .Select(entity => entity.Id)
                .ToListAsync(cancellationToken);
            if (validPresetIds.Count != requestedPresetIds.Count) {
              return Results.BadRequest(new { error = "One or more selected cost presets are no longer available." });
            }
          }

          var policy = await LoadTenantCostingPolicyEntityAsync(httpContext.User, dbContext, cancellationToken);
          var now = DateTime.UtcNow;
          var costSheet = serviceRequest.CostSheet;
          if (costSheet is null) {
            costSheet = new ServiFinance.Domain.ServiceCostSheet {
              ServiceRequestId = serviceRequest.Id,
              Status = "Draft",
              IsTaxEnabled = policy.TaxEnabledByDefault,
              TaxLabel = policy.TaxLabel,
              TaxRate = policy.DefaultTaxRate,
              Notes = null,
              CreatedAtUtc = now,
              UpdatedAtUtc = now
            };
            dbContext.ServiceCostSheets.Add(costSheet);
            serviceRequest.CostSheet = costSheet;
          }

          costSheet.Status = "Draft";
          costSheet.IsTaxEnabled = request.IsTaxEnabled;
          costSheet.TaxLabel = request.TaxLabel.Trim();
          costSheet.TaxRate = RoundMoney(request.TaxRate);
          costSheet.Notes = NormalizeOptionalText(request.Notes);
          costSheet.UpdatedAtUtc = now;
          costSheet.FinalizedAtUtc = null;

          var existingLinesById = costSheet.Lines.ToDictionary(entity => entity.Id);
          var retainedIds = new HashSet<Guid>();
          for (var index = 0; index < request.Lines.Count; index++) {
            var lineRequest = request.Lines[index];
            var specification = NormalizeOptionalText(lineRequest.Specification);
            var category = NormalizeServiceCostCategory(lineRequest.Category);
            var name = lineRequest.Name.Trim();
            var quantity = RoundMoney(lineRequest.Quantity);
            var unitPrice = RoundMoney(lineRequest.UnitPrice);
            if (lineRequest.Id is Guid existingId && existingLinesById.TryGetValue(existingId, out var existingLine)) {
              existingLine.ServiceCostPresetId = lineRequest.ServiceCostPresetId;
              existingLine.Category = category;
              existingLine.Name = name;
              existingLine.Specification = specification;
              existingLine.Quantity = quantity;
              existingLine.UnitPrice = unitPrice;
              existingLine.SortOrder = index;
              existingLine.UpdatedAtUtc = now;
              retainedIds.Add(existingId);
              continue;
            }

            var createdLine = new ServiFinance.Domain.ServiceCostLine {
              ServiceCostSheet = costSheet,
              ServiceCostPresetId = lineRequest.ServiceCostPresetId,
              Category = category,
              Name = name,
              Specification = specification,
              Quantity = quantity,
              UnitPrice = unitPrice,
              SortOrder = index,
              CreatedAtUtc = now,
              UpdatedAtUtc = now
            };
            dbContext.ServiceCostLines.Add(createdLine);
          }

          foreach (var existingLine in existingLinesById.Values.Where(entity => !retainedIds.Contains(entity.Id)).ToList()) {
            dbContext.ServiceCostLines.Remove(existingLine);
          }

          var draftSubtotalAmount = request.Lines.Sum(entity => RoundMoney(entity.Quantity) * RoundMoney(entity.UnitPrice));
          var draftTaxAmount = CalculateServiceCostTaxAmount(RoundMoney(draftSubtotalAmount), request.IsTaxEnabled, request.TaxRate);
          dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
            ServiceRequestId = serviceRequest.Id,
            Status = serviceRequest.CurrentStatus,
            Remarks = $"Service cost breakdown updated. Draft total: {RoundMoney(draftSubtotalAmount) + draftTaxAmount:0.00}.",
            ChangedByUserId = currentUserId,
            ChangedAtUtc = now
          });

          await dbContext.SaveChangesAsync(cancellationToken);

          var detailResponse = await LoadTenantServiceRequestDetailResponseAsync(
              dbContext,
              serviceRequestId,
              cancellationToken);

          return detailResponse is null
              ? Results.NotFound()
              : Results.Ok(detailResponse);
        })
        .RequireTenantSmsPermission("sms.costing.manage", SmsModuleCodeInvoicing);
    tenantApi.MapPost("/sms/service-requests/{serviceRequestId:guid}/record-payment", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid serviceRequestId,
        [FromBody] RecordTenantServiceInvoicePaymentRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          var paymentMethod = (request.PaymentMethod ?? string.Empty).Trim();
          if (string.IsNullOrWhiteSpace(paymentMethod)) {
            return Results.BadRequest(new { error = "Select the recorded payment method first." });
          }
          if (paymentMethod.Length > PaymentMethodMaxLength) {
            return Results.BadRequest(new { error = $"Payment method must be {PaymentMethodMaxLength} characters or fewer." });
          }

          var referenceNumber = NormalizeOptionalText(request.ReferenceNumber);
          if ((referenceNumber?.Length ?? 0) > PaymentReferenceNumberMaxLength) {
            return Results.BadRequest(new { error = $"Reference number must be {PaymentReferenceNumberMaxLength} characters or fewer." });
          }

          var note = NormalizeOptionalText(request.Note);
          if ((note?.Length ?? 0) > PaymentNoteMaxLength) {
            return Results.BadRequest(new { error = $"Payment note must be {PaymentNoteMaxLength} characters or fewer." });
          }

          var recordedAmount = RoundMoney(request.AmountReceived);
          if (recordedAmount <= 0m) {
            return Results.BadRequest(new { error = "Recorded payment amount must be greater than zero." });
          }

          var serviceRequest = await dbContext.ServiceRequests
              .Include(entity => entity.Invoices)
                .ThenInclude(entity => entity.PaymentSubmissions)
              .Include(entity => entity.Invoices)
                .ThenInclude(entity => entity.MicroLoan)
              .SingleOrDefaultAsync(entity => entity.Id == serviceRequestId, cancellationToken);
          if (serviceRequest is null) {
            return Results.NotFound();
          }

          var invoice = serviceRequest.Invoices
              .OrderByDescending(entity => entity.InvoiceDateUtc)
              .FirstOrDefault();
          if (invoice is null) {
            return Results.BadRequest(new { error = "Finalize the service invoice before recording direct payment." });
          }

          if (invoice.MicroLoan is not null) {
            return Results.BadRequest(new { error = "This invoice has already been converted into an MLS loan account." });
          }

          if (invoice.OutstandingAmount <= 0m || string.Equals(invoice.InvoiceStatus, ServiceInvoiceFinancePolicy.PaidStatus, StringComparison.OrdinalIgnoreCase)) {
            return Results.BadRequest(new { error = "This invoice is already fully settled." });
          }

          if (invoice.PaymentSubmissions.Any(entity => entity.Status == ServiceInvoiceFinancePolicy.PaymentSubmittedStatus)) {
            return Results.BadRequest(new { error = "A customer payment proof is still pending finance review for this invoice." });
          }

          if (invoice.PaymentSubmissions.Any(entity => entity.Status == ServiceInvoiceFinancePolicy.CheckoutPendingStatus)) {
            return Results.BadRequest(new { error = "A customer Stripe checkout session is still in progress for this invoice." });
          }

          if (recordedAmount > invoice.OutstandingAmount) {
            return Results.BadRequest(new { error = "Recorded payment amount cannot exceed the current outstanding balance." });
          }

          var now = DateTime.UtcNow;
          var resolvedReferenceNumber = referenceNumber ?? GenerateReferenceCode("PAY");
          dbContext.InvoicePaymentSubmissions.Add(new ServiFinance.Domain.InvoicePaymentSubmission {
            TenantId = invoice.TenantId,
            InvoiceId = invoice.Id,
            Invoice = invoice,
            CustomerId = invoice.CustomerId,
            ServiceRequestId = serviceRequest.Id,
            AmountSubmitted = recordedAmount,
            ApprovedAmount = recordedAmount,
            PaymentMethod = paymentMethod,
            ReferenceNumber = resolvedReferenceNumber,
            Note = note ?? "Tenant recorded this direct payment from the service workspace.",
            Status = "Approved",
            ReviewRemarks = "Confirmed directly by tenant staff.",
            SubmittedAtUtc = now,
            ReviewedByUserId = currentUserId,
            ReviewedAtUtc = now
          });

          invoice.OutstandingAmount = RoundMoney(invoice.OutstandingAmount - recordedAmount);
          invoice.InvoiceStatus = ServiceInvoiceFinancePolicy.DeriveInvoiceStatus(invoice);

          dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
            ServiceRequestId = serviceRequest.Id,
            Status = serviceRequest.CurrentStatus,
            Remarks = $"Tenant recorded {paymentMethod} payment for invoice {invoice.InvoiceNumber} amounting to {recordedAmount:0.00}.",
            ChangedByUserId = currentUserId,
            ChangedAtUtc = now
          });

          await dbContext.SaveChangesAsync(cancellationToken);

          var detailResponse = await LoadTenantServiceRequestDetailResponseAsync(
              dbContext,
              serviceRequestId,
              cancellationToken);

          return detailResponse is null
              ? Results.NotFound()
              : Results.Ok(detailResponse);
        })
        .RequireTenantSmsPermission("sms.invoices.settle", SmsModuleCodeInvoicing);
    tenantApi.MapPost("/sms/service-requests/{serviceRequestId:guid}/finalize-invoice", [Authorize(AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid serviceRequestId,
        [FromBody] FinalizeTenantServiceInvoiceRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          if (request.InterestableAmount < 0m || request.DiscountAmount < 0m) {
            return Results.BadRequest(new { error = "Interestable amount and discount amount cannot be negative." });
          }

          var serviceRequest = await dbContext.ServiceRequests
          .Include(entity => entity.Customer)
          .Include(entity => entity.CreatedByUser)
          .Include(entity => entity.CreatedByCustomer)
          .Include(entity => entity.Invoices)
              .ThenInclude(entity => entity.MicroLoan)
          .Include(entity => entity.CostSheet!)
              .ThenInclude(entity => entity.Lines)
          .SingleOrDefaultAsync(entity => entity.Id == serviceRequestId, cancellationToken);
          if (serviceRequest is null) {
            return Results.NotFound();
          }

          if (!string.Equals(serviceRequest.CurrentStatus, "Completed", StringComparison.OrdinalIgnoreCase)) {
            return Results.BadRequest(new { error = "Only completed service requests can be finalized into an invoice." });
          }

          if (serviceRequest.Invoices.Any()) {
            return Results.BadRequest(new { error = "This service request already has a finalized invoice." });
          }

          var finalizedAtUtc = DateTime.UtcNow;
          serviceRequest.CompletedAtUtc ??= finalizedAtUtc;
          serviceRequest.FeedbackExpiresAtUtc ??= serviceRequest.CompletedAtUtc.Value.AddDays(7);

          var costSheet = serviceRequest.CostSheet;
          var hasCostSheetLines = costSheet?.Lines.Any() == true;
          var subtotalAmount = hasCostSheetLines
              ? CalculateServiceCostSubtotal(costSheet!.Lines)
              : RoundMoney(request.SubtotalAmount);
          if (subtotalAmount <= 0m) {
            return Results.BadRequest(new { error = "Add at least one billable amount before finalizing the invoice." });
          }

          if (request.InterestableAmount > subtotalAmount) {
            return Results.BadRequest(new { error = "Interestable amount cannot exceed the subtotal amount." });
          }

          var taxAmount = hasCostSheetLines
              ? CalculateServiceCostTaxAmount(subtotalAmount, costSheet!.IsTaxEnabled, costSheet.TaxRate)
              : 0m;
          var totalAmount = Math.Max(subtotalAmount + taxAmount - RoundMoney(request.DiscountAmount), 0m);
          var invoice = new ServiFinance.Domain.Invoice {
            CustomerId = serviceRequest.CustomerId,
            ServiceRequestId = serviceRequest.Id,
            InvoiceNumber = GenerateReferenceCode("INV"),
            InvoiceDateUtc = finalizedAtUtc,
            SubtotalAmount = subtotalAmount,
            TaxAmount = taxAmount,
            InterestableAmount = RoundMoney(request.InterestableAmount),
            DiscountAmount = RoundMoney(request.DiscountAmount),
            TotalAmount = totalAmount,
            OutstandingAmount = totalAmount,
            InvoiceStatus = "Finalized"
          };

          var invoiceLineDescription = string.IsNullOrWhiteSpace(request.Remarks)
          ? $"Service work for {serviceRequest.RequestNumber}"
          : request.Remarks.Trim();

          dbContext.Invoices.Add(invoice);
          if (hasCostSheetLines) {
            foreach (var line in costSheet!.Lines.OrderBy(entity => entity.SortOrder).ThenBy(entity => entity.CreatedAtUtc)) {
              dbContext.InvoiceLines.Add(new ServiFinance.Domain.InvoiceLine {
                InvoiceId = invoice.Id,
                Category = line.Category,
                Name = line.Name,
                Specification = line.Specification,
                Description = BuildInvoiceLineDescription(line.Name, line.Specification),
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                LineTotal = CalculateServiceCostLineTotal(line.Quantity, line.UnitPrice),
                SortOrder = line.SortOrder
              });
            }

            costSheet.Status = "Finalized";
            costSheet.FinalizedAtUtc = finalizedAtUtc;
            costSheet.UpdatedAtUtc = finalizedAtUtc;
          } else {
            dbContext.InvoiceLines.Add(new ServiFinance.Domain.InvoiceLine {
              InvoiceId = invoice.Id,
              Category = "Service",
              Name = invoiceLineDescription,
              Specification = null,
              Description = invoiceLineDescription,
              Quantity = 1m,
              UnitPrice = subtotalAmount,
              LineTotal = subtotalAmount,
              SortOrder = 0
            });
          }

          dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
            ServiceRequestId = serviceRequest.Id,
            Status = serviceRequest.CurrentStatus,
            Remarks = $"Invoice {invoice.InvoiceNumber} finalized for service handoff.",
            ChangedByUserId = currentUserId,
            ChangedAtUtc = finalizedAtUtc
          });

          await dbContext.SaveChangesAsync(cancellationToken);

          var detailResponse = await LoadTenantServiceRequestDetailResponseAsync(
              dbContext,
              serviceRequestId,
              cancellationToken);

          return detailResponse is null
              ? Results.NotFound()
              : Results.Ok(detailResponse);
        })
        .RequireTenantSmsPermission("sms.invoices.finalize", SmsModuleCodeInvoicing);

    return tenantApi;
  }

  private static string? NormalizeOptionalText(string? value) {
    var normalized = value?.Trim();
    return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
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

  private static string? ValidateCostSheetRequest(SaveTenantServiceCostSheetRequest request) {
    var taxLabel = request.TaxLabel.Trim();
    if (string.IsNullOrWhiteSpace(taxLabel)) {
      return "Tax label is required.";
    }
    if (taxLabel.Length > CostTaxLabelMaxLength) {
      return $"Tax label must be {CostTaxLabelMaxLength} characters or fewer.";
    }
    if (request.TaxRate < 0m || request.TaxRate > 100m) {
      return "Tax rate must be between 0 and 100.";
    }
    if ((request.Notes?.Trim().Length ?? 0) > CostSheetNoteMaxLength) {
      return $"Costing notes must be {CostSheetNoteMaxLength} characters or fewer.";
    }

    for (var index = 0; index < request.Lines.Count; index++) {
      var line = request.Lines[index];
      var name = line.Name.Trim();
      if (string.IsNullOrWhiteSpace(name)) {
        return $"Line {index + 1} must include a name.";
      }
      if (name.Length > CostLineNameMaxLength) {
        return $"Line {index + 1} name must be {CostLineNameMaxLength} characters or fewer.";
      }
      if ((line.Specification?.Trim().Length ?? 0) > CostLineSpecificationMaxLength) {
        return $"Line {index + 1} specification must be {CostLineSpecificationMaxLength} characters or fewer.";
      }
      if (line.Quantity <= 0m) {
        return $"Line {index + 1} quantity must be greater than zero.";
      }
      if (line.UnitPrice < 0m) {
        return $"Line {index + 1} unit price cannot be negative.";
      }
    }

    return null;
  }

  private static async Task<TenantServiceRequestDetailResponse?> LoadTenantServiceRequestDetailResponseAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      Guid serviceRequestId,
      CancellationToken cancellationToken) {
    var serviceRequest = await dbContext.ServiceRequests
        .AsNoTracking()
        .Where(entity => entity.Id == serviceRequestId)
        .Select(entity => new {
          entity.Id,
          entity.CustomerId,
          CustomerCode = entity.Customer!.CustomerCode,
          CustomerName = entity.Customer!.FullName,
          entity.RequestNumber,
          entity.ItemType,
          entity.ItemDescription,
          entity.IssueDescription,
          entity.RequestedServiceDate,
          entity.ServiceMode,
          entity.ServiceAddress,
          entity.ServiceAddressDetails,
          entity.ContactName,
          entity.ContactPhone,
          entity.PreferredScheduleStartUtc,
          entity.PreferredScheduleEndUtc,
          entity.NeededByUtc,
          entity.Priority,
          entity.CurrentStatus,
          entity.CreatedAtUtc,
          CreatedByUserName = entity.CreatedByUser != null
              ? entity.CreatedByUser.FullName
              : entity.CreatedByCustomer != null
                  ? entity.CreatedByCustomer.FullName
                  : "Customer portal",
          entity.Rating,
          entity.FeedbackComments,
          entity.FeedbackSuggestionCategory,
          entity.CompletedAtUtc,
          entity.FeedbackSubmittedAtUtc,
          entity.FeedbackExpiresAtUtc,
          entity.CancellationRequestedAtUtc,
          entity.CancelledAtUtc,
          entity.CancellationReason,
          InvoiceId = entity.Invoices
                .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                .Select(invoice => (Guid?)invoice.Id)
                .FirstOrDefault(),
          InvoiceNumber = entity.Invoices
                .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                .Select(invoice => invoice.InvoiceNumber)
                .FirstOrDefault(),
          InvoiceStatus = entity.Invoices
                .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                .Select(invoice => invoice.InvoiceStatus)
                .FirstOrDefault(),
          InvoiceTotalAmount = entity.Invoices
                .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                .Select(invoice => (decimal?)invoice.TotalAmount)
                .FirstOrDefault(),
          InvoiceOutstandingAmount = entity.Invoices
                .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                .Select(invoice => (decimal?)invoice.OutstandingAmount)
                .FirstOrDefault(),
          InterestableAmount = entity.Invoices
                .OrderByDescending(invoice => invoice.InvoiceDateUtc)
                .Select(invoice => (decimal?)invoice.InterestableAmount)
                .FirstOrDefault(),
          HasMicroLoan = entity.Invoices.Any(invoice => invoice.MicroLoan != null)
        })
        .SingleOrDefaultAsync(cancellationToken);
    if (serviceRequest is null) {
      return null;
    }

    var auditTrail = await dbContext.StatusLogs
        .AsNoTracking()
        .Where(entity => entity.ServiceRequestId == serviceRequestId)
        .OrderByDescending(entity => entity.ChangedAtUtc)
        .Select(entity => new TenantServiceRequestAuditRowResponse(
            entity.Id,
            entity.Status,
            entity.Remarks,
            entity.ChangedByUser != null
                ? entity.ChangedByUser.FullName
                : entity.ChangedByCustomer != null
                    ? entity.ChangedByCustomer.FullName
                    : "Customer portal",
            entity.ChangedAtUtc))
        .ToListAsync(cancellationToken);

    var attachments = await dbContext.ServiceRequestAttachments
        .AsNoTracking()
        .Where(entity => entity.ServiceRequestId == serviceRequestId)
        .OrderByDescending(entity => entity.CreatedAtUtc)
        .Select(entity => new TenantServiceRequestAttachmentRowResponse(
            entity.Id,
            entity.OriginalFileName,
            entity.ContentType,
            entity.RelativeUrl,
            entity.SubmittedByCustomer!.FullName,
            entity.CreatedAtUtc))
        .ToListAsync(cancellationToken);

    var costSheet = await dbContext.ServiceCostSheets
        .AsNoTracking()
        .Include(entity => entity.Lines)
        .SingleOrDefaultAsync(entity => entity.ServiceRequestId == serviceRequestId, cancellationToken);

    var policy = await LoadTenantCostingPolicyResponseAsync(dbContext, cancellationToken);
    var presets = await dbContext.ServiceCostPresets
        .AsNoTracking()
        .Where(entity => entity.IsActive)
        .OrderBy(entity => entity.Category)
        .ThenBy(entity => entity.SortOrder)
        .ThenBy(entity => entity.Name)
        .ToListAsync(cancellationToken);

    return new TenantServiceRequestDetailResponse(
        CreateTenantServiceRequestResponse(
            serviceRequest.Id,
            serviceRequest.CustomerId,
            serviceRequest.CustomerCode,
            serviceRequest.CustomerName,
            serviceRequest.RequestNumber,
            serviceRequest.ItemType,
            serviceRequest.ItemDescription,
            serviceRequest.IssueDescription,
            serviceRequest.RequestedServiceDate,
            serviceRequest.ServiceMode,
            serviceRequest.ServiceAddress,
            serviceRequest.ServiceAddressDetails,
            serviceRequest.ContactName,
            serviceRequest.ContactPhone,
            serviceRequest.PreferredScheduleStartUtc,
            serviceRequest.PreferredScheduleEndUtc,
            serviceRequest.NeededByUtc,
            serviceRequest.Priority,
            serviceRequest.CurrentStatus,
            serviceRequest.CreatedAtUtc,
            serviceRequest.CreatedByUserName,
            serviceRequest.Rating,
            serviceRequest.FeedbackComments,
            serviceRequest.FeedbackSuggestionCategory,
            serviceRequest.CompletedAtUtc,
            serviceRequest.FeedbackSubmittedAtUtc,
            serviceRequest.FeedbackExpiresAtUtc,
            serviceRequest.CancellationRequestedAtUtc,
            serviceRequest.CancelledAtUtc,
            serviceRequest.CancellationReason,
            serviceRequest.InvoiceId,
            serviceRequest.InvoiceNumber,
            serviceRequest.InvoiceStatus,
            serviceRequest.InvoiceTotalAmount,
            serviceRequest.InvoiceOutstandingAmount,
            serviceRequest.InterestableAmount,
            serviceRequest.HasMicroLoan),
        auditTrail,
        attachments,
        costSheet is null ? null : CreateServiceCostSheetResponse(costSheet),
        policy,
        presets.Select(CreateServiceCostPresetResponse).ToList());
  }

  private static async Task<TenantCostingPolicyResponse> LoadTenantCostingPolicyResponseAsync(
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var policy = await dbContext.TenantCostingPolicies
        .AsNoTracking()
        .SingleOrDefaultAsync(cancellationToken);
    return policy is null
        ? new TenantCostingPolicyResponse(Guid.Empty, "VAT", 12m, true, DateTime.UtcNow)
        : CreateTenantCostingPolicyResponse(policy);
  }

  private static async Task<ServiFinance.Domain.TenantCostingPolicy> LoadTenantCostingPolicyEntityAsync(
      ClaimsPrincipal user,
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var policy = await dbContext.TenantCostingPolicies
        .SingleOrDefaultAsync(cancellationToken);
    if (policy is not null) {
      return policy;
    }

    var tenantId = Guid.Parse(user.FindFirstValue("tenant_id")!);
    policy = new ServiFinance.Domain.TenantCostingPolicy {
      TenantId = tenantId,
      TaxLabel = "VAT",
      DefaultTaxRate = 12m,
      TaxEnabledByDefault = true,
      CreatedAtUtc = DateTime.UtcNow,
      UpdatedAtUtc = DateTime.UtcNow
    };
    dbContext.TenantCostingPolicies.Add(policy);
    await dbContext.SaveChangesAsync(cancellationToken);
    return policy;
  }
}

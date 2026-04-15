namespace ServiFinance.Api.Endpoints.TenantSms;

using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantSmsServiceRequestsEndpointMappings {
  public static RouteGroupBuilder MapTenantSmsServiceRequestsEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/sms/service-requests", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
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
            entity.Priority,
            entity.CurrentStatus,
            entity.CreatedAtUtc,
            CreatedByUserName = entity.CreatedByUser!.FullName,
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
          entity.Priority,
          entity.CurrentStatus,
          entity.CreatedAtUtc,
          entity.CreatedByUserName,
          entity.InvoiceId,
          entity.InvoiceNumber,
          entity.InvoiceStatus,
          entity.InvoiceTotalAmount,
          entity.InvoiceOutstandingAmount,
          entity.InterestableAmount,
          entity.HasMicroLoan)));
        });
    tenantApi.MapGet("/sms/service-requests/{serviceRequestId:guid}/details", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid serviceRequestId,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

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
            entity.Priority,
            entity.CurrentStatus,
            entity.CreatedAtUtc,
            CreatedByUserName = entity.CreatedByUser!.FullName,
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
            return Results.NotFound();
          }

          var auditTrail = await dbContext.StatusLogs
          .AsNoTracking()
          .Where(entity => entity.ServiceRequestId == serviceRequestId)
          .OrderByDescending(entity => entity.ChangedAtUtc)
          .Select(entity => new TenantServiceRequestAuditRowResponse(
              entity.Id,
              entity.Status,
              entity.Remarks,
              entity.ChangedByUser!.FullName,
              entity.ChangedAtUtc))
          .ToListAsync(cancellationToken);

          return Results.Ok(new TenantServiceRequestDetailResponse(
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
              serviceRequest.Priority,
              serviceRequest.CurrentStatus,
              serviceRequest.CreatedAtUtc,
              serviceRequest.CreatedByUserName,
              serviceRequest.InvoiceId,
              serviceRequest.InvoiceNumber,
              serviceRequest.InvoiceStatus,
              serviceRequest.InvoiceTotalAmount,
              serviceRequest.InvoiceOutstandingAmount,
              serviceRequest.InterestableAmount,
              serviceRequest.HasMicroLoan),
          auditTrail));
        });
    tenantApi.MapPost("/sms/service-requests", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] CreateServiceRequestRecordRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
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

          var serviceRequest = new ServiFinance.Domain.ServiceRequest {
            CustomerId = request.CustomerId,
            RequestNumber = GenerateReferenceCode("SR"),
            ItemType = request.ItemType.Trim(),
            ItemDescription = request.ItemDescription.Trim(),
            IssueDescription = request.IssueDescription.Trim(),
            RequestedServiceDate = request.RequestedServiceDate,
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
          false));
        });
    tenantApi.MapPost("/sms/service-requests/{serviceRequestId:guid}/finalize-invoice", [Authorize(Roles = "Administrator", AuthenticationSchemes = ApiAuthenticationSchemes)] async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid serviceRequestId,
        [FromBody] FinalizeTenantServiceInvoiceRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
            return Results.Unauthorized();
          }

          if (request.SubtotalAmount <= 0m) {
            return Results.BadRequest(new { error = "Subtotal amount must be greater than zero." });
          }

          if (request.InterestableAmount < 0m || request.DiscountAmount < 0m) {
            return Results.BadRequest(new { error = "Interestable amount and discount amount cannot be negative." });
          }

          if (request.InterestableAmount > request.SubtotalAmount) {
            return Results.BadRequest(new { error = "Interestable amount cannot exceed the subtotal amount." });
          }

          var serviceRequest = await dbContext.ServiceRequests
          .Include(entity => entity.Customer)
          .Include(entity => entity.Invoices)
              .ThenInclude(entity => entity.MicroLoan)
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

          var totalAmount = Math.Max(request.SubtotalAmount - request.DiscountAmount, 0m);
          var invoice = new ServiFinance.Domain.Invoice {
            CustomerId = serviceRequest.CustomerId,
            ServiceRequestId = serviceRequest.Id,
            InvoiceNumber = GenerateReferenceCode("INV"),
            InvoiceDateUtc = DateTime.UtcNow,
            SubtotalAmount = request.SubtotalAmount,
            InterestableAmount = request.InterestableAmount,
            DiscountAmount = request.DiscountAmount,
            TotalAmount = totalAmount,
            OutstandingAmount = totalAmount,
            InvoiceStatus = "Finalized"
          };

          var invoiceLineDescription = string.IsNullOrWhiteSpace(request.Remarks)
          ? $"Service work for {serviceRequest.RequestNumber}"
          : request.Remarks.Trim();

          dbContext.Invoices.Add(invoice);
          dbContext.InvoiceLines.Add(new ServiFinance.Domain.InvoiceLine {
            InvoiceId = invoice.Id,
            Description = invoiceLineDescription,
            Quantity = 1m,
            UnitPrice = request.SubtotalAmount,
            LineTotal = request.SubtotalAmount
          });
          dbContext.StatusLogs.Add(new ServiFinance.Domain.StatusLog {
            ServiceRequestId = serviceRequest.Id,
            Status = serviceRequest.CurrentStatus,
            Remarks = $"Invoice {invoice.InvoiceNumber} finalized for service handoff.",
            ChangedByUserId = currentUserId,
            ChangedAtUtc = DateTime.UtcNow
          });

          await dbContext.SaveChangesAsync(cancellationToken);

          var auditTrail = await dbContext.StatusLogs
          .AsNoTracking()
          .Where(entity => entity.ServiceRequestId == serviceRequestId)
          .OrderByDescending(entity => entity.ChangedAtUtc)
          .Select(entity => new TenantServiceRequestAuditRowResponse(
              entity.Id,
              entity.Status,
              entity.Remarks,
              entity.ChangedByUser!.FullName,
              entity.ChangedAtUtc))
          .ToListAsync(cancellationToken);

          return Results.Ok(new TenantServiceRequestDetailResponse(
          CreateTenantServiceRequestResponse(
              serviceRequest.Id,
              serviceRequest.CustomerId,
              serviceRequest.Customer!.CustomerCode,
              serviceRequest.Customer.FullName,
              serviceRequest.RequestNumber,
              serviceRequest.ItemType,
              serviceRequest.ItemDescription,
              serviceRequest.IssueDescription,
              serviceRequest.RequestedServiceDate,
              serviceRequest.Priority,
              serviceRequest.CurrentStatus,
              serviceRequest.CreatedAtUtc,
              await dbContext.Users
                  .Where(entity => entity.Id == serviceRequest.CreatedByUserId)
                  .Select(entity => entity.FullName)
                  .SingleAsync(cancellationToken),
              invoice.Id,
              invoice.InvoiceNumber,
              invoice.InvoiceStatus,
              invoice.TotalAmount,
              invoice.OutstandingAmount,
              invoice.InterestableAmount,
              false),
          auditTrail));
        });

    return tenantApi;
  }
}
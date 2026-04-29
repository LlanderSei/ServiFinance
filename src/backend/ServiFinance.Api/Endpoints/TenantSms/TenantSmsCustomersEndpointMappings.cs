namespace ServiFinance.Api.Endpoints.TenantSms;

using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantSmsCustomersEndpointMappings {
  public static RouteGroupBuilder MapTenantSmsCustomersEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/sms/customers", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var customers = await dbContext.Customers
          .AsNoTracking()
          .OrderBy(entity => entity.FullName)
          .Select(entity => new {
            entity.Id,
            entity.CustomerCode,
            entity.FullName,
            entity.MobileNumber,
            entity.Email,
            entity.Address,
            entity.CreatedAtUtc,
            ServiceRequestCount = entity.ServiceRequests.Count
          })
          .ToListAsync(cancellationToken);

          return Results.Ok(customers);
        });
    tenantApi.MapPost("/sms/customers", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] CreateCustomerRecordRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (string.IsNullOrWhiteSpace(request.FullName)) {
            return Results.BadRequest(new { error = "Customer full name is required." });
          }

          var customer = new ServiFinance.Domain.Customer {
            CustomerCode = GenerateReferenceCode("CUS"),
            FullName = request.FullName.Trim(),
            MobileNumber = request.MobileNumber.Trim(),
            Email = request.Email.Trim(),
            Address = request.Address.Trim(),
            CreatedAtUtc = DateTime.UtcNow
          };

          dbContext.Customers.Add(customer);
          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new {
            customer.Id,
            customer.CustomerCode,
            customer.FullName,
            customer.MobileNumber,
            customer.Email,
            customer.Address,
            customer.CreatedAtUtc,
            ServiceRequestCount = 0
          });
        });
    tenantApi.MapPut("/sms/customers/{customerId:guid}", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid customerId,
        [FromBody] CreateCustomerRecordRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          if (string.IsNullOrWhiteSpace(request.FullName)) {
            return Results.BadRequest(new { error = "Customer full name is required." });
          }

          var customer = await dbContext.Customers
          .Include(entity => entity.ServiceRequests)
          .SingleOrDefaultAsync(entity => entity.Id == customerId, cancellationToken);
          if (customer is null) {
            return Results.NotFound();
          }

          customer.FullName = request.FullName.Trim();
          customer.MobileNumber = request.MobileNumber.Trim();
          customer.Email = request.Email.Trim();
          customer.Address = request.Address.Trim();

          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(new {
            customer.Id,
            customer.CustomerCode,
            customer.FullName,
            customer.MobileNumber,
            customer.Email,
            customer.Address,
            customer.CreatedAtUtc,
            ServiceRequestCount = customer.ServiceRequests.Count
          });
        });

    return tenantApi;
  }
}

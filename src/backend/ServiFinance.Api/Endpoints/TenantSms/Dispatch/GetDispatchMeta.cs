namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class GetDispatchMeta {
    public static void MapGetDispatchMeta(this RouteGroupBuilder tenantApi) {
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
    }
}

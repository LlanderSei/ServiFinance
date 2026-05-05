namespace ServiFinance.Api.Endpoints;

using Microsoft.AspNetCore.Authorization;
using ServiFinance.Api.Services;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class AddressLookupApiEndpointMappings {
  public static RouteGroupBuilder MapAddressLookupApiEndpoints(this RouteGroupBuilder api) {
    api.MapGet("/location/address-search", async Task<IResult> (
        string query,
        int? limit,
        IAddressLookupService addressLookupService,
        CancellationToken cancellationToken) => {
          try {
            var results = await addressLookupService.SearchAsync(query, limit ?? 5, cancellationToken);
            return Results.Ok(results);
          } catch (AddressLookupValidationException ex) {
            return Results.BadRequest(new { error = ex.Message });
          } catch (AddressLookupUnavailableException ex) {
            return CreateJsonError(StatusCodes.Status503ServiceUnavailable, ex.Message);
          }
        })
      .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = ApiAuthenticationSchemes });

    return api;
  }
}

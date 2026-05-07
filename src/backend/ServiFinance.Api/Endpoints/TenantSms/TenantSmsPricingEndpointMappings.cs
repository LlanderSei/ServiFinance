namespace ServiFinance.Api.Endpoints.TenantSms;

using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Domain;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantSmsPricingEndpointMappings {
  private const int TaxLabelMaxLength = 80;
  private const int PresetNameMaxLength = 160;
  private const int PresetSpecificationMaxLength = 300;

  public static RouteGroupBuilder MapTenantSmsPricingEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/sms/pricing", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessError = ValidateTenantPricingAccess(httpContext.User, tenantDomainSlug);
          if (accessError is not null) {
            return accessError;
          }

          var policy = await EnsureTenantCostingPolicyAsync(httpContext.User, dbContext, cancellationToken);
          var presets = await dbContext.ServiceCostPresets
              .AsNoTracking()
              .OrderBy(entity => entity.Category)
              .ThenBy(entity => entity.SortOrder)
              .ThenBy(entity => entity.Name)
              .ToListAsync(cancellationToken);

          return Results.Ok(new TenantPricingWorkspaceResponse(
              CreateTenantCostingPolicyResponse(policy),
              presets.Select(CreateServiceCostPresetResponse).ToList(),
              ServiceCostCategories));
        })
        .RequireTenantSmsPermission("sms.pricing.manage", SmsModuleCodeInvoicing);

    tenantApi.MapPut("/sms/pricing/policy", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] UpdateTenantCostingPolicyRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessError = ValidateTenantPricingAccess(httpContext.User, tenantDomainSlug);
          if (accessError is not null) {
            return accessError;
          }

          var taxLabel = request.TaxLabel.Trim();
          if (string.IsNullOrWhiteSpace(taxLabel)) {
            return Results.BadRequest(new { error = "Tax label is required." });
          }
          if (taxLabel.Length > TaxLabelMaxLength) {
            return Results.BadRequest(new { error = $"Tax label must be {TaxLabelMaxLength} characters or fewer." });
          }
          if (request.DefaultTaxRate < 0m || request.DefaultTaxRate > 100m) {
            return Results.BadRequest(new { error = "Default tax rate must be between 0 and 100." });
          }

          var policy = await EnsureTenantCostingPolicyAsync(httpContext.User, dbContext, cancellationToken);
          policy.TaxLabel = taxLabel;
          policy.DefaultTaxRate = RoundMoney(request.DefaultTaxRate);
          policy.TaxEnabledByDefault = request.TaxEnabledByDefault;
          policy.UpdatedAtUtc = DateTime.UtcNow;
          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(CreateTenantCostingPolicyResponse(policy));
        })
        .RequireTenantSmsPermission("sms.pricing.manage", SmsModuleCodeInvoicing);

    tenantApi.MapPost("/sms/pricing/presets", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        [FromBody] UpsertServiceCostPresetRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessError = ValidateTenantPricingAccess(httpContext.User, tenantDomainSlug);
          if (accessError is not null) {
            return accessError;
          }

          var validationError = ValidatePresetRequest(request);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var tenantId = Guid.Parse(httpContext.User.FindFirstValue("tenant_id")!);
          var preset = new ServiceCostPreset {
            TenantId = tenantId,
            Category = NormalizeServiceCostCategory(request.Category),
            Name = request.Name.Trim(),
            DefaultSpecification = NormalizeOptionalText(request.DefaultSpecification),
            DefaultQuantity = RoundMoney(request.DefaultQuantity),
            DefaultUnitPrice = RoundMoney(request.DefaultUnitPrice),
            IsActive = request.IsActive,
            SortOrder = request.SortOrder,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
          };

          dbContext.ServiceCostPresets.Add(preset);
          await dbContext.SaveChangesAsync(cancellationToken);
          return Results.Ok(CreateServiceCostPresetResponse(preset));
        })
        .RequireTenantSmsPermission("sms.pricing.manage", SmsModuleCodeInvoicing);

    tenantApi.MapPut("/sms/pricing/presets/{presetId:guid}", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid presetId,
        [FromBody] UpsertServiceCostPresetRequest request,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessError = ValidateTenantPricingAccess(httpContext.User, tenantDomainSlug);
          if (accessError is not null) {
            return accessError;
          }

          var validationError = ValidatePresetRequest(request);
          if (validationError is not null) {
            return Results.BadRequest(new { error = validationError });
          }

          var preset = await dbContext.ServiceCostPresets
              .SingleOrDefaultAsync(entity => entity.Id == presetId, cancellationToken);
          if (preset is null) {
            return Results.NotFound();
          }

          preset.Category = NormalizeServiceCostCategory(request.Category);
          preset.Name = request.Name.Trim();
          preset.DefaultSpecification = NormalizeOptionalText(request.DefaultSpecification);
          preset.DefaultQuantity = RoundMoney(request.DefaultQuantity);
          preset.DefaultUnitPrice = RoundMoney(request.DefaultUnitPrice);
          preset.IsActive = request.IsActive;
          preset.SortOrder = request.SortOrder;
          preset.UpdatedAtUtc = DateTime.UtcNow;
          await dbContext.SaveChangesAsync(cancellationToken);

          return Results.Ok(CreateServiceCostPresetResponse(preset));
        })
        .RequireTenantSmsPermission("sms.pricing.manage", SmsModuleCodeInvoicing);

    tenantApi.MapDelete("/sms/pricing/presets/{presetId:guid}", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        Guid presetId,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          var accessError = ValidateTenantPricingAccess(httpContext.User, tenantDomainSlug);
          if (accessError is not null) {
            return accessError;
          }

          var preset = await dbContext.ServiceCostPresets
              .SingleOrDefaultAsync(entity => entity.Id == presetId, cancellationToken);
          if (preset is null) {
            return Results.NotFound();
          }

          dbContext.ServiceCostPresets.Remove(preset);
          await dbContext.SaveChangesAsync(cancellationToken);
          return Results.NoContent();
        })
        .RequireTenantSmsPermission("sms.pricing.manage", SmsModuleCodeInvoicing);

    return tenantApi;
  }

  private static async Task<TenantCostingPolicy> EnsureTenantCostingPolicyAsync(
      ClaimsPrincipal user,
      ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var policy = await dbContext.TenantCostingPolicies
        .SingleOrDefaultAsync(cancellationToken);
    if (policy is not null) {
      return policy;
    }

    var tenantId = Guid.Parse(user.FindFirstValue("tenant_id")!);
    policy = new TenantCostingPolicy {
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

  private static IResult? ValidateTenantPricingAccess(ClaimsPrincipal user, string tenantDomainSlug) {
    if (!IsTenantSmsRouteAllowed(user, tenantDomainSlug)) {
      return Results.Forbid();
    }

    if (!IsTenantAdministrator(user)) {
      return Results.Forbid();
    }

    return null;
  }

  private static string? ValidatePresetRequest(UpsertServiceCostPresetRequest request) {
    var name = request.Name.Trim();
    if (string.IsNullOrWhiteSpace(name)) {
      return "Preset name is required.";
    }
    if (name.Length > PresetNameMaxLength) {
      return $"Preset name must be {PresetNameMaxLength} characters or fewer.";
    }
    if ((request.DefaultSpecification?.Trim().Length ?? 0) > PresetSpecificationMaxLength) {
      return $"Default specification must be {PresetSpecificationMaxLength} characters or fewer.";
    }
    if (request.DefaultQuantity <= 0m) {
      return "Default quantity must be greater than zero.";
    }
    if (request.DefaultUnitPrice < 0m) {
      return "Default unit price cannot be negative.";
    }
    if (request.SortOrder < 0) {
      return "Sort order cannot be negative.";
    }

    return null;
  }

  private static string? NormalizeOptionalText(string? value) {
    var normalized = value?.Trim();
    return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
  }
}

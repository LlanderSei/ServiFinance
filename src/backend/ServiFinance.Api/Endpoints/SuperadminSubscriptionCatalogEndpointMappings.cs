namespace ServiFinance.Api.Endpoints;

using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;

internal static class SuperadminSubscriptionCatalogEndpointMappings {
  private static readonly string[] ActiveAccessLevels = ["Included", "Limited"];
  private static readonly string[] RemovedAccessLevels = ["", "Not Included", "Excluded", "None"];

  public static RouteGroupBuilder MapSuperadminSubscriptionCatalogEndpoints(this RouteGroupBuilder superadminApi) {
    superadminApi.MapGet("/subscriptions/catalog", GetCatalogAsync)
        .RequireRootPermission("root.subscriptions.manage");
    superadminApi.MapPost("/subscriptions/tiers", CreateTierAsync)
        .RequireRootPermission("root.subscriptions.manage");
    superadminApi.MapPut("/subscriptions/tiers/{tierId:guid}", UpdateTierAsync)
        .RequireRootPermission("root.subscriptions.manage");

    return superadminApi;
  }

  private static async Task<IResult> GetCatalogAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) =>
    Results.Ok(await BuildCatalogResponseAsync(dbContext, cancellationToken));

  private static async Task<IResult> CreateTierAsync(
      [FromBody] UpsertSuperadminSubscriptionTierRequest request,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var validationError = ValidateTierRequest(request);
    if (validationError is not null) {
      return Results.BadRequest(new { error = validationError });
    }

    var normalizedCode = NormalizeCode(request.Code);
    if (await dbContext.SubscriptionTiers.AnyAsync(
      entity => entity.Code == normalizedCode,
      cancellationToken)) {
      return Results.BadRequest(new { error = "A subscription tier with that code already exists." });
    }

    var tier = new SubscriptionTier();
    dbContext.SubscriptionTiers.Add(tier);
    ApplyTierFields(tier, request, normalizedCode);
    await ApplyModuleAssignmentsAsync(tier, request.Modules ?? [], dbContext, cancellationToken);
    await dbContext.SaveChangesAsync(cancellationToken);

    return Results.Ok(await BuildTierResponseAsync(dbContext, tier.Id, cancellationToken));
  }

  private static async Task<IResult> UpdateTierAsync(
      Guid tierId,
      [FromBody] UpsertSuperadminSubscriptionTierRequest request,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var validationError = ValidateTierRequest(request);
    if (validationError is not null) {
      return Results.BadRequest(new { error = validationError });
    }

    var tier = await dbContext.SubscriptionTiers
        .Include(entity => entity.Modules)
        .SingleOrDefaultAsync(entity => entity.Id == tierId, cancellationToken);
    if (tier is null) {
      return Results.NotFound(new { error = "The selected subscription tier was not found." });
    }

    var normalizedCode = NormalizeCode(request.Code);
    if (await dbContext.SubscriptionTiers.AnyAsync(
      entity => entity.Id != tierId && entity.Code == normalizedCode,
      cancellationToken)) {
      return Results.BadRequest(new { error = "A subscription tier with that code already exists." });
    }

    ApplyTierFields(tier, request, normalizedCode);
    await ApplyModuleAssignmentsAsync(tier, request.Modules ?? [], dbContext, cancellationToken);
    await dbContext.SaveChangesAsync(cancellationToken);

    return Results.Ok(await BuildTierResponseAsync(dbContext, tier.Id, cancellationToken));
  }

  private static async Task ApplyModuleAssignmentsAsync(
      SubscriptionTier tier,
      IReadOnlyList<SuperadminSubscriptionTierModuleAssignmentRequest> requestModules,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var modulesById = await dbContext.PlatformModules
        .ToDictionaryAsync(entity => entity.Id, cancellationToken);
    var existingAssignments = await dbContext.SubscriptionTierModules
        .Where(entity => entity.SubscriptionTierId == tier.Id)
        .ToDictionaryAsync(entity => entity.PlatformModuleId, cancellationToken);
    var requestedIds = new HashSet<Guid>();

    foreach (var moduleRequest in requestModules) {
      if (!modulesById.ContainsKey(moduleRequest.PlatformModuleId) ||
          !requestedIds.Add(moduleRequest.PlatformModuleId)) {
        continue;
      }

      var accessLevel = NormalizeAccessLevel(moduleRequest.AccessLevel);
      if (RemovedAccessLevels.Contains(accessLevel, StringComparer.OrdinalIgnoreCase)) {
        if (existingAssignments.TryGetValue(moduleRequest.PlatformModuleId, out var existingRemovedAssignment)) {
          dbContext.SubscriptionTierModules.Remove(existingRemovedAssignment);
        }

        continue;
      }

      if (!ActiveAccessLevels.Contains(accessLevel, StringComparer.OrdinalIgnoreCase)) {
        accessLevel = "Limited";
      }

      if (!existingAssignments.TryGetValue(moduleRequest.PlatformModuleId, out var assignment)) {
        assignment = new SubscriptionTierModule {
          SubscriptionTierId = tier.Id,
          PlatformModuleId = moduleRequest.PlatformModuleId
        };
        dbContext.SubscriptionTierModules.Add(assignment);
      }

      assignment.AccessLevel = accessLevel;
      assignment.SortOrder = moduleRequest.SortOrder;
    }

    foreach (var existingAssignment in existingAssignments.Values) {
      if (!requestedIds.Contains(existingAssignment.PlatformModuleId)) {
        dbContext.SubscriptionTierModules.Remove(existingAssignment);
      }
    }
  }

  private static async Task<SuperadminSubscriptionCatalogResponse> BuildCatalogResponseAsync(
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    var tierEntities = await dbContext.SubscriptionTiers
        .AsNoTracking()
        .Include(entity => entity.Modules)
        .ThenInclude(entity => entity.PlatformModule)
        .OrderBy(entity => entity.SortOrder)
        .ThenBy(entity => entity.BusinessSizeSegment)
        .ThenBy(entity => entity.SubscriptionEdition)
        .ThenBy(entity => entity.DisplayName)
        .ToListAsync(cancellationToken);
    var moduleEntities = await dbContext.PlatformModules
        .AsNoTracking()
        .OrderBy(entity => entity.Channel)
        .ThenBy(entity => entity.SortOrder)
        .ThenBy(entity => entity.Name)
        .ToListAsync(cancellationToken);

    return new SuperadminSubscriptionCatalogResponse(
      tierEntities.Select(ToTierResponse).ToArray(),
      moduleEntities.Select(ToModuleResponse).ToArray());
  }

  private static async Task<SuperadminSubscriptionTierResponse> BuildTierResponseAsync(
      ServiFinanceDbContext dbContext,
      Guid tierId,
      CancellationToken cancellationToken) =>
    ToTierResponse(await dbContext.SubscriptionTiers
        .AsNoTracking()
        .Include(entity => entity.Modules)
        .ThenInclude(entity => entity.PlatformModule)
        .Where(entity => entity.Id == tierId)
        .SingleAsync(cancellationToken));

  private static SuperadminSubscriptionTierResponse ToTierResponse(SubscriptionTier tier) =>
    new(
      tier.Id,
      tier.Code,
      tier.DisplayName,
      tier.BusinessSizeSegment,
      tier.SubscriptionEdition,
      tier.AudienceSummary,
      tier.Description,
      tier.MonthlyPriceAmount,
      tier.CurrencyCode,
      FormatPriceDisplay(tier.MonthlyPriceAmount, tier.CurrencyCode),
      tier.BillingLabel,
      tier.PlanSummary,
      tier.HighlightLabel,
      tier.SortOrder,
      tier.IncludesServiceManagementWeb,
      tier.IncludesMicroLendingDesktop,
      tier.IsActive,
      tier.Modules
          .Where(module => module.PlatformModule is not null)
          .OrderBy(module => module.SortOrder)
          .ThenBy(module => module.PlatformModule!.SortOrder)
          .ThenBy(module => module.PlatformModule!.Name)
          .Select(module => new SuperadminSubscriptionTierModuleResponse(
              module.Id,
              module.PlatformModuleId,
              module.PlatformModule!.Code,
              module.PlatformModule.Name,
              module.PlatformModule.Channel,
              module.AccessLevel,
              module.PlatformModule.Summary,
              module.SortOrder,
              module.PlatformModule.IsActive))
          .ToArray());

  private static SuperadminCatalogModuleResponse ToModuleResponse(PlatformModule module) =>
    new(
      module.Id,
      module.Code,
      module.Name,
      module.Channel,
      module.Summary,
      module.SortOrder,
      module.IsActive);

  private static void ApplyTierFields(
      SubscriptionTier tier,
      UpsertSuperadminSubscriptionTierRequest request,
      string normalizedCode) {
    tier.Code = normalizedCode;
    tier.DisplayName = request.DisplayName.Trim();
    tier.BusinessSizeSegment = request.BusinessSizeSegment.Trim();
    tier.SubscriptionEdition = request.SubscriptionEdition.Trim();
    tier.AudienceSummary = request.AudienceSummary.Trim();
    tier.Description = request.Description.Trim();
    tier.MonthlyPriceAmount = request.MonthlyPriceAmount;
    tier.CurrencyCode = NormalizeCurrencyCode(request.CurrencyCode);
    tier.PriceDisplay = FormatPriceDisplay(tier.MonthlyPriceAmount, tier.CurrencyCode);
    tier.BillingLabel = request.BillingLabel.Trim();
    tier.PlanSummary = request.PlanSummary.Trim();
    tier.HighlightLabel = request.HighlightLabel.Trim();
    tier.SortOrder = request.SortOrder;
    tier.IncludesServiceManagementWeb = request.IncludesServiceManagementWeb;
    tier.IncludesMicroLendingDesktop = request.IncludesMicroLendingDesktop;
    tier.IsActive = request.IsActive;
  }

  private static string? ValidateTierRequest(UpsertSuperadminSubscriptionTierRequest request) {
    if (string.IsNullOrWhiteSpace(NormalizeCode(request.Code))) {
      return "Tier code is required.";
    }

    if (string.IsNullOrWhiteSpace(request.DisplayName)) {
      return "Tier display name is required.";
    }

    if (string.IsNullOrWhiteSpace(request.BusinessSizeSegment)) {
      return "Business size segment is required.";
    }

    if (string.IsNullOrWhiteSpace(request.SubscriptionEdition)) {
      return "Subscription edition is required.";
    }

    if (request.MonthlyPriceAmount <= 0m) {
      return "Monthly price amount must be greater than zero.";
    }

    var requestedCurrencyCode = request.CurrencyCode?.Trim() ?? string.Empty;
    if (!string.IsNullOrWhiteSpace(requestedCurrencyCode) &&
        (requestedCurrencyCode.Length != 3 || !requestedCurrencyCode.All(char.IsLetter))) {
      return "Currency code must be a 3-letter ISO code.";
    }

    return null;
  }

  private static string FormatPriceDisplay(decimal amount, string currencyCode) =>
    $"Starts at {NormalizeCurrencyCode(currencyCode)} {amount.ToString("N0", CultureInfo.InvariantCulture)}";

  private static string NormalizeCurrencyCode(string? value) {
    if (string.IsNullOrWhiteSpace(value)) {
      return "PHP";
    }

    return value.Trim().ToUpperInvariant();
  }

  private static string NormalizeCode(string value) {
    var normalizedCharacters = (value ?? string.Empty)
        .Trim()
        .ToUpperInvariant()
        .Select(character => char.IsLetterOrDigit(character) ? character : '_')
        .ToArray();
    var normalizedCode = new string(normalizedCharacters);

    while (normalizedCode.Contains("__", StringComparison.Ordinal)) {
      normalizedCode = normalizedCode.Replace("__", "_", StringComparison.Ordinal);
    }

    return normalizedCode.Trim('_');
  }

  private static string NormalizeAccessLevel(string? value) =>
    string.IsNullOrWhiteSpace(value)
      ? string.Empty
      : value.Trim();
}

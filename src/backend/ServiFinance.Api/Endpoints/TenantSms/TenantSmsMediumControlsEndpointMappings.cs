namespace ServiFinance.Api.Endpoints.TenantSms;

using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Infrastructure.Data;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantSmsMediumControlsEndpointMappings {
  public static RouteGroupBuilder MapTenantSmsMediumControlsEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/sms/sla-escalations", GetSlaEscalationsAsync)
        .RequireTenantSmsPermission("sms.sla-escalations.view", SmsModuleCodeSlaEscalations);

    tenantApi.MapGet("/sms/customer-feedback-crm", GetFeedbackCrmAsync)
        .RequireTenantSmsPermission("sms.feedback-crm.view", SmsModuleCodeFeedbackCrm);

    tenantApi.MapGet("/sms/cost-control", GetCostControlAsync)
        .RequireTenantSmsPermission("sms.cost-control.view", SmsModuleCodePartsCostControl);

    return tenantApi;
  }

  private static async Task<IResult> GetSlaEscalationsAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    var utcNow = DateTime.UtcNow;
    var utcToday = utcNow.Date;
    var utcTomorrow = utcToday.AddDays(1);
    var requests = await dbContext.ServiceRequests
        .AsNoTracking()
        .Select(entity => new SlaRequestProjection(
            entity.Id,
            entity.RequestNumber,
            entity.Customer!.FullName,
            entity.ItemType,
            entity.Priority,
            entity.CurrentStatus,
            entity.RequestedServiceDate,
            entity.PreferredScheduleStartUtc,
            entity.PreferredScheduleEndUtc,
            entity.NeededByUtc,
            entity.CreatedAtUtc))
        .ToListAsync(cancellationToken);

    var requestIds = requests.Select(request => request.Id).ToArray();
    var assignments = await dbContext.Assignments
        .AsNoTracking()
        .Where(entity => requestIds.Contains(entity.ServiceRequestId))
        .Select(entity => new LatestAssignmentProjection(
            entity.ServiceRequestId,
            entity.AssignedUser!.FullName,
            entity.AssignmentStatus,
            entity.ScheduledStartUtc,
            entity.ScheduledEndUtc,
            entity.CreatedAtUtc))
        .ToListAsync(cancellationToken);

    var latestAssignmentsByRequest = assignments
        .GroupBy(assignment => assignment.ServiceRequestId)
        .ToDictionary(
            group => group.Key,
            group => group
                .OrderByDescending(assignment => assignment.ScheduledStartUtc ?? assignment.CreatedAtUtc)
                .First());

    var activeRequests = requests
        .Where(request => !IsClosedServiceStatus(request.CurrentStatus))
        .Select(request => {
          latestAssignmentsByRequest.TryGetValue(request.Id, out var latestAssignment);
          var targetDateUtc = ResolveServiceTargetDate(request);
          var minutesPastDue = targetDateUtc is not null && targetDateUtc < utcNow
              ? (int)Math.Ceiling((utcNow - targetDateUtc.Value).TotalMinutes)
              : 0;
          var dueToday = targetDateUtc is not null && targetDateUtc.Value >= utcToday && targetDateUtc.Value < utcTomorrow;

          return new {
            request.Id,
            request.RequestNumber,
            request.CustomerName,
            request.ItemType,
            request.Priority,
            request.CurrentStatus,
            TargetDateUtc = targetDateUtc,
            LatestAssignmentStatus = latestAssignment?.AssignmentStatus,
            AssignedStaff = latestAssignment?.AssignedStaff,
            ScheduledStartUtc = latestAssignment?.ScheduledStartUtc,
            ScheduledEndUtc = latestAssignment?.ScheduledEndUtc,
            MinutesPastDue = minutesPastDue,
            Severity = ResolveSlaSeverity(request.Priority, targetDateUtc, minutesPastDue, dueToday, latestAssignment is null)
          };
        })
        .OrderByDescending(row => row.MinutesPastDue)
        .ThenBy(row => row.TargetDateUtc ?? DateTime.MaxValue)
        .ThenBy(row => row.RequestNumber)
        .ToArray();

    return Results.Ok(new {
      Summary = new {
        ActiveRequests = activeRequests.Length,
        OverdueRequests = activeRequests.Count(row => row.MinutesPastDue > 0),
        DueTodayRequests = activeRequests.Count(row => row.TargetDateUtc is not null && row.TargetDateUtc.Value >= utcToday && row.TargetDateUtc.Value < utcTomorrow),
        UnscheduledRequests = activeRequests.Count(row => string.IsNullOrWhiteSpace(row.LatestAssignmentStatus)),
        CriticalRequests = activeRequests.Count(row => row.Severity == "Critical")
      },
      Rows = activeRequests
    });
  }

  private static async Task<IResult> GetFeedbackCrmAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    var utcNow = DateTime.UtcNow;
    var feedbackRows = await dbContext.ServiceRequests
        .AsNoTracking()
        .Where(entity => entity.CompletedAtUtc != null ||
            entity.Rating != null ||
            entity.FeedbackComments != null ||
            entity.FeedbackSuggestionCategory != null)
        .Select(entity => new FeedbackRequestProjection(
            entity.Id,
            entity.RequestNumber,
            entity.Customer!.FullName,
            entity.ItemType,
            entity.CurrentStatus,
            entity.Rating,
            entity.FeedbackComments,
            entity.FeedbackSuggestionCategory,
            entity.CompletedAtUtc,
            entity.FeedbackSubmittedAtUtc,
            entity.FeedbackExpiresAtUtc))
        .ToListAsync(cancellationToken);

    var ratedRows = feedbackRows.Where(row => row.Rating is not null).ToArray();
    var pendingRows = feedbackRows
        .Where(row => row.Rating is null && row.CompletedAtUtc is not null && row.FeedbackExpiresAtUtc is not null && row.FeedbackExpiresAtUtc >= utcNow)
        .ToArray();
    var expiredRows = feedbackRows
        .Where(row => row.Rating is null && row.CompletedAtUtc is not null && row.FeedbackExpiresAtUtc is not null && row.FeedbackExpiresAtUtc < utcNow)
        .ToArray();

    var rows = feedbackRows
        .Select(row => new {
          row.Id,
          row.RequestNumber,
          row.CustomerName,
          row.ItemType,
          row.CurrentStatus,
          row.Rating,
          row.FeedbackComments,
          SuggestionCategory = row.FeedbackSuggestionCategory,
          row.CompletedAtUtc,
          row.FeedbackSubmittedAtUtc,
          row.FeedbackExpiresAtUtc,
          FeedbackState = ResolveFeedbackState(row, utcNow)
        })
        .OrderBy(row => row.Rating is null ? 1 : 0)
        .ThenBy(row => row.Rating ?? 6)
        .ThenByDescending(row => row.FeedbackSubmittedAtUtc ?? row.CompletedAtUtc ?? DateTime.MinValue)
        .Take(60)
        .ToArray();

    return Results.Ok(new {
      Summary = new {
        AverageRating = ratedRows.Length == 0 ? (double?)null : Math.Round(ratedRows.Average(row => row.Rating!.Value), 2),
        RatedRequests = ratedRows.Length,
        PendingFeedback = pendingRows.Length,
        ExpiredFeedback = expiredRows.Length,
        LowRatingCount = ratedRows.Count(row => row.Rating <= 2),
        SuggestionsCount = feedbackRows.Count(row => !string.IsNullOrWhiteSpace(row.FeedbackSuggestionCategory))
      },
      SuggestionThemes = feedbackRows
          .Where(row => !string.IsNullOrWhiteSpace(row.FeedbackSuggestionCategory))
          .GroupBy(row => row.FeedbackSuggestionCategory!)
          .Select(group => new {
            Category = group.Key,
            Count = group.Count(),
            AverageRating = Math.Round(group
                .Where(row => row.Rating is not null)
                .Select(row => row.Rating!.Value)
                .DefaultIfEmpty(0)
                .Average(), 2)
          })
          .OrderByDescending(row => row.Count)
          .ThenBy(row => row.Category)
          .ToArray(),
      Rows = rows
    });
  }

  private static async Task<IResult> GetCostControlAsync(
      HttpContext httpContext,
      string tenantDomainSlug,
      ServiFinanceDbContext dbContext,
      CancellationToken cancellationToken) {
    if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
      return Results.Forbid();
    }

    var policy = await dbContext.TenantCostingPolicies
        .AsNoTracking()
        .Select(entity => new {
          entity.TaxLabel,
          entity.DefaultTaxRate,
          entity.TaxEnabledByDefault
        })
        .FirstOrDefaultAsync(cancellationToken);

    var presets = await dbContext.ServiceCostPresets
        .AsNoTracking()
        .OrderBy(entity => entity.SortOrder)
        .ThenBy(entity => entity.Category)
        .ThenBy(entity => entity.Name)
        .Select(entity => new {
          entity.Id,
          entity.Category,
          entity.Name,
          entity.DefaultSpecification,
          entity.DefaultQuantity,
          entity.DefaultUnitPrice,
          entity.IsActive,
          entity.SortOrder
        })
        .ToListAsync(cancellationToken);

    var serviceRequests = await dbContext.ServiceRequests
        .AsNoTracking()
        .Select(entity => new CostRequestProjection(
            entity.Id,
            entity.RequestNumber,
            entity.Customer!.FullName,
            entity.ItemType,
            entity.CurrentStatus,
            entity.CompletedAtUtc,
            entity.CreatedAtUtc))
        .ToListAsync(cancellationToken);

    var requestIds = serviceRequests.Select(request => request.Id).ToArray();
    var costSheets = await dbContext.ServiceCostSheets
        .AsNoTracking()
        .Where(entity => requestIds.Contains(entity.ServiceRequestId))
        .Select(entity => new CostSheetProjection(
            entity.Id,
            entity.ServiceRequestId,
            entity.Status,
            entity.IsTaxEnabled,
            entity.TaxLabel,
            entity.TaxRate,
            entity.UpdatedAtUtc,
            entity.FinalizedAtUtc))
        .ToListAsync(cancellationToken);

    var costSheetIds = costSheets.Select(sheet => sheet.Id).ToArray();
    var costLines = await dbContext.ServiceCostLines
        .AsNoTracking()
        .Where(entity => costSheetIds.Contains(entity.ServiceCostSheetId))
        .Select(entity => new CostLineProjection(
            entity.ServiceCostSheetId,
            entity.Category,
            entity.Name,
            entity.Specification,
            entity.Quantity,
            entity.UnitPrice))
        .ToListAsync(cancellationToken);

    var invoices = await dbContext.Invoices
        .AsNoTracking()
        .Where(entity => entity.ServiceRequestId != null)
        .Select(entity => new InvoiceProjection(
            entity.ServiceRequestId!.Value,
            entity.InvoiceNumber,
            entity.TotalAmount,
            entity.OutstandingAmount,
            entity.InvoiceStatus,
            entity.InvoiceDateUtc))
        .ToListAsync(cancellationToken);

    var linesByCostSheet = costLines
        .GroupBy(line => line.ServiceCostSheetId)
        .ToDictionary(group => group.Key, group => group.ToArray());
    var sheetsByRequest = costSheets.ToDictionary(sheet => sheet.ServiceRequestId);
    var latestInvoiceByRequest = invoices
        .GroupBy(invoice => invoice.ServiceRequestId)
        .ToDictionary(
            group => group.Key,
            group => group.OrderByDescending(invoice => invoice.InvoiceDateUtc).First());

    var rowModels = serviceRequests
        .Select(request => {
          sheetsByRequest.TryGetValue(request.Id, out var sheet);
          latestInvoiceByRequest.TryGetValue(request.Id, out var invoice);
          var sheetLines = sheet is null || !linesByCostSheet.TryGetValue(sheet.Id, out var lines)
              ? []
              : lines;
          var subtotal = sheetLines.Sum(CalculateLineTotal);
          var taxAmount = sheet is not null && sheet.IsTaxEnabled
              ? Math.Round(subtotal * sheet.TaxRate / 100m, 2)
              : 0m;

          return new {
            request.Id,
            request.RequestNumber,
            request.CustomerName,
            request.ItemType,
            request.CurrentStatus,
            request.CompletedAtUtc,
            CostSheetStatus = sheet?.Status,
            CostSubtotal = subtotal,
            CostTaxAmount = taxAmount,
            CostTotal = subtotal + taxAmount,
            CostLineCount = sheetLines.Length,
            UpdatedAtUtc = sheet?.UpdatedAtUtc ?? request.CreatedAtUtc,
            InvoiceNumber = invoice?.InvoiceNumber,
            InvoiceStatus = invoice?.InvoiceStatus,
            InvoiceTotalAmount = invoice?.TotalAmount,
            InvoiceOutstandingAmount = invoice?.OutstandingAmount,
            NeedsCosting = IsCompletedServiceStatus(request.CurrentStatus) && sheet is null,
            NeedsInvoice = IsCompletedServiceStatus(request.CurrentStatus) && invoice is null
          };
        })
        .Where(row => row.CostSheetStatus is not null || row.NeedsCosting || row.NeedsInvoice || row.InvoiceNumber is not null)
        .OrderByDescending(row => row.NeedsCosting)
        .ThenByDescending(row => row.NeedsInvoice)
        .ThenByDescending(row => row.UpdatedAtUtc)
        .Take(80)
        .ToArray();

    var allCostLines = costLines.ToArray();

    return Results.Ok(new {
      Policy = policy ?? new {
        TaxLabel = "VAT",
        DefaultTaxRate = 12m,
        TaxEnabledByDefault = true
      },
      Summary = new {
        ActivePresetCount = presets.Count(preset => preset.IsActive),
        DraftCostSheets = costSheets.Count(sheet => string.Equals(sheet.Status, "Draft", StringComparison.OrdinalIgnoreCase)),
        FinalizedCostSheets = costSheets.Count(sheet => string.Equals(sheet.Status, "Finalized", StringComparison.OrdinalIgnoreCase)),
        NeedsCosting = rowModels.Count(row => row.NeedsCosting),
        NeedsInvoice = rowModels.Count(row => row.NeedsInvoice),
        EstimatedCostTotal = rowModels.Sum(row => row.CostTotal)
      },
      PresetCategories = presets
          .GroupBy(preset => preset.Category)
          .Select(group => new {
            Category = group.Key,
            ActivePresets = group.Count(preset => preset.IsActive),
            PresetCount = group.Count()
          })
          .OrderBy(row => row.Category)
          .ToArray(),
      CategoryTotals = allCostLines
          .GroupBy(line => line.Category)
          .Select(group => new {
            Category = group.Key,
            LineCount = group.Count(),
            TotalAmount = group.Sum(CalculateLineTotal)
          })
          .OrderByDescending(row => row.TotalAmount)
          .ThenBy(row => row.Category)
          .ToArray(),
      Rows = rowModels
    });
  }

  private static DateTime? ResolveServiceTargetDate(SlaRequestProjection request) =>
    request.NeededByUtc ?? request.RequestedServiceDate ?? request.PreferredScheduleEndUtc ?? request.PreferredScheduleStartUtc;

  private static string ResolveSlaSeverity(
      string priority,
      DateTime? targetDateUtc,
      int minutesPastDue,
      bool dueToday,
      bool isUnscheduled) {
    if (minutesPastDue >= 1440 ||
        string.Equals(priority, "Urgent", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(priority, "Critical", StringComparison.OrdinalIgnoreCase)) {
      return "Critical";
    }

    if (minutesPastDue > 0) {
      return "Overdue";
    }

    if (dueToday) {
      return "Due Today";
    }

    if (isUnscheduled || targetDateUtc is null) {
      return "Watch";
    }

    return "Planned";
  }

  private static bool IsClosedServiceStatus(string status) =>
    string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(status, "Cancelled", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(status, "Closed", StringComparison.OrdinalIgnoreCase);

  private static bool IsCompletedServiceStatus(string status) =>
    string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(status, "Ready for Billing", StringComparison.OrdinalIgnoreCase);

  private static string ResolveFeedbackState(FeedbackRequestProjection row, DateTime utcNow) {
    if (row.Rating is not null) {
      return "Submitted";
    }

    if (row.CompletedAtUtc is null) {
      return "Not completed";
    }

    if (row.FeedbackExpiresAtUtc is not null && row.FeedbackExpiresAtUtc < utcNow) {
      return "Expired";
    }

    return "Pending";
  }

  private static decimal CalculateLineTotal(CostLineProjection line) =>
    Math.Round(line.Quantity * line.UnitPrice, 2);

  private sealed record SlaRequestProjection(
      Guid Id,
      string RequestNumber,
      string CustomerName,
      string ItemType,
      string Priority,
      string CurrentStatus,
      DateTime? RequestedServiceDate,
      DateTime? PreferredScheduleStartUtc,
      DateTime? PreferredScheduleEndUtc,
      DateTime? NeededByUtc,
      DateTime CreatedAtUtc);

  private sealed record LatestAssignmentProjection(
      Guid ServiceRequestId,
      string AssignedStaff,
      string AssignmentStatus,
      DateTime? ScheduledStartUtc,
      DateTime? ScheduledEndUtc,
      DateTime CreatedAtUtc);

  private sealed record FeedbackRequestProjection(
      Guid Id,
      string RequestNumber,
      string CustomerName,
      string ItemType,
      string CurrentStatus,
      int? Rating,
      string? FeedbackComments,
      string? FeedbackSuggestionCategory,
      DateTime? CompletedAtUtc,
      DateTime? FeedbackSubmittedAtUtc,
      DateTime? FeedbackExpiresAtUtc);

  private sealed record CostRequestProjection(
      Guid Id,
      string RequestNumber,
      string CustomerName,
      string ItemType,
      string CurrentStatus,
      DateTime? CompletedAtUtc,
      DateTime CreatedAtUtc);

  private sealed record CostSheetProjection(
      Guid Id,
      Guid ServiceRequestId,
      string Status,
      bool IsTaxEnabled,
      string TaxLabel,
      decimal TaxRate,
      DateTime UpdatedAtUtc,
      DateTime? FinalizedAtUtc);

  private sealed record CostLineProjection(
      Guid ServiceCostSheetId,
      string Category,
      string Name,
      string? Specification,
      decimal Quantity,
      decimal UnitPrice);

  private sealed record InvoiceProjection(
      Guid ServiceRequestId,
      string InvoiceNumber,
      decimal TotalAmount,
      decimal OutstandingAmount,
      string InvoiceStatus,
      DateTime InvoiceDateUtc);
}

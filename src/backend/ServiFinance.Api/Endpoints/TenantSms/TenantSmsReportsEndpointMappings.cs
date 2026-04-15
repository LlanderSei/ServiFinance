namespace ServiFinance.Api.Endpoints.TenantSms;

using Microsoft.EntityFrameworkCore;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class TenantSmsReportsEndpointMappings {
  public static RouteGroupBuilder MapTenantSmsReportsEndpoints(this RouteGroupBuilder tenantApi) {
    tenantApi.MapGet("/sms/reports/overview", async Task<IResult> (
        HttpContext httpContext,
        string tenantDomainSlug,
        DateTime? dateFrom,
        DateTime? dateTo,
        ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
        CancellationToken cancellationToken) => {
          if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
            return Results.Forbid();
          }

          var utcToday = DateTime.UtcNow.Date;
          var utcTomorrow = utcToday.AddDays(1);
          var reportEndExclusive = (dateTo?.Date ?? utcToday).AddDays(1);
          var reportStartInclusive = dateFrom?.Date ?? reportEndExclusive.AddDays(-7);
          if (reportEndExclusive <= reportStartInclusive) {
            return Results.BadRequest(new { error = "Report end date must be on or after the start date." });
          }

          var reportDayCount = (int)(reportEndExclusive - reportStartInclusive).TotalDays;
          var previousReportEndExclusive = reportStartInclusive;
          var previousReportStartInclusive = previousReportEndExclusive.AddDays(-reportDayCount);

          var customerCount = await dbContext.Customers.CountAsync(cancellationToken);
          var serviceRequestCount = await dbContext.ServiceRequests.CountAsync(cancellationToken);
          var activeAssignmentCount = await dbContext.Assignments.CountAsync(
              entity => entity.AssignmentStatus == "Scheduled" || entity.AssignmentStatus == "In Progress" || entity.AssignmentStatus == "On Hold",
              cancellationToken);
          var completedAssignmentCount = await dbContext.Assignments.CountAsync(
              entity => entity.AssignmentStatus == "Completed",
              cancellationToken);

          var dailyActivity = new {
            NewCustomersToday = await dbContext.Customers.CountAsync(
                entity => entity.CreatedAtUtc >= utcToday && entity.CreatedAtUtc < utcTomorrow,
                cancellationToken),
            NewRequestsToday = await dbContext.ServiceRequests.CountAsync(
                entity => entity.CreatedAtUtc >= utcToday && entity.CreatedAtUtc < utcTomorrow,
                cancellationToken),
            AssignmentsScheduledToday = await dbContext.Assignments.CountAsync(
                entity => entity.CreatedAtUtc >= utcToday && entity.CreatedAtUtc < utcTomorrow,
                cancellationToken),
            AssignmentsCompletedToday = await dbContext.AssignmentEvents.CountAsync(
                entity => entity.AssignmentStatus == "Completed" &&
                    entity.CreatedAtUtc >= utcToday &&
                    entity.CreatedAtUtc < utcTomorrow,
                cancellationToken)
          };

          var serviceStatusDistribution = await dbContext.ServiceRequests
              .AsNoTracking()
              .GroupBy(entity => entity.CurrentStatus)
              .Select(group => new {
                Status = group.Key,
                Count = group.Count()
              })
              .OrderByDescending(item => item.Count)
              .ThenBy(item => item.Status)
              .ToListAsync(cancellationToken);

          var technicianWorkload = await dbContext.Assignments
              .AsNoTracking()
              .GroupBy(entity => new {
                entity.AssignedUserId,
                FullName = entity.AssignedUser!.FullName
              })
              .Select(group => new {
                UserId = group.Key.AssignedUserId,
                group.Key.FullName,
                ActiveAssignments = group.Count(entity => entity.AssignmentStatus == "In Progress"),
                ScheduledAssignments = group.Count(entity => entity.AssignmentStatus == "Scheduled"),
                CompletedAssignments = group.Count(entity => entity.AssignmentStatus == "Completed")
              })
              .OrderByDescending(item => item.ActiveAssignments)
              .ThenByDescending(item => item.ScheduledAssignments)
              .ThenBy(item => item.FullName)
              .ToListAsync(cancellationToken);

          var customers = await dbContext.Customers
              .AsNoTracking()
              .Select(entity => new CustomerCreatedAt(entity.CreatedAtUtc))
              .ToListAsync(cancellationToken);

          var serviceRequests = await dbContext.ServiceRequests
              .AsNoTracking()
              .Select(entity => new ReportServiceRequest(
                  entity.Id,
                  entity.CreatedAtUtc,
                  entity.RequestedServiceDate,
                  entity.CurrentStatus))
              .ToListAsync(cancellationToken);

          var assignments = await dbContext.Assignments
              .AsNoTracking()
              .Select(entity => new ReportAssignment(
                  entity.ServiceRequestId,
                  entity.CreatedAtUtc,
                  entity.ScheduledStartUtc,
                  entity.ScheduledEndUtc,
                  entity.AssignmentStatus))
              .ToListAsync(cancellationToken);

          var completedRequestLogs = await dbContext.StatusLogs
              .AsNoTracking()
              .Where(entity => entity.Status == "Completed")
              .GroupBy(entity => entity.ServiceRequestId)
              .Select(group => new CompletedRequestLog(
                  group.Key,
                  group.Min(entity => entity.ChangedAtUtc)))
              .ToListAsync(cancellationToken);

          var invoices = await dbContext.Invoices
              .AsNoTracking()
              .Where(entity => entity.ServiceRequestId != null)
              .Select(entity => new ServiceInvoice(entity.InvoiceDateUtc))
              .ToListAsync(cancellationToken);

          var firstScheduledLookup = assignments
              .Where(entity => entity.ScheduledStartUtc.HasValue)
              .GroupBy(entity => entity.ServiceRequestId)
              .ToDictionary(
                  group => group.Key,
                  group => group.Min(entity => entity.ScheduledStartUtc!.Value));
          var completionLookup = completedRequestLogs.ToDictionary(entity => entity.ServiceRequestId, entity => entity.CompletedAtUtc);

          var currentWindowActivity = CreateWindowActivity(
              reportStartInclusive,
              reportEndExclusive,
              customers,
              serviceRequests,
              assignments,
              completedRequestLogs,
              invoices);
          var previousWindowActivity = CreateWindowActivity(
              previousReportStartInclusive,
              previousReportEndExclusive,
              customers,
              serviceRequests,
              assignments,
              completedRequestLogs,
              invoices);

          var comparison = new[] {
            CreateComparisonMetric("new-customers", "New customers", currentWindowActivity.NewCustomers, previousWindowActivity.NewCustomers),
            CreateComparisonMetric("new-requests", "New service requests", currentWindowActivity.NewRequests, previousWindowActivity.NewRequests),
            CreateComparisonMetric("assignments-scheduled", "Assignments scheduled", currentWindowActivity.AssignmentsScheduled, previousWindowActivity.AssignmentsScheduled),
            CreateComparisonMetric("assignments-completed", "Assignments completed", currentWindowActivity.AssignmentsCompleted, previousWindowActivity.AssignmentsCompleted),
            CreateComparisonMetric("completed-requests", "Completed requests", currentWindowActivity.CompletedRequests, previousWindowActivity.CompletedRequests),
            CreateComparisonMetric("invoices-finalized", "Invoices finalized", currentWindowActivity.InvoicesFinalized, previousWindowActivity.InvoicesFinalized)
          };

          var completedRequestsInWindow = serviceRequests
              .Where(entity => completionLookup.TryGetValue(entity.Id, out var completedAtUtc) &&
                  completedAtUtc >= reportStartInclusive &&
                  completedAtUtc < reportEndExclusive)
              .Select(entity => new CompletedRequestTurnaround(
                  entity.CreatedAtUtc,
                  completionLookup[entity.Id],
                  firstScheduledLookup.TryGetValue(entity.Id, out var scheduledStartUtc)
                    ? scheduledStartUtc
                    : (DateTime?)null))
              .ToList();

          var turnaround = new {
            CompletedRequests = completedRequestsInWindow.Count,
            AverageIntakeToCompletionHours = CalculateAverageHours(
                completedRequestsInWindow,
                entity => entity.CreatedAtUtc,
                entity => entity.CompletedAtUtc),
            AverageRequestToScheduleHours = CalculateAverageHours(
                completedRequestsInWindow.Where(entity => entity.FirstScheduledStartUtc.HasValue),
                entity => entity.CreatedAtUtc,
                entity => entity.FirstScheduledStartUtc),
            AverageScheduledWorkHours = CalculateAverageHours(
                assignments.Where(entity =>
                    entity.AssignmentStatus == "Completed" &&
                    entity.ScheduledStartUtc.HasValue &&
                    entity.ScheduledEndUtc.HasValue &&
                    entity.ScheduledEndUtc.Value >= reportStartInclusive &&
                    entity.ScheduledEndUtc.Value < reportEndExclusive),
                entity => entity.ScheduledStartUtc,
                entity => entity.ScheduledEndUtc),
            OverdueOpenRequests = serviceRequests.Count(entity =>
                entity.CurrentStatus != "Completed" &&
                entity.RequestedServiceDate.HasValue &&
                entity.RequestedServiceDate.Value.Date < utcToday)
          };

          var catalog = new[] {
            new {
              Key = "daily-activity",
              Title = "Daily Activity Summary",
              Scope = "Customers, intake, and dispatch",
              Freshness = "Live",
              Owner = "Tenant operations",
              Description = "Tracks what entered the tenant workflow today across customer intake, service requests, and dispatch."
            },
            new {
              Key = "service-status-distribution",
              Title = "Service Status Distribution",
              Scope = "Service request register",
              Freshness = "Live",
              Owner = "Service management",
              Description = "Shows how work is distributed across queued, scheduled, in-service, and completed states."
            },
            new {
              Key = "technician-workload",
              Title = "Technician Workload",
              Scope = "Assignment register",
              Freshness = "Live",
              Owner = "Dispatch",
              Description = "Summarizes active, scheduled, and completed assignments per assigned staff member."
            },
            new {
              Key = "window-comparison",
              Title = "Window Comparison",
              Scope = "Selected period versus previous period",
              Freshness = "Live",
              Owner = "Business owner",
              Description = "Compares the selected operating window against the immediately preceding period of equal length."
            },
            new {
              Key = "turnaround-metrics",
              Title = "Turnaround Metrics",
              Scope = "Intake-to-completion and scheduling efficiency",
              Freshness = "Live",
              Owner = "Service operations",
              Description = "Measures completion pace, scheduling lead time, work duration, and overdue open requests."
            }
          };

          return Results.Ok(new {
            Catalog = catalog,
            DailyActivity = dailyActivity,
            ServiceStatusDistribution = serviceStatusDistribution,
            TechnicianWorkload = technicianWorkload,
            ReportingWindow = new {
              DateFromUtc = reportStartInclusive,
              DateToUtc = reportEndExclusive.AddDays(-1),
              PreviousDateFromUtc = previousReportStartInclusive,
              PreviousDateToUtc = previousReportEndExclusive.AddDays(-1),
              DayCount = reportDayCount
            },
            WindowedActivity = currentWindowActivity,
            Comparison = comparison,
            Turnaround = turnaround,
            Totals = new {
              Customers = customerCount,
              ServiceRequests = serviceRequestCount,
              ActiveAssignments = activeAssignmentCount,
              CompletedAssignments = completedAssignmentCount
            }
          });
        });

    return tenantApi;
  }

  private static WindowActivity CreateWindowActivity(
      DateTime startInclusive,
      DateTime endExclusive,
      IReadOnlyCollection<CustomerCreatedAt> customers,
      IReadOnlyCollection<ReportServiceRequest> serviceRequests,
      IReadOnlyCollection<ReportAssignment> assignments,
      IReadOnlyCollection<CompletedRequestLog> completedRequestLogs,
      IReadOnlyCollection<ServiceInvoice> invoices) {
    return new WindowActivity(
        customers.Count(entity => entity.CreatedAtUtc >= startInclusive && entity.CreatedAtUtc < endExclusive),
        serviceRequests.Count(entity => entity.CreatedAtUtc >= startInclusive && entity.CreatedAtUtc < endExclusive),
        assignments.Count(entity => entity.CreatedAtUtc >= startInclusive && entity.CreatedAtUtc < endExclusive),
        assignments.Count(entity =>
            entity.AssignmentStatus == "Completed" &&
            entity.ScheduledEndUtc.HasValue &&
            entity.ScheduledEndUtc.Value >= startInclusive &&
            entity.ScheduledEndUtc.Value < endExclusive),
        completedRequestLogs.Count(entity => entity.CompletedAtUtc >= startInclusive && entity.CompletedAtUtc < endExclusive),
        invoices.Count(entity => entity.InvoiceDateUtc >= startInclusive && entity.InvoiceDateUtc < endExclusive));
  }

  private static object CreateComparisonMetric(string key, string label, int currentValue, int previousValue) {
    var deltaValue = currentValue - previousValue;
    double? deltaPercentage = previousValue == 0
        ? currentValue == 0 ? 0d : null
        : Math.Round((double)deltaValue / previousValue * 100d, 1);

    return new {
      Key = key,
      Label = label,
      CurrentValue = currentValue,
      PreviousValue = previousValue,
      DeltaValue = deltaValue,
      DeltaPercentage = deltaPercentage
    };
  }

  private static double? CalculateAverageHours<T>(
      IEnumerable<T> source,
      Func<T, DateTime?> startSelector,
      Func<T, DateTime?> endSelector) {
    var durations = source
        .Select(entity => new {
          Start = startSelector(entity),
          End = endSelector(entity)
        })
        .Where(entity => entity.Start.HasValue && entity.End.HasValue && entity.End.Value >= entity.Start.Value)
        .Select(entity => (entity.End!.Value - entity.Start!.Value).TotalHours)
        .ToList();

    return durations.Count == 0 ? null : Math.Round(durations.Average(), 1);
  }

  private sealed record CustomerCreatedAt(DateTime CreatedAtUtc);

  private sealed record ReportServiceRequest(
      Guid Id,
      DateTime CreatedAtUtc,
      DateTime? RequestedServiceDate,
      string CurrentStatus);

  private sealed record ReportAssignment(
      Guid ServiceRequestId,
      DateTime CreatedAtUtc,
      DateTime? ScheduledStartUtc,
      DateTime? ScheduledEndUtc,
      string AssignmentStatus);

  private sealed record CompletedRequestLog(Guid ServiceRequestId, DateTime CompletedAtUtc);

  private sealed record ServiceInvoice(DateTime InvoiceDateUtc);

  private sealed record CompletedRequestTurnaround(
      DateTime CreatedAtUtc,
      DateTime CompletedAtUtc,
      DateTime? FirstScheduledStartUtc);

  private sealed record WindowActivity(
      int NewCustomers,
      int NewRequests,
      int AssignmentsScheduled,
      int AssignmentsCompleted,
      int CompletedRequests,
      int InvoicesFinalized);
}

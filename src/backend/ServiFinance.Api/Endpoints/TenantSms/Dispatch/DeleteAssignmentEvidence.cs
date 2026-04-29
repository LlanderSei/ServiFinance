namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class DeleteAssignmentEvidence {
    public static void MapDeleteAssignmentEvidence(this RouteGroupBuilder tenantApi) {
        tenantApi.MapDelete("/sms/dispatch/{assignmentId:guid}/evidence/{evidenceId:guid}", async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            Guid evidenceId,
            IWebHostEnvironment environment,
            ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
            CancellationToken cancellationToken) => {
              if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
                return Results.Forbid();
              }

              if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
                return Results.Unauthorized();
              }

              var evidence = await dbContext.AssignmentEvidenceItems
              .Include(entity => entity.Assignment)
              .SingleOrDefaultAsync(entity => entity.Id == evidenceId && entity.AssignmentId == assignmentId, cancellationToken);
              if (evidence is null) {
                return Results.NotFound();
              }

              var isAdmin = IsTenantAdministrator(httpContext.User);
              if (!isAdmin && evidence.SubmittedByUserId != currentUserId) {
                return Results.Forbid();
              }

              if (!string.IsNullOrWhiteSpace(evidence.StoredFileName)) {
                var webRootPath = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
                var filePath = Path.Combine(
                  webRootPath,
                  "uploads",
                  "assignment-evidence",
                  tenantDomainSlug,
                  assignmentId.ToString("N"),
                  evidence.StoredFileName);
                if (File.Exists(filePath)) {
                  File.Delete(filePath);
                }
              }

              dbContext.AssignmentEvents.Add(new ServiFinance.Domain.AssignmentEvent {
                AssignmentId = assignmentId,
                EventType = "EvidenceRemoved",
                PreviousAssignedUserId = evidence.Assignment!.AssignedUserId,
                AssignedUserId = evidence.Assignment.AssignedUserId,
                PreviousScheduledStartUtc = evidence.Assignment.ScheduledStartUtc,
                PreviousScheduledEndUtc = evidence.Assignment.ScheduledEndUtc,
                ScheduledStartUtc = evidence.Assignment.ScheduledStartUtc,
                ScheduledEndUtc = evidence.Assignment.ScheduledEndUtc,
                AssignmentStatus = evidence.Assignment.AssignmentStatus,
                Remarks = string.IsNullOrWhiteSpace(evidence.OriginalFileName)
                  ? "Technician evidence note removed."
                  : $"Technician evidence '{evidence.OriginalFileName}' removed.",
                ChangedByUserId = currentUserId,
                CreatedAtUtc = DateTime.UtcNow
              });
              dbContext.AssignmentEvidenceItems.Remove(evidence);
              await dbContext.SaveChangesAsync(cancellationToken);

              return Results.NoContent();
            });
    }
}

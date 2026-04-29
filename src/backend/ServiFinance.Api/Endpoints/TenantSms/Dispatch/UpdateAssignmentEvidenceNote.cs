namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class UpdateAssignmentEvidenceNote {
    public static void MapUpdateAssignmentEvidenceNote(this RouteGroupBuilder tenantApi) {
        tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/evidence/{evidenceId:guid}/note", async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            Guid evidenceId,
            [FromBody] UpdateTenantAssignmentEvidenceRequest request,
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
              .Include(entity => entity.SubmittedByUser)
              .SingleOrDefaultAsync(entity => entity.Id == evidenceId && entity.AssignmentId == assignmentId, cancellationToken);
              if (evidence is null) {
                return Results.NotFound();
              }

              var isAdmin = IsTenantAdministrator(httpContext.User);
              if (!isAdmin && evidence.SubmittedByUserId != currentUserId) {
                return Results.Forbid();
              }

              evidence.Note = request.Note?.Trim() ?? string.Empty;
              dbContext.AssignmentEvents.Add(new ServiFinance.Domain.AssignmentEvent {
                AssignmentId = assignmentId,
                EventType = "EvidenceUpdated",
                PreviousAssignedUserId = evidence.Assignment!.AssignedUserId,
                AssignedUserId = evidence.Assignment.AssignedUserId,
                PreviousScheduledStartUtc = evidence.Assignment.ScheduledStartUtc,
                PreviousScheduledEndUtc = evidence.Assignment.ScheduledEndUtc,
                ScheduledStartUtc = evidence.Assignment.ScheduledStartUtc,
                ScheduledEndUtc = evidence.Assignment.ScheduledEndUtc,
                AssignmentStatus = evidence.Assignment.AssignmentStatus,
                Remarks = string.IsNullOrWhiteSpace(evidence.Note)
                  ? "Technician evidence note cleared."
                  : "Technician evidence note updated.",
                ChangedByUserId = currentUserId,
                CreatedAtUtc = DateTime.UtcNow
              });

              await dbContext.SaveChangesAsync(cancellationToken);

              return Results.Ok(new TenantDispatchAssignmentEvidenceRowResponse(
                evidence.Id,
                evidence.SubmittedByUserId,
                evidence.Note,
                evidence.OriginalFileName,
                evidence.RelativeUrl,
                evidence.SubmittedByUser!.FullName,
                evidence.CreatedAtUtc));
            });
    }
}

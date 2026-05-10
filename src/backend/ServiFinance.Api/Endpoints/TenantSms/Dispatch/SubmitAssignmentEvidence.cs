namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Api.Services;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class SubmitAssignmentEvidence {
    public static void MapSubmitAssignmentEvidence(this RouteGroupBuilder tenantApi) {
        tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/evidence", async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            [FromForm] SubmitTenantAssignmentEvidenceRequest request,
            IImageUploadService imageUploadService,
            ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
            CancellationToken cancellationToken) => {
              if (!IsTenantSmsRouteAllowed(httpContext.User, tenantDomainSlug)) {
                return Results.Forbid();
              }

              if (!TryGetCurrentUserId(httpContext.User, out var currentUserId)) {
                return Results.Unauthorized();
              }

              var assignment = await dbContext.Assignments
              .Include(entity => entity.AssignedUser)
              .SingleOrDefaultAsync(entity => entity.Id == assignmentId, cancellationToken);
              if (assignment is null) {
                return Results.NotFound();
              }

              var isAdmin = IsTenantAdministrator(httpContext.User);
              if (!isAdmin && assignment.AssignedUserId != currentUserId) {
                return Results.Forbid();
              }

              if (string.IsNullOrWhiteSpace(request.Note) && request.Files.Count == 0) {
                return Results.BadRequest(new { error = "Add a note or at least one photo attachment." });
              }

              IReadOnlyList<ImageUploadResult> uploads = [];
              if (request.Files.Count > 0) {
                try {
                  uploads = await imageUploadService.UploadBatchAsync(
                      request.Files,
                      new ImageUploadContext(
                          ImageUploadPurpose.DispatchEvidence,
                          tenantDomainSlug,
                          currentUserId.ToString("N"),
                          $"dispatch-evidence-{assignmentId:N}"),
                      cancellationToken);
                } catch (ImageUploadException exception) {
                  return Results.Json(
                      new { error = exception.Message },
                      statusCode: exception.StatusCode);
                }
              }

              foreach (var upload in uploads) {
                dbContext.AssignmentEvidenceItems.Add(new ServiFinance.Domain.AssignmentEvidence {
                  AssignmentId = assignment.Id,
                  SubmittedByUserId = currentUserId,
                  Note = request.Note?.Trim() ?? string.Empty,
                  OriginalFileName = upload.OriginalFileName,
                  StoredFileName = upload.StoredFileName,
                  ContentType = upload.ContentType,
                  RelativeUrl = upload.PublicUrl,
                  CreatedAtUtc = DateTime.UtcNow
                });
              }

              if (uploads.Count == 0) {
                dbContext.AssignmentEvidenceItems.Add(new ServiFinance.Domain.AssignmentEvidence {
                  AssignmentId = assignment.Id,
                  SubmittedByUserId = currentUserId,
                  Note = request.Note?.Trim() ?? string.Empty,
                  CreatedAtUtc = DateTime.UtcNow
                });
              }

              dbContext.AssignmentEvents.Add(new ServiFinance.Domain.AssignmentEvent {
                AssignmentId = assignment.Id,
                EventType = "EvidenceSubmitted",
                PreviousAssignedUserId = assignment.AssignedUserId,
                AssignedUserId = assignment.AssignedUserId,
                PreviousScheduledStartUtc = assignment.ScheduledStartUtc,
                PreviousScheduledEndUtc = assignment.ScheduledEndUtc,
                ScheduledStartUtc = assignment.ScheduledStartUtc,
                ScheduledEndUtc = assignment.ScheduledEndUtc,
                AssignmentStatus = assignment.AssignmentStatus,
                Remarks = string.IsNullOrWhiteSpace(request.Note)
                  ? $"Evidence submitted with {uploads.Count} attachment(s)."
                  : request.Note.Trim(),
                ChangedByUserId = currentUserId,
                CreatedAtUtc = DateTime.UtcNow
              });

              await dbContext.SaveChangesAsync(cancellationToken);

              var evidence = await dbContext.AssignmentEvidenceItems
              .AsNoTracking()
              .Where(entity => entity.AssignmentId == assignmentId)
              .OrderByDescending(entity => entity.CreatedAtUtc)
              .Select(entity => new TenantDispatchAssignmentEvidenceRowResponse(
                  entity.Id,
                  entity.SubmittedByUserId,
                  entity.Note,
                  entity.OriginalFileName,
                  entity.RelativeUrl,
                  entity.SubmittedByUser!.FullName,
                  entity.CreatedAtUtc))
              .ToListAsync(cancellationToken);

              return Results.Ok(evidence);
            })
            .RequireTenantSmsPermission("sms.dispatch.evidence.manage", SmsModuleCodeJobUpdates, ModuleAccessLevelIncluded);
    }
}

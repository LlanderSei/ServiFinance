namespace ServiFinance.Api.Endpoints.TenantSms;

using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Api.Contracts;
using ServiFinance.Application.Auth;
using static ServiFinance.Api.Infrastructure.ProgramEndpointSupport;

internal static class SubmitAssignmentEvidence {
    public static void MapSubmitAssignmentEvidence(this RouteGroupBuilder tenantApi) {
        tenantApi.MapPost("/sms/dispatch/{assignmentId:guid}/evidence", async Task<IResult> (
            HttpContext httpContext,
            string tenantDomainSlug,
            Guid assignmentId,
            [FromForm] SubmitTenantAssignmentEvidenceRequest request,
            IWebHostEnvironment environment,
            ServiFinance.Infrastructure.Data.ServiFinanceDbContext dbContext,
            CancellationToken cancellationToken) => {
              if (!IsTenantRouteAllowed(httpContext.User, tenantDomainSlug)) {
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

              var webRootPath = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
              var uploadDirectory = Path.Combine(
              webRootPath,
              "uploads",
              "assignment-evidence",
              tenantDomainSlug,
              assignmentId.ToString("N"));
              Directory.CreateDirectory(uploadDirectory);

              foreach (var file in request.Files) {
                if (file.Length <= 0) {
                  continue;
                }

                if (file.Length > 5 * 1024 * 1024) {
                  return Results.BadRequest(new { error = $"File '{file.FileName}' exceeds the 5 MB upload limit." });
                }

                var extension = Path.GetExtension(file.FileName);
                var storedFileName = $"evidence-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{extension}";
                var absoluteFilePath = Path.Combine(uploadDirectory, storedFileName);

                await using (var stream = File.Create(absoluteFilePath)) {
                  await file.CopyToAsync(stream, cancellationToken);
                }

                dbContext.AssignmentEvidenceItems.Add(new ServiFinance.Domain.AssignmentEvidence {
                  AssignmentId = assignment.Id,
                  SubmittedByUserId = currentUserId,
                  Note = request.Note?.Trim() ?? string.Empty,
                  OriginalFileName = file.FileName,
                  StoredFileName = storedFileName,
                  ContentType = file.ContentType,
                  RelativeUrl = $"/uploads/assignment-evidence/{tenantDomainSlug}/{assignmentId:N}/{storedFileName}",
                  CreatedAtUtc = DateTime.UtcNow
                });
              }

              if (request.Files.Count == 0) {
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
                  ? $"Evidence submitted with {request.Files.Count} attachment(s)."
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
            });
    }
}

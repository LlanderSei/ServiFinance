namespace ServiFinance.Api.Endpoints.TenantSms;

using System;

// Request DTOs for assignment actions
internal sealed record CancelAssignmentRequest(string Reason);
internal sealed record HandoverAssignmentRequest(Guid NewAssigneeUserId, string Reason);
internal sealed record AbandonAssignmentRequest(string Reason);
internal sealed record RejectAssignmentRequest(string Reason);

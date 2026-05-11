namespace ServiFinance.Application.Notifications;

public sealed record EmailMessage(
    string ToEmail,
    string Subject,
    string TextBody,
    string? HtmlBody = null);

public sealed record EmailSendResult(
    bool Sent,
    string? ErrorMessage = null);

public interface IEmailSender {
  bool IsConfigured { get; }
  Task<EmailSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

namespace ServiFinance.Infrastructure.Notifications;

using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ServiFinance.Application.Notifications;
using ServiFinance.Infrastructure.Configuration;

public sealed class SmtpEmailSender(
    IOptions<SmtpEmailOptions> options,
    ILogger<SmtpEmailSender> logger) : IEmailSender {
  private readonly SmtpEmailOptions options = options.Value;

  public bool IsConfigured => options.IsConfigured;

  public async Task<EmailSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken) {
    if (!IsConfigured) {
      return new EmailSendResult(false, "SMTP email is not configured.");
    }

    using var mailMessage = new MailMessage {
      From = new MailAddress(options.FromEmail, options.FromName),
      Subject = message.Subject,
      Body = string.IsNullOrWhiteSpace(message.HtmlBody) ? message.TextBody : message.HtmlBody,
      IsBodyHtml = !string.IsNullOrWhiteSpace(message.HtmlBody)
    };
    mailMessage.To.Add(new MailAddress(message.ToEmail));

    if (!string.IsNullOrWhiteSpace(message.HtmlBody)) {
      mailMessage.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
          message.TextBody,
          null,
          "text/plain"));
    }

    using var client = new SmtpClient(options.Host, options.Port) {
      EnableSsl = options.EnableSsl
    };

    if (!string.IsNullOrWhiteSpace(options.Username)) {
      client.Credentials = new NetworkCredential(options.Username, options.Password);
    }

    try {
      await client.SendMailAsync(mailMessage).WaitAsync(cancellationToken);
      return new EmailSendResult(true);
    }
    catch (Exception ex) when (ex is SmtpException or InvalidOperationException or OperationCanceledException) {
      logger.LogWarning(ex, "Unable to send password reset email through SMTP host {SmtpHost}.", options.Host);
      return new EmailSendResult(false, "SMTP email delivery failed.");
    }
  }
}

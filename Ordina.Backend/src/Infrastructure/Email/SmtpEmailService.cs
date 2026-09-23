using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Ordina.Application.Common;

namespace Ordina.Infrastructure.Email;

public class SmtpEmailService : IEmailService
{
    private readonly SmtpSettings _settings;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IOptions<SmtpSettings> settings, ILogger<SmtpEmailService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public Task<bool> SendSupportNotificationAsync(string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var recipient = string.IsNullOrWhiteSpace(_settings.SupportRecipientEmail)
            ? "verkkutech@gmail.com"
            : _settings.SupportRecipientEmail;

        return SendEmailAsync(recipient, subject, htmlBody, cancellationToken);
    }

    public async Task<bool> SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        // ponytail: using standard library System.Net.Mail.SmtpClient, skipping external mail packages
        if (string.IsNullOrWhiteSpace(_settings.UserName) || string.IsNullOrWhiteSpace(_settings.Password))
        {
            _logger.LogWarning("SMTP credentials not configured. Email to {ToEmail} with subject '{Subject}' was skipped.", toEmail, subject);
            return false;
        }

        try
        {
            using var client = new SmtpClient(_settings.Host.Trim(), _settings.Port)
            {
                EnableSsl = _settings.EnableSsl,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_settings.UserName.Trim(), _settings.Password.Trim()),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 15000
            };

            using var message = new MailMessage
            {
                From = new MailAddress(_settings.SenderEmail, _settings.SenderName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };

            message.To.Add(toEmail);

            await client.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("Support email sent successfully to {ToEmail} (Subject: {Subject})", toEmail, subject);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {ToEmail} (Subject: {Subject}): {ErrorMessage}", toEmail, subject, ex.Message);
            return false;
        }
    }
}

namespace Ordina.Application.Common;

public interface IEmailService
{
    Task<bool> SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default);
    Task<bool> SendSupportNotificationAsync(string subject, string htmlBody, CancellationToken cancellationToken = default);
}

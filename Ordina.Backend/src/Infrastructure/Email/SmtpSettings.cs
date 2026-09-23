namespace Ordina.Infrastructure.Email;

public class SmtpSettings
{
    public const string SectionName = "SmtpSettings";

    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = "soporte@camihogar.com";
    public string SenderName { get; set; } = "Forge Soporte";
    public string SupportRecipientEmail { get; set; } = "verkkutech@gmail.com";
}

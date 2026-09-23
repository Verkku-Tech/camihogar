using System.Net;
using System.Text;
using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Domain.Support;

namespace Ordina.Application.Support;

public class SupportService : ISupportService
{
    private readonly IRepository<SupportTicket> _ticketRepository;
    private readonly IEmailService _emailService;
    private readonly ILogger<SupportService> _logger;

    public SupportService(
        IRepository<SupportTicket> ticketRepository,
        IEmailService emailService,
        ILogger<SupportService> logger)
    {
        _ticketRepository = ticketRepository;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<SupportTicketResponseDto> CreateTicketAsync(CreateSupportTicketDto dto, SupportCurrentUserContext userContext, CancellationToken cancellationToken = default)
    {
        // ponytail: simple unique ticket code format with date and 4-char random hex
        var randomSuffix = Path.GetRandomFileName().Replace(".", "")[..4].ToUpperInvariant();
        var ticketCode = $"TCK-{DateTime.UtcNow:yyMMdd}-{randomSuffix}";

        var ticket = new SupportTicket
        {
            TicketCode = ticketCode,
            UserId = userContext.UserId,
            UserName = userContext.UserName,
            UserEmail = userContext.UserEmail,
            UserRole = userContext.UserRole,
            StoreId = userContext.StoreId,
            StoreName = userContext.StoreName,
            Category = dto.Category,
            Priority = dto.Priority,
            Subject = dto.Subject.Trim(),
            Description = dto.Description.Trim(),
            CurrentUrl = dto.CurrentUrl,
            ClientInfo = dto.ClientInfo,
            Status = "Open",
            CreatedAt = DateTime.UtcNow
        };

        // 1. Guardar primero en MongoDB para resiliencia
        await _ticketRepository.AddAsync(ticket, cancellationToken);

        // 2. Despachar correo a soporte técnico (verkkutech@gmail.com)
        var emailSubject = $"[SOPORTE FORGE] [{ticket.Priority.ToUpperInvariant()}] {ticket.TicketCode}: {ticket.Subject}";
        var emailHtml = BuildEmailHtml(ticket);

        try
        {
            var emailSuccess = await _emailService.SendSupportNotificationAsync(emailSubject, emailHtml, cancellationToken);
            ticket.EmailSent = emailSuccess;
            ticket.EmailSentAt = emailSuccess ? DateTime.UtcNow : null;
            if (emailSuccess)
            {
                await _ticketRepository.UpdateAsync(ticket, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error dispatching support email for ticket {TicketCode}: {Message}", ticket.TicketCode, ex.Message);
            ticket.EmailSent = false;
            ticket.EmailError = ex.Message;
        }

        return new SupportTicketResponseDto(
            Id: ticket.Id,
            TicketCode: ticket.TicketCode,
            Status: ticket.Status,
            EmailSent: ticket.EmailSent,
            Message: "Ticket de soporte creado y registrado exitosamente."
        );
    }

    private static string BuildEmailHtml(SupportTicket ticket)
    {
        // ponytail: inline HTML builder avoiding Razor/Fluid template dependencies
        var priorityColor = ticket.Priority.ToLowerInvariant() switch
        {
            "critical" => "#dc2626",
            "high" => "#ea580c",
            "low" => "#16a34a",
            _ => "#2563eb"
        };

        var sb = new StringBuilder();
        sb.Append("<div style='font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;'>");
        sb.Append("<div style='background: #0f172a; color: #ffffff; padding: 20px;'>");
        sb.Append($"<h2 style='margin: 0; font-size: 20px;'>Nuevo Reporte de Soporte - FORGE ({ticket.TicketCode})</h2>");
        sb.Append($"<span style='display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 4px; background: {priorityColor}; font-weight: bold; font-size: 12px; color: #ffffff;'>PRIORIDAD: {ticket.Priority.ToUpperInvariant()}</span>");
        sb.Append($"<span style='display: inline-block; margin-left: 8px; margin-top: 8px; padding: 4px 10px; border-radius: 4px; background: #334155; font-size: 12px; color: #ffffff;'>CATEGORÍA: {ticket.Category}</span>");
        sb.Append("</div>");

        sb.Append("<div style='padding: 24px; color: #1e293b; line-height: 1.6;'>");
        sb.Append($"<h3 style='margin-top: 0; color: #0f172a;'>Asunto: {WebUtility.HtmlEncode(ticket.Subject)}</h3>");
        
        sb.Append("<div style='background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px;'>");
        sb.Append("<h4 style='margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #64748b;'>Descripción de la Incidencia</h4>");
        sb.Append($"<p style='margin: 0; white-space: pre-wrap; font-size: 14px;'>{WebUtility.HtmlEncode(ticket.Description)}</p>");
        sb.Append("</div>");

        sb.Append("<h4 style='margin: 20px 0 8px 0; font-size: 13px; text-transform: uppercase; color: #64748b;'>Información del Solicitante</h4>");
        sb.Append("<table style='width: 100%; border-collapse: collapse; font-size: 13px;'>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b; width: 120px;'><strong>Usuario:</strong></td><td>{WebUtility.HtmlEncode(ticket.UserName)} ({WebUtility.HtmlEncode(ticket.UserEmail)})</td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Rol:</strong></td><td>{WebUtility.HtmlEncode(ticket.UserRole)}</td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Sucursal:</strong></td><td>{WebUtility.HtmlEncode(ticket.StoreName ?? "N/A")}</td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Ruta / Pantalla:</strong></td><td><code>{WebUtility.HtmlEncode(ticket.CurrentUrl)}</code></td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Dispositivo:</strong></td><td><small>{WebUtility.HtmlEncode(ticket.ClientInfo ?? "N/A")}</small></td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Fecha y Hora:</strong></td><td>{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC</td></tr>");
        sb.Append("</table>");

        sb.Append("</div>");
        sb.Append("<div style='background: #f1f5f9; padding: 12px 20px; text-align: center; font-size: 11px; color: #64748b;'>");
        sb.Append("Generado automáticamente desde FORGE");
        sb.Append("</div></div>");

        return sb.ToString();
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Notifications;
using Ordina.Domain.Notifications;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/notifications/settings")]
[Authorize]
public class NotificationSettingsController : ControllerBase
{
    private readonly INotificationRuleSettingsService _ruleService;

    public NotificationSettingsController(INotificationRuleSettingsService ruleService)
    {
        _ruleService = ruleService;
    }

    [HttpGet]
    public async Task<ActionResult<NotificationRuleSettings>> Get(CancellationToken ct)
    {
        var settings = await _ruleService.GetSettingsAsync(ct);
        return Ok(settings);
    }

    [HttpPut]
    [Authorize(Roles = "Administrator,Super Administrator")]
    public async Task<ActionResult<NotificationRuleSettings>> Update([FromBody] NotificationRuleSettings settings, CancellationToken ct)
    {
        var updated = await _ruleService.UpdateSettingsAsync(settings, ct);
        return Ok(updated);
    }

    [HttpPost("test-alert")]
    [Authorize(Roles = "Administrator,Super Administrator")]
    public async Task<ActionResult> TestAlert([FromServices] INotificationService notificationService, CancellationToken ct)
    {
        var notif = await notificationService.PublishAsync(new CreateNotificationDto(
            Type: "OperationsMetricsAlert",
            Title: "Prueba: Reporte de Métricas Operativas",
            Message: "Esta es una alerta de prueba generada manualmente para validar la entrega a administradores.",
            Severity: "info",
            Link: "/dashboard",
            TargetRoles: new() { "Administrator", "Super Administrator" }), ct);

        return Ok(new { success = true, notification = notif });
    }
}

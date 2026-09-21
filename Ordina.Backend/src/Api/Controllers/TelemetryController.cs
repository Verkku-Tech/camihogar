using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;
using Ordina.Application.Notifications;

namespace Ordina.Api.Controllers;

public record ClientLogEntry(
    string Level,
    string Message,
    string? Stack = null,
    string? Url = null,
    string? UserAgent = null,
    string? MutationId = null,
    DateTime? Timestamp = null,
    Dictionary<string, object>? Extra = null
);

public record ClientLogBatchRequest(
    IReadOnlyList<ClientLogEntry> Logs
);

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("telemetry")]
public class TelemetryController : ControllerBase
{
    private readonly ILogger<TelemetryController> _logger;
    private readonly INotificationService? _notificationService;

    public TelemetryController(ILogger<TelemetryController> logger, INotificationService? notificationService = null)
    {
        _logger = logger;
        _notificationService = notificationService;
    }

    [HttpPost("client-logs")]
    [AllowAnonymous]
    public IActionResult IngestClientLogs([FromBody] ClientLogBatchRequest request)
    {
        if (request?.Logs == null || request.Logs.Count == 0)
        {
            return BadRequest(new { message = "Empty log batch." });
        }

        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        foreach (var log in request.Logs)
        {
            using (_logger.BeginScope(new Dictionary<string, object>
            {
                ["Source"] = "FrontendPWA",
                ["ClientIp"] = clientIp,
                ["MutationId"] = log.MutationId ?? string.Empty,
                ["Url"] = log.Url ?? string.Empty,
                ["UserAgent"] = log.UserAgent ?? string.Empty
            }))
            {
                var level = log.Level?.ToUpperInvariant();
                switch (level)
                {
                    case "ERROR":
                    case "CRITICAL":
                        TelemetryLogMessages.LogClientError(_logger, log.Message, log.Stack ?? string.Empty);
                        if (_notificationService != null &&
                            (log.Message.Contains("409", StringComparison.OrdinalIgnoreCase) ||
                             log.Message.Contains("conflict", StringComparison.OrdinalIgnoreCase) ||
                             (log.Extra != null && log.Extra.TryGetValue("status", out var statusVal) && statusVal?.ToString() == "409")))
                        {
                            _ = _notificationService.PublishAsync(new CreateNotificationDto(
                                Type: "SyncConflict",
                                Title: "Conflicto de sincronización offline",
                                Message: $"Conflicto o error de sincronización offline: {log.Message}",
                                Severity: "error",
                                TargetRoles: new() { "Administrator", "Super Administrator" }));
                        }
                        break;
                    case "WARN":
                    case "WARNING":
                        TelemetryLogMessages.LogClientWarning(_logger, log.Message);
                        break;
                    case "INFO":
                        TelemetryLogMessages.LogClientInformation(_logger, log.Message);
                        break;
                    default:
                        TelemetryLogMessages.LogClientDebug(_logger, log.Message);
                        break;
                }
            }
        }

        return Accepted(new { count = request.Logs.Count });
    }
}

internal static partial class TelemetryLogMessages
{
    [LoggerMessage(EventId = 2001, Level = LogLevel.Error, Message = "Client Log: {Message} | Stack: {Stack}")]
    public static partial void LogClientError(ILogger logger, string message, string stack);

    [LoggerMessage(EventId = 2002, Level = LogLevel.Warning, Message = "Client Log: {Message}")]
    public static partial void LogClientWarning(ILogger logger, string message);

    [LoggerMessage(EventId = 2003, Level = LogLevel.Information, Message = "Client Log: {Message}")]
    public static partial void LogClientInformation(ILogger logger, string message);

    [LoggerMessage(EventId = 2004, Level = LogLevel.Debug, Message = "Client Log: {Message}")]
    public static partial void LogClientDebug(ILogger logger, string message);
}

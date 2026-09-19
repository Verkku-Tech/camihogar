using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;

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

    public TelemetryController(ILogger<TelemetryController> logger)
    {
        _logger = logger;
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
                        _logger.LogError("Client Log: {Message} | Stack: {Stack}", log.Message, log.Stack);
                        break;
                    case "WARN":
                    case "WARNING":
                        _logger.LogWarning("Client Log: {Message}", log.Message);
                        break;
                    case "INFO":
                        _logger.LogInformation("Client Log: {Message}", log.Message);
                        break;
                    default:
                        _logger.LogDebug("Client Log: {Message}", log.Message);
                        break;
                }
            }
        }

        return Accepted(new { count = request.Logs.Count });
    }
}

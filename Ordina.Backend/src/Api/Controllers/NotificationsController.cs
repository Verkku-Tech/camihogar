using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Notifications;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        INotificationService notificationService,
        ILogger<NotificationsController> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
    }

    private (string userId, List<string> roles) GetCurrentUserContext()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).Where(r => !string.IsNullOrEmpty(r)).ToList();
        return (userId, roles);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationDto>>> GetNotifications(
        [FromQuery] int skip = 0,
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        var (userId, roles) = GetCurrentUserContext();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var notifications = await _notificationService.GetUserNotificationsAsync(userId, roles, skip, limit, ct);
        return Ok(notifications);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<object>> GetUnreadCount(CancellationToken ct = default)
    {
        var (userId, roles) = GetCurrentUserContext();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var count = await _notificationService.GetUnreadCountAsync(userId, roles, ct);
        return Ok(new { count });
    }

    [HttpPut("{id}/read")]
    public async Task<ActionResult<object>> MarkAsRead(string id, CancellationToken ct = default)
    {
        var (userId, _) = GetCurrentUserContext();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var success = await _notificationService.MarkAsReadAsync(id, userId, ct);
        return Ok(new { success });
    }

    [HttpPut("mark-all-read")]
    public async Task<ActionResult<object>> MarkAllAsRead(CancellationToken ct = default)
    {
        var (userId, roles) = GetCurrentUserContext();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var success = await _notificationService.MarkAllAsReadAsync(userId, roles, ct);
        return Ok(new { success });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<object>> DeleteNotification(string id, CancellationToken ct = default)
    {
        var (userId, _) = GetCurrentUserContext();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var success = await _notificationService.DeleteAsync(id, userId, ct);
        return Ok(new { success });
    }

    [HttpDelete]
    public async Task<ActionResult<object>> DeleteAllNotifications(CancellationToken ct = default)
    {
        var (userId, roles) = GetCurrentUserContext();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var success = await _notificationService.DeleteAllAsync(userId, roles, ct);
        return Ok(new { success });
    }

    [HttpGet("stream")]
    public async Task GetStream(CancellationToken ct)
    {
        var (userId, roles) = GetCurrentUserContext();
        if (string.IsNullOrEmpty(userId))
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");
        Response.Headers.Append("X-Accel-Buffering", "no");

        _logger.LogInformation("SSE stream started for user {UserId} with roles [{Roles}]", userId, string.Join(", ", roles));

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        // Send initial connection heartbeat/connected event
        await Response.WriteAsync("event: connected\ndata: {\"status\":\"connected\"}\n\n", ct);
        await Response.Body.FlushAsync(ct);

        try
        {
            await foreach (var notification in _notificationService.SubscribeAsync(userId, roles, ct))
            {
                var payload = JsonSerializer.Serialize(notification, jsonOptions);
                await Response.WriteAsync($"event: notification\ndata: {payload}\n\n", ct);
                await Response.Body.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Client closed connection cleanly
        }
        finally
        {
            _logger.LogInformation("SSE stream closed for user {UserId}", userId);
        }
    }
}

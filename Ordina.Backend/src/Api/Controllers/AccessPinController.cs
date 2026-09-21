using System.Collections.Concurrent;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Common;
using Ordina.Application.Notifications;
using Ordina.Domain.Common;
using Ordina.Domain.Security;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AccessPinController : ControllerBase
{
    private const int PinLength = 6;
    private const int PinValidityMinutes = 2;
    private const int SessionValidityMinutes = 30;
    private const int MaxValidateAttemptsPerMinute = 5;

    private static readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> ValidateAttempts = new();

    private readonly IRepository<AccessPin> _pinRepository;
    private readonly ILogger<AccessPinController> _logger;
    private readonly INotificationService? _notificationService;

    public AccessPinController(
        IRepository<AccessPin> pinRepository,
        ILogger<AccessPinController> logger,
        INotificationService? notificationService = null)
    {
        _pinRepository = pinRepository;
        _logger = logger;
        _notificationService = notificationService;
    }

    [HttpPost("generate")]
    public async Task<ActionResult<object>> Generate(CancellationToken cancellationToken)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        var isAdmin = string.Equals(role, "Super Administrator", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(role, "Administrator", StringComparison.OrdinalIgnoreCase);
        if (!isAdmin) return Forbid();

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var userName = User.FindFirstValue("full_name") ?? User.FindFirstValue(ClaimTypes.Name) ?? "Admin";

        var now = DateTime.UtcNow;
        var expiresAt = now.AddMinutes(PinValidityMinutes);
        var pin = GenerateNumericPin();

        var entity = new AccessPin
        {
            Pin = pin,
            GeneratedByUserId = userId,
            GeneratedByUserName = userName,
            CreatedAt = now,
            ExpiresAt = expiresAt,
            Status = AccessPinStatus.Active
        };

        await _pinRepository.AddAsync(entity, cancellationToken);

        return Ok(new
        {
            pin,
            expiresAt,
            expiresInSeconds = PinValidityMinutes * 60
        });
    }

    [HttpPost("validate")]
    public async Task<ActionResult<object>> Validate([FromBody] ValidatePinDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.Pin) || request.Pin.Trim().Length != PinLength)
            return BadRequest(new { message = "PIN inválido. Debe tener 6 dígitos." });

        if (string.IsNullOrWhiteSpace(request?.OrderId))
            return BadRequest(new { message = "El ID del pedido es requerido." });

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        EnforceRateLimit(userId);

        var normalizedPin = request.Pin.Trim();
        var now = DateTime.UtcNow;

        var activePins = await _pinRepository.FindAsync(p => p.Pin == normalizedPin && p.Status == AccessPinStatus.Active, cancellationToken);
        var accessPin = activePins.FirstOrDefault(p => p.ExpiresAt > now);

        if (accessPin == null)
            return BadRequest(new { message = "PIN inválido o expirado. Solicita uno nuevo al administrador." });

        var sessionExpiresAt = now.AddMinutes(SessionValidityMinutes);
        accessPin.Status = AccessPinStatus.Used;
        accessPin.UsedByUserId = userId;
        accessPin.OrderId = request.OrderId;
        accessPin.UsedAt = now;
        accessPin.SessionExpiresAt = sessionExpiresAt;

        await _pinRepository.UpdateAsync(accessPin, cancellationToken);

        if (_notificationService != null)
        {
            try
            {
                var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name ?? userId;
                await _notificationService.PublishAsync(new CreateNotificationDto(
                    Type: "EmergencyPinUsed",
                    Title: "Uso de PIN de Emergencia",
                    Message: $"El usuario '{userName}' utilizó un PIN de acceso de emergencia para el pedido {request.OrderId}.",
                    Severity: "warning",
                    TargetRoles: new() { "Administrator", "Super Administrator" }), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error emitiendo notificación de uso de PIN de emergencia");
            }
        }

        return Ok(new
        {
            success = true,
            sessionExpiresAt,
            sessionRemainingSeconds = SessionValidityMinutes * 60
        });
    }

    [HttpGet("session/{orderId}")]
    public async Task<ActionResult<object>> GetSession(string orderId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(orderId))
            return BadRequest(new { message = "El ID del pedido es requerido" });

        var now = DateTime.UtcNow;
        var sessions = await _pinRepository.FindAsync(p => p.OrderId == orderId && p.SessionExpiresAt > now, cancellationToken);
        var activeSession = sessions.OrderByDescending(p => p.SessionExpiresAt).FirstOrDefault();

        if (activeSession?.SessionExpiresAt == null)
        {
            return Ok(new { active = false });
        }

        var remaining = (int)Math.Max(0, (activeSession.SessionExpiresAt.Value - now).TotalSeconds);
        return Ok(new
        {
            active = remaining > 0,
            remainingSeconds = remaining,
            sessionExpiresAt = activeSession.SessionExpiresAt
        });
    }

    [HttpGet("history")]
    public async Task<ActionResult<object>> GetHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        var isAdmin = string.Equals(role, "Super Administrator", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(role, "Administrator", StringComparison.OrdinalIgnoreCase);
        if (!isAdmin) return Forbid();

        var allPins = await _pinRepository.GetAllAsync(cancellationToken);
        var totalCount = allPins.Count;
        var items = allPins
            .OrderByDescending(p => p.CreatedAt)
            .Skip((Math.Max(1, page) - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                id = p.Id,
                pinMasked = MaskPin(p.Pin),
                generatedByUserName = p.GeneratedByUserName,
                usedByUserId = p.UsedByUserId,
                orderId = p.OrderId,
                createdAt = p.CreatedAt,
                expiresAt = p.ExpiresAt,
                usedAt = p.UsedAt,
                sessionExpiresAt = p.SessionExpiresAt,
                status = p.Status
            })
            .ToList();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize
        });
    }

    private static string MaskPin(string pin) => string.IsNullOrEmpty(pin) || pin.Length < 2 ? "******" : $"****{pin[^2..]}";

    private static string GenerateNumericPin()
    {
        var bytes = new byte[4];
        RandomNumberGenerator.Fill(bytes);
        var value = BitConverter.ToUInt32(bytes, 0) % 1_000_000;
        return value.ToString("D6");
    }

    private static void EnforceRateLimit(string userId)
    {
        var now = DateTime.UtcNow;
        ValidateAttempts.AddOrUpdate(
            userId,
            _ => (1, now),
            (_, existing) => (now - existing.WindowStart).TotalMinutes >= 1 ? (1, now) : (existing.Count + 1, existing.WindowStart));

        if (ValidateAttempts.TryGetValue(userId, out var entry) && entry.Count > MaxValidateAttemptsPerMinute)
            throw new InvalidOperationException("Demasiados intentos. Espera un minuto e inténtalo de nuevo.");
    }
}

public record ValidatePinDto(string Pin, string OrderId);

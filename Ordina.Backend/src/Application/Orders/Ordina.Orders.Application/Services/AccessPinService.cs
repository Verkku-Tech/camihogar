using System.Collections.Concurrent;
using System.Security.Cryptography;
using Ordina.Database.Entities.AccessPin;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Services;

public class AccessPinService : IAccessPinService
{
    private const int PinLength = 6;
    private const int PinValidityMinutes = 2;
    private const int SessionValidityMinutes = 30;
    private const int MaxValidateAttemptsPerMinute = 5;

    private static readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> ValidateAttempts = new();

    private readonly IAccessPinRepository _accessPinRepository;

    public AccessPinService(IAccessPinRepository accessPinRepository)
    {
        _accessPinRepository = accessPinRepository;
    }

    public async Task<GenerateAccessPinResponseDto> GenerateAsync(string userId, string userName)
    {
        await _accessPinRepository.ExpireStaleActivePinsAsync(DateTime.UtcNow);

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
            Status = AccessPinStatus.Active,
        };

        await _accessPinRepository.CreateAsync(entity);

        return new GenerateAccessPinResponseDto
        {
            Pin = pin,
            ExpiresAt = expiresAt,
            ExpiresInSeconds = PinValidityMinutes * 60,
        };
    }

    public async Task<ValidateAccessPinResponseDto> ValidateAsync(string pin, string orderId, string userId)
    {
        if (string.IsNullOrWhiteSpace(pin) || pin.Length != PinLength)
            throw new ArgumentException("PIN inválido. Debe tener 6 dígitos.");

        if (string.IsNullOrWhiteSpace(orderId))
            throw new ArgumentException("El ID del pedido es requerido.");

        EnforceRateLimit(userId);

        await _accessPinRepository.ExpireStaleActivePinsAsync(DateTime.UtcNow);

        var normalizedPin = pin.Trim();
        var accessPin = await _accessPinRepository.GetActiveByPinAsync(normalizedPin);
        if (accessPin == null)
            throw new ArgumentException("PIN inválido o expirado. Solicita uno nuevo al administrador.");

        var now = DateTime.UtcNow;
        var sessionExpiresAt = now.AddMinutes(SessionValidityMinutes);

        await _accessPinRepository.MarkAsUsedAsync(
            accessPin.Id,
            userId,
            orderId,
            now,
            sessionExpiresAt);

        return new ValidateAccessPinResponseDto
        {
            Success = true,
            SessionExpiresAt = sessionExpiresAt,
            SessionRemainingSeconds = SessionValidityMinutes * 60,
        };
    }

    public async Task<AccessPinSessionResponseDto> GetSessionAsync(string orderId, string userId)
    {
        await _accessPinRepository.ExpireStaleActivePinsAsync(DateTime.UtcNow);

        var session = await _accessPinRepository.GetActiveSessionAsync(orderId, userId);
        if (session?.SessionExpiresAt == null)
        {
            return new AccessPinSessionResponseDto { Active = false };
        }

        var remaining = (int)Math.Max(0, (session.SessionExpiresAt.Value - DateTime.UtcNow).TotalSeconds);
        if (remaining <= 0)
        {
            return new AccessPinSessionResponseDto { Active = false };
        }

        return new AccessPinSessionResponseDto
        {
            Active = true,
            RemainingSeconds = remaining,
            SessionExpiresAt = session.SessionExpiresAt,
        };
    }

    public async Task<bool> HasActiveSessionAsync(string orderId, string userId)
    {
        var session = await GetSessionAsync(orderId, userId);
        return session.Active;
    }

    public async Task<AccessPinHistoryResponseDto> GetHistoryAsync(int page, int pageSize)
    {
        await _accessPinRepository.ExpireStaleActivePinsAsync(DateTime.UtcNow);

        var (items, total) = await _accessPinRepository.GetPagedHistoryAsync(page, pageSize);
        return new AccessPinHistoryResponseDto
        {
            Items = items.Select(MapHistoryItem).ToList(),
            TotalCount = total,
            Page = Math.Max(1, page),
            PageSize = Math.Clamp(pageSize, 1, 100),
        };
    }

    private static AccessPinHistoryItemDto MapHistoryItem(AccessPin p)
    {
        return new AccessPinHistoryItemDto
        {
            Id = p.Id,
            PinMasked = MaskPin(p.Pin),
            GeneratedByUserName = p.GeneratedByUserName,
            UsedByUserId = p.UsedByUserId,
            OrderId = p.OrderId,
            CreatedAt = p.CreatedAt,
            ExpiresAt = p.ExpiresAt,
            UsedAt = p.UsedAt,
            SessionExpiresAt = p.SessionExpiresAt,
            Status = p.Status,
        };
    }

    private static string MaskPin(string pin)
    {
        if (string.IsNullOrEmpty(pin) || pin.Length < 2)
            return "******";
        return $"****{pin[^2..]}";
    }

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
        var key = userId;

        ValidateAttempts.AddOrUpdate(
            key,
            _ => (1, now),
            (_, existing) =>
            {
                if ((now - existing.WindowStart).TotalMinutes >= 1)
                    return (1, now);
                return (existing.Count + 1, existing.WindowStart);
            });

        if (ValidateAttempts.TryGetValue(key, out var entry) && entry.Count > MaxValidateAttemptsPerMinute)
            throw new InvalidOperationException("Demasiados intentos. Espera un minuto e inténtalo de nuevo.");
    }
}

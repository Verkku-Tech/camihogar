namespace Ordina.Orders.Application.DTOs;

public class GenerateAccessPinResponseDto
{
    public string Pin { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public int ExpiresInSeconds { get; set; }
}

public class ValidateAccessPinRequestDto
{
    public string Pin { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
}

public class ValidateAccessPinResponseDto
{
    public bool Success { get; set; }
    public DateTime SessionExpiresAt { get; set; }
    public int SessionRemainingSeconds { get; set; }
}

public class AccessPinSessionResponseDto
{
    public bool Active { get; set; }
    public int? RemainingSeconds { get; set; }
    public DateTime? SessionExpiresAt { get; set; }
}

public class AccessPinHistoryItemDto
{
    public string Id { get; set; } = string.Empty;
    public string PinMasked { get; set; } = string.Empty;
    public string GeneratedByUserName { get; set; } = string.Empty;
    public string? UsedByUserId { get; set; }
    public string? OrderId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime? SessionExpiresAt { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class AccessPinHistoryResponseDto
{
    public IReadOnlyList<AccessPinHistoryItemDto> Items { get; set; } = Array.Empty<AccessPinHistoryItemDto>();
    public long TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

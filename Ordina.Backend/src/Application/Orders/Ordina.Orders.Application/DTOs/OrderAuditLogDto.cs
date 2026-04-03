namespace Ordina.Orders.Application.DTOs;

public class AuditChangeDto
{
    public string Field { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
}

public class OrderAuditLogDto
{
    public string Id { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string OrderNumber { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public List<AuditChangeDto> Changes { get; set; } = new();
    public DateTime Timestamp { get; set; }
}

public class PagedAuditLogsResponseDto
{
    public IEnumerable<OrderAuditLogDto> Items { get; set; } = Array.Empty<OrderAuditLogDto>();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public long TotalCount { get; set; }
    public int TotalPages { get; set; }
}

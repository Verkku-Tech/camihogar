namespace Ordina.Orders.Application.DTOs;

public class BulkUpdateProductStatusItemDto
{
    public string OrderId { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string? DispatchOrigin { get; set; }
}

public class BulkUpdateProductStatusRequestDto
{
    public List<BulkUpdateProductStatusItemDto> Items { get; set; } = new();
    
    /// <summary>
    /// Acción deseada: "queue", "start", "mark_fabricated", "revert_debe_fabricar", "refabrication", "to_dispatch", "to_delivered", "to_store", "to_manufacturing"
    /// </summary>
    public string Action { get; set; } = string.Empty;
    
    public string? ProviderId { get; set; }
    public string? ProviderName { get; set; }
    public string? Notes { get; set; }
    public string? RefabricationReason { get; set; }
}

public class BulkUpdateProductStatusResponseDto
{
    public int SuccessCount { get; set; }
    public int ErrorCount { get; set; }
    public List<string> Errors { get; set; } = new();
}

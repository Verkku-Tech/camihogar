namespace Ordina.Application.Inventory;

public record StockTransferDto(
    string Id,
    string TransferNumber,
    string StockId,
    string ProductId,
    string ProductName,
    string Sku,
    string VariantKey,
    Dictionary<string, string> Attributes,
    string OriginLocationId,
    string OriginLocationName,
    string OriginLocationType,
    string DestinationLocationId,
    string DestinationLocationName,
    string DestinationLocationType,
    int Quantity,
    string Status,
    string RequestedBy,
    string? TransferredBy,
    string? Reason,
    DateTime? TransferredAt,
    DateTime CreatedAt);

public record CreateStockTransferDto(
    string StockId,
    string DestinationLocationId,
    string DestinationLocationName,
    string DestinationLocationType,
    int Quantity,
    string RequestedBy,
    string? Reason = null);

public record ConfirmStockTransferDto(string? TransferredBy);

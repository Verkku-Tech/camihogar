namespace Ordina.Application.Inventory;

public record PhysicalStockDto(
    string Id,
    string ProductId,
    string ProductName,
    string Sku,
    string CategoryId,
    string CategoryName,
    string LocationType,
    string LocationId,
    string LocationName,
    Dictionary<string, string> Attributes,
    string VariantKey,
    int Quantity,
    int ReservedQuantity,
    int AvailableQuantity,
    decimal PriceUsd,
    decimal CostUsd,
    DateTime UpdatedAt);

public record ManualStockEntryDto(
    string ProductId,
    string LocationType,
    string LocationId,
    Dictionary<string, string> Attributes,
    int Quantity,
    decimal CostUsd,
    decimal PriceUsd,
    string? Note);

public record StockImportSummaryDto(int TotalRows, int CreatedCount, int UpdatedCount, List<string> Errors);

namespace Ordina.Application.Manufacturing;

public record ManufacturingOrderDto(
    string Id,
    string OrderNumber,
    string OrderType,
    string ProductId,
    string ProductName,
    string Sku,
    Dictionary<string, string> Attributes,
    int Quantity,
    string DestinationLocationId,
    string DestinationLocationName,
    string DestinationLocationType,
    string RequestedBy,
    string? ProviderId,
    string? ProviderName,
    decimal CostUsd,
    string Status,
    string? Notes,
    DateTime? StartedAt,
    DateTime? CompletedAt,
    DateTime CreatedAt);

public record CreateManufacturingOrderDto(
    string ProductId,
    string ProductName,
    string Sku,
    Dictionary<string, string>? Attributes,
    int Quantity,
    string DestinationLocationId,
    string DestinationLocationName,
    string DestinationLocationType,
    string RequestedBy,
    string? ProviderId,
    string? ProviderName,
    decimal CostUsd,
    string? Notes);

public record UpdateManufacturingOrderStatusDto(
    string Status,
    string? ProviderId = null,
    string? ProviderName = null,
    string? Notes = null);

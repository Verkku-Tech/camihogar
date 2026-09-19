namespace Ordina.Application.Dispatch;

public record DispatchItemDto(
    string OrderId,
    string OrderNumber,
    string ProductLineId,
    string ProductName,
    int Quantity,
    string ClientName,
    string ClientPhone,
    string DeliveryAddress,
    string Status,
    DateTime? DeliveredAt = null);

public record DispatchQueueItemDto(
    string OrderId,
    string OrderNumber,
    string ProductLineId,
    string ProductName,
    int Quantity,
    string ClientName,
    string ClientPhone,
    string DeliveryAddress,
    string DeliveryZone,
    string DeliveryType,
    string LocationStatus,
    string LogisticStatus);

public record DispatchRouteResponseDto(
    string Id,
    string Name,
    string DriverName,
    string? DriverPhone,
    string? VehiclePlate,
    DateTime RouteDate,
    string Zone,
    string Status,
    IReadOnlyList<DispatchItemDto> Items,
    string? Observations,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateDispatchRouteDto(
    string Name,
    string DriverName,
    string Zone,
    DateTime RouteDate,
    IReadOnlyList<DispatchItemDto> Items,
    string? DriverPhone = null,
    string? VehiclePlate = null,
    string? Observations = null);

public record UpdateDispatchRouteDto(
    string? Name = null,
    string? DriverName = null,
    string? DriverPhone = null,
    string? VehiclePlate = null,
    string? Status = null,
    string? Observations = null);

public record ConfirmDeliveryDto(
    string RouteId,
    string OrderId,
    string ProductLineId,
    string? DeliveryNotes = null);

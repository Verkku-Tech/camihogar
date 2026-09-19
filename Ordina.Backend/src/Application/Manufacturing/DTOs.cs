using Ordina.Application.Orders;

namespace Ordina.Application.Manufacturing;

public record WorkOrderItemDto(
    string OrderId,
    string OrderNumber,
    string ProductId,
    string ProductName,
    int Quantity,
    string Category,
    Dictionary<string, object>? Attributes,
    string ManufacturingStatus,
    string? ManufacturingProviderId,
    string? ManufacturingProviderName,
    DateTime? ManufacturingStartedAt,
    DateTime? ManufacturingCompletedAt,
    string? ManufacturingNotes,
    string? RefabricationReason,
    DateTime? RefabricatedAt,
    string? LocationStatus,
    IReadOnlyList<ProductImageDto>? Images);

public record KanbanBoardDto(
    IReadOnlyList<WorkOrderItemDto> MustManufacture,
    IReadOnlyList<WorkOrderItemDto> ToManufacture,
    IReadOnlyList<WorkOrderItemDto> Manufacturing,
    IReadOnlyList<WorkOrderItemDto> WarehouseUnmanufactured);

public record UpdateManufacturingStageDto(
    string OrderId,
    string ProductId,
    string NewStage,
    string? Notes = null,
    string? ProviderId = null,
    string? ProviderName = null);

public record RefabricateProductDto(
    string OrderId,
    string ProductId,
    string Reason,
    string? NewProviderId = null,
    string? NewProviderName = null);

public record ManufacturingReportRowDto(
    string OrderNumber,
    string ProductName,
    int Quantity,
    string Category,
    string Status,
    string ManufacturerName,
    DateTime? StartedAt,
    DateTime? CompletedAt,
    string Observations);

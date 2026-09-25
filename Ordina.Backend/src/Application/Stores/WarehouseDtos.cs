namespace Ordina.Application.Stores;

public record WarehouseDto(
    string Id,
    string Name,
    string Code,
    string Address,
    string Phone,
    int MaxCapacity,
    bool IsCentral,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateWarehouseDto(
    string Name,
    string Code,
    string Address,
    string Phone,
    int MaxCapacity = 100,
    bool IsCentral = false);

public record UpdateWarehouseDto(
    string? Name = null,
    string? Code = null,
    string? Address = null,
    string? Phone = null,
    int? MaxCapacity = null,
    bool? IsCentral = null,
    string? Status = null);

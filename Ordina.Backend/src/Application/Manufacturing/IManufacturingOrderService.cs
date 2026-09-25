namespace Ordina.Application.Manufacturing;

public interface IManufacturingOrderService
{
    Task<IReadOnlyList<ManufacturingOrderDto>> GetAllAsync(string? status = null, string? destinationLocationId = null, CancellationToken ct = default);
    Task<ManufacturingOrderDto?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<ManufacturingOrderDto> CreateAsync(CreateManufacturingOrderDto dto, CancellationToken ct = default);
    Task<ManufacturingOrderDto?> UpdateStatusAsync(string id, UpdateManufacturingOrderStatusDto dto, CancellationToken ct = default);
    Task<bool> CancelAsync(string id, CancellationToken ct = default);
}

namespace Ordina.Application.Stores;

public interface IWarehouseService
{
    Task<IReadOnlyList<WarehouseDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<WarehouseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<WarehouseDto> CreateAsync(CreateWarehouseDto dto, CancellationToken cancellationToken = default);
    Task<WarehouseDto?> UpdateAsync(string id, UpdateWarehouseDto dto, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
}

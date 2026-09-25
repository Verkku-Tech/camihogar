using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Domain.Stores;

namespace Ordina.Application.Stores;

public class WarehouseService(
    IRepository<Warehouse> warehouseRepo,
    ILogger<WarehouseService> logger) : IWarehouseService
{
    public async Task<IReadOnlyList<WarehouseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var list = await warehouseRepo.GetAllAsync(cancellationToken);
        return list.Select(MapToDto).ToList();
    }

    public async Task<WarehouseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var item = await warehouseRepo.GetByIdAsync(id, cancellationToken);
        return item == null ? null : MapToDto(item);
    }

    public async Task<WarehouseDto> CreateAsync(CreateWarehouseDto dto, CancellationToken cancellationToken = default)
    {
        var entity = new Warehouse
        {
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim().ToUpperInvariant(),
            Address = dto.Address.Trim(),
            Phone = dto.Phone.Trim(),
            MaxCapacity = Math.Max(1, dto.MaxCapacity),
            IsCentral = dto.IsCentral,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await warehouseRepo.AddAsync(entity, cancellationToken);
        logger.LogInformation("Almacén creado: {WarehouseId} ({Code})", created.Id, created.Code);
        return MapToDto(created);
    }

    public async Task<WarehouseDto?> UpdateAsync(string id, UpdateWarehouseDto dto, CancellationToken cancellationToken = default)
    {
        var entity = await warehouseRepo.GetByIdAsync(id, cancellationToken);
        if (entity == null) return null;

        if (!string.IsNullOrWhiteSpace(dto.Name)) entity.Name = dto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Code)) entity.Code = dto.Code.Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(dto.Address)) entity.Address = dto.Address.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Phone)) entity.Phone = dto.Phone.Trim();
        if (dto.MaxCapacity.HasValue) entity.MaxCapacity = Math.Max(1, dto.MaxCapacity.Value);
        if (dto.IsCentral.HasValue) entity.IsCentral = dto.IsCentral.Value;
        if (!string.IsNullOrWhiteSpace(dto.Status)) entity.Status = dto.Status;

        entity.UpdatedAt = DateTime.UtcNow;
        await warehouseRepo.UpdateAsync(entity, cancellationToken);
        return MapToDto(entity);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var entity = await warehouseRepo.GetByIdAsync(id, cancellationToken);
        if (entity == null) return false;
        entity.Status = "inactive";
        entity.UpdatedAt = DateTime.UtcNow;
        await warehouseRepo.UpdateAsync(entity, cancellationToken);
        return true;
    }

    private static WarehouseDto MapToDto(Warehouse w) =>
        new(w.Id ?? string.Empty, w.Name, w.Code, w.Address, w.Phone, w.MaxCapacity, w.IsCentral, w.Status, w.CreatedAt, w.UpdatedAt);
}

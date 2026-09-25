using Ordina.Application.Common;
using Ordina.Domain.Inventory;

namespace Ordina.Application.Inventory;

public class StockTransferService(
    IPhysicalStockRepository stockRepo,
    IRepository<StockTransfer> transferRepo) : IStockTransferService
{
    public async Task<StockTransferDto> CreateTransferAsync(CreateStockTransferDto dto, CancellationToken ct = default)
    {
        var stock = await stockRepo.GetByIdAsync(dto.StockId, ct)
            ?? throw new InvalidOperationException($"Artículo de stock con id {dto.StockId} no encontrado.");

        if (stock.LocationId == dto.DestinationLocationId)
        {
            throw new InvalidOperationException("La sede destino no puede ser la misma sede de origen.");
        }

        var reserved = await stockRepo.ReserveStockAtomicAsync(dto.StockId, dto.Quantity, ct);
        if (!reserved)
        {
            throw new InvalidOperationException($"Disponibilidad insuficiente en origen para transferir {dto.Quantity} unidades de '{stock.ProductName}'.");
        }

        var transferNumber = $"TRF-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}";

        var transfer = new StockTransfer
        {
            TransferNumber = transferNumber,
            StockId = stock.Id,
            ProductId = stock.ProductId,
            ProductName = stock.ProductName,
            Sku = stock.Sku,
            VariantKey = stock.VariantKey,
            Attributes = stock.Attributes ?? new(),
            OriginLocationId = stock.LocationId,
            OriginLocationName = stock.LocationName,
            OriginLocationType = stock.LocationType,
            DestinationLocationId = dto.DestinationLocationId,
            DestinationLocationName = dto.DestinationLocationName,
            DestinationLocationType = dto.DestinationLocationType,
            Quantity = dto.Quantity,
            Status = "in_transit",
            RequestedBy = dto.RequestedBy,
            Reason = dto.Reason,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await transferRepo.AddAsync(transfer, ct);
        return MapToDto(created);
    }

    public async Task<StockTransferDto?> ConfirmTransferAsync(string transferId, string transferredBy, CancellationToken ct = default)
    {
        var transfer = await transferRepo.GetByIdAsync(transferId, ct);
        if (transfer == null || transfer.Status != "in_transit") return null;

        // 1. Deduct from origin
        await stockRepo.DeductSoldStockAtomicAsync(transfer.StockId, transfer.Quantity, ct);

        // 2. Increment or create in destination
        var destinationStocks = await stockRepo.FindAsync(
            s => s.LocationId == transfer.DestinationLocationId &&
                 s.ProductId == transfer.ProductId &&
                 s.VariantKey == transfer.VariantKey,
            ct);

        var destItem = destinationStocks.FirstOrDefault();
        if (destItem != null)
        {
            destItem.Quantity += transfer.Quantity;
            destItem.UpdatedAt = DateTime.UtcNow;
            await stockRepo.UpdateAsync(destItem, ct);
        }
        else
        {
            var originStock = await stockRepo.GetByIdAsync(transfer.StockId, ct);
            var newStock = new PhysicalStock
            {
                ProductId = transfer.ProductId,
                ProductName = transfer.ProductName,
                Sku = transfer.Sku,
                CategoryId = originStock?.CategoryId ?? string.Empty,
                CategoryName = originStock?.CategoryName ?? string.Empty,
                VariantKey = transfer.VariantKey,
                Attributes = transfer.Attributes ?? new(),
                LocationId = transfer.DestinationLocationId,
                LocationName = transfer.DestinationLocationName,
                LocationType = transfer.DestinationLocationType,
                Quantity = transfer.Quantity,
                ReservedQuantity = 0,
                CostUsd = originStock?.CostUsd ?? 0,
                PriceUsd = originStock?.PriceUsd ?? 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await stockRepo.AddAsync(newStock, ct);
        }

        // 3. Mark transfer as transferred
        transfer.Status = "transferred";
        transfer.TransferredBy = transferredBy;
        transfer.TransferredAt = DateTime.UtcNow;
        transfer.UpdatedAt = DateTime.UtcNow;

        await transferRepo.UpdateAsync(transfer, ct);
        return MapToDto(transfer);
    }

    public async Task<bool> CancelTransferAsync(string transferId, CancellationToken ct = default)
    {
        var transfer = await transferRepo.GetByIdAsync(transferId, ct);
        if (transfer == null || transfer.Status != "in_transit") return false;

        // Restore reserved stock in origin
        await stockRepo.ReleaseStockAtomicAsync(transfer.StockId, transfer.Quantity, ct);

        transfer.Status = "cancelled";
        transfer.UpdatedAt = DateTime.UtcNow;
        await transferRepo.UpdateAsync(transfer, ct);
        return true;
    }

    public async Task<IReadOnlyList<StockTransferDto>> GetAllTransfersAsync(string? status = null, string? locationId = null, CancellationToken ct = default)
    {
        var list = await transferRepo.GetAllAsync(ct);
        var query = list.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            query = query.Where(t => string.Equals(t.Status, status, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(locationId) && locationId != "all")
        {
            query = query.Where(t => t.OriginLocationId == locationId || t.DestinationLocationId == locationId);
        }

        return query.OrderByDescending(t => t.CreatedAt).Select(MapToDto).ToList();
    }

    public async Task<StockTransferDto?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var item = await transferRepo.GetByIdAsync(id, ct);
        return item != null ? MapToDto(item) : null;
    }

    private static StockTransferDto MapToDto(StockTransfer t) =>
        new(
            t.Id,
            t.TransferNumber,
            t.StockId,
            t.ProductId,
            t.ProductName,
            t.Sku,
            t.VariantKey,
            t.Attributes ?? new(),
            t.OriginLocationId,
            t.OriginLocationName,
            t.OriginLocationType,
            t.DestinationLocationId,
            t.DestinationLocationName,
            t.DestinationLocationType,
            t.Quantity,
            t.Status,
            t.RequestedBy,
            t.TransferredBy,
            t.Reason,
            t.TransferredAt,
            t.CreatedAt
        );
}

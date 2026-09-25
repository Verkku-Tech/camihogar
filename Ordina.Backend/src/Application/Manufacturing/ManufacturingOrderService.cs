using System.Text.RegularExpressions;
using Ordina.Application.Common;
using Ordina.Application.Inventory;
using Ordina.Domain.Inventory;
using Ordina.Domain.Manufacturing;

namespace Ordina.Application.Manufacturing;

public class ManufacturingOrderService(
    IRepository<ManufacturingOrder> orderRepo,
    IPhysicalStockRepository stockRepo) : IManufacturingOrderService
{
    public async Task<IReadOnlyList<ManufacturingOrderDto>> GetAllAsync(
        string? status = null,
        string? destinationLocationId = null,
        CancellationToken ct = default)
    {
        var items = await orderRepo.GetAllAsync(ct);
        var query = items.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            query = query.Where(o => string.Equals(o.Status, status, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(destinationLocationId) && destinationLocationId != "all")
        {
            query = query.Where(o => o.DestinationLocationId == destinationLocationId);
        }

        return query
            .OrderByDescending(o => o.CreatedAt)
            .Select(MapToDto)
            .ToList();
    }

    public async Task<ManufacturingOrderDto?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var item = await orderRepo.GetByIdAsync(id, ct);
        return item != null ? MapToDto(item) : null;
    }

    public async Task<ManufacturingOrderDto> CreateAsync(CreateManufacturingOrderDto dto, CancellationToken ct = default)
    {
        var all = await orderRepo.GetAllAsync(ct);
        var maxNum = 0;
        foreach (var ord in all)
        {
            var match = Regex.Match(ord.OrderNumber ?? string.Empty, @"\d+");
            if (match.Success && int.TryParse(match.Value, out var num))
            {
                if (num > maxNum) maxNum = num;
            }
        }

        var orderNumber = $"OF-{(maxNum + 1):D4}";
        var attributes = dto.Attributes ?? new Dictionary<string, string>();

        var entity = new ManufacturingOrder
        {
            OrderNumber = orderNumber,
            OrderType = "StockReplenishment",
            ProductId = dto.ProductId,
            ProductName = dto.ProductName,
            Sku = dto.Sku,
            Attributes = attributes,
            Quantity = dto.Quantity,
            DestinationLocationId = dto.DestinationLocationId,
            DestinationLocationName = dto.DestinationLocationName,
            DestinationLocationType = dto.DestinationLocationType,
            RequestedBy = dto.RequestedBy,
            ProviderId = dto.ProviderId,
            ProviderName = dto.ProviderName,
            CostUsd = dto.CostUsd,
            Notes = dto.Notes,
            Status = "Pendiente",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await orderRepo.AddAsync(entity, ct);
        return MapToDto(created);
    }

    public async Task<ManufacturingOrderDto?> UpdateStatusAsync(string id, UpdateManufacturingOrderStatusDto dto, CancellationToken ct = default)
    {
        var order = await orderRepo.GetByIdAsync(id, ct);
        if (order == null) return null;

        var previousStatus = order.Status;
        order.Status = dto.Status;
        if (!string.IsNullOrWhiteSpace(dto.ProviderId)) order.ProviderId = dto.ProviderId;
        if (!string.IsNullOrWhiteSpace(dto.ProviderName)) order.ProviderName = dto.ProviderName;
        if (!string.IsNullOrWhiteSpace(dto.Notes)) order.Notes = dto.Notes;
        order.UpdatedAt = DateTime.UtcNow;

        if (string.Equals(dto.Status, "En Produccion", StringComparison.OrdinalIgnoreCase) && order.StartedAt == null)
        {
            order.StartedAt = DateTime.UtcNow;
        }

        // If completed as Fabricado, credit physical stock to destination!
        if (string.Equals(dto.Status, "Fabricado", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(previousStatus, "Fabricado", StringComparison.OrdinalIgnoreCase))
        {
            order.CompletedAt = DateTime.UtcNow;
            await CreditStockToDestinationAsync(order, ct);
        }

        await orderRepo.UpdateAsync(order, ct);
        return MapToDto(order);
    }

    public async Task<bool> CancelAsync(string id, CancellationToken ct = default)
    {
        var order = await orderRepo.GetByIdAsync(id, ct);
        if (order == null) return false;

        order.Status = "Cancelado";
        order.UpdatedAt = DateTime.UtcNow;
        return await orderRepo.UpdateAsync(order, ct);
    }

    private async Task CreditStockToDestinationAsync(ManufacturingOrder order, CancellationToken ct)
    {
        var variantKey = order.Attributes.Count > 0
            ? string.Join("-", order.Attributes.OrderBy(kv => kv.Key).Select(kv => $"{kv.Key}:{kv.Value}"))
            : "default";

        var existingList = await stockRepo.FindAsync(
            s => s.ProductId == order.ProductId &&
                 s.LocationId == order.DestinationLocationId &&
                 s.VariantKey == variantKey,
            ct);

        var existingStock = existingList.FirstOrDefault();
        if (existingStock != null)
        {
            existingStock.Quantity += order.Quantity;
            existingStock.UpdatedAt = DateTime.UtcNow;
            await stockRepo.UpdateAsync(existingStock, ct);
        }
        else
        {
            var newStock = new PhysicalStock
            {
                ProductId = order.ProductId,
                ProductName = order.ProductName,
                Sku = order.Sku,
                VariantKey = variantKey,
                Attributes = order.Attributes,
                LocationId = order.DestinationLocationId,
                LocationName = order.DestinationLocationName,
                LocationType = order.DestinationLocationType,
                Quantity = order.Quantity,
                ReservedQuantity = 0,
                CostUsd = order.CostUsd,
                PriceUsd = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await stockRepo.AddAsync(newStock, ct);
        }
    }

    private static ManufacturingOrderDto MapToDto(ManufacturingOrder o) =>
        new(
            o.Id,
            o.OrderNumber,
            o.OrderType,
            o.ProductId,
            o.ProductName,
            o.Sku,
            o.Attributes ?? new Dictionary<string, string>(),
            o.Quantity,
            o.DestinationLocationId,
            o.DestinationLocationName,
            o.DestinationLocationType,
            o.RequestedBy,
            o.ProviderId,
            o.ProviderName,
            o.CostUsd,
            o.Status,
            o.Notes,
            o.StartedAt,
            o.CompletedAt,
            o.CreatedAt
        );
}

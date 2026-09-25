using Ordina.Application.Common;
using Ordina.Application.Notifications;
using Ordina.Domain.Inventory;

namespace Ordina.Application.Inventory;

public class StockReservationService(
    IPhysicalStockRepository stockRepo,
    IRepository<StockReservation> resRepo,
    INotificationService? notificationService = null) : IStockReservationService
{
    public async Task<StockReservationDto> ReserveItemAsync(CreateStockReservationDto dto, CancellationToken ct = default)
    {
        var stock = await stockRepo.GetByIdAsync(dto.StockId, ct)
            ?? throw new InvalidOperationException($"Artículo de stock con id {dto.StockId} no encontrado.");

        var reservedAtomic = await stockRepo.ReserveStockAtomicAsync(dto.StockId, dto.Quantity, ct);
        if (!reservedAtomic)
        {
            throw new InvalidOperationException($"El artículo '{stock.ProductName}' no tiene disponibilidad suficiente o fue apartado concurrentemente.");
        }

        var isFormal = string.Equals(dto.ReservationType, "formal", StringComparison.OrdinalIgnoreCase);
        var durationMinutes = isFormal ? 30 : 10;
        var expiresAt = DateTime.UtcNow.AddMinutes(durationMinutes);

        var reservation = new StockReservation
        {
            StockId = stock.Id,
            ProductId = stock.ProductId,
            ProductName = stock.ProductName,
            LocationId = stock.LocationId,
            LocationName = stock.LocationName,
            VendorId = dto.VendorId,
            VendorName = dto.VendorName,
            Quantity = dto.Quantity,
            ReservationType = isFormal ? "formal" : "counter",
            ExpiresAt = expiresAt,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await resRepo.AddAsync(reservation, ct);
        return MapToDto(created);
    }

    public async Task<StockReservationDto?> GetActiveReservationByStockIdAsync(string stockId, CancellationToken ct = default)
    {
        var active = await resRepo.FindAsync(
            r => r.StockId == stockId && r.Status == "active" && r.ExpiresAt > DateTime.UtcNow,
            ct);

        var res = active.FirstOrDefault();
        return res != null ? MapToDto(res) : null;
    }

    public async Task<IReadOnlyList<StockReservationDto>> GetActiveReservationsAsync(string? vendorId = null, CancellationToken ct = default)
    {
        var active = await resRepo.FindAsync(
            r => r.Status == "active" && r.ExpiresAt > DateTime.UtcNow,
            ct);

        var query = active.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(vendorId))
        {
            query = query.Where(r => string.Equals(r.VendorId, vendorId, StringComparison.OrdinalIgnoreCase));
        }

        return query.OrderByDescending(r => r.CreatedAt).Select(MapToDto).ToList();
    }

    public async Task<bool> ReleaseReservationAsync(string reservationId, CancellationToken ct = default)
    {
        var res = await resRepo.GetByIdAsync(reservationId, ct);
        if (res == null || res.Status != "active") return false;

        res.Status = "released";
        res.UpdatedAt = DateTime.UtcNow;
        await resRepo.UpdateAsync(res, ct);

        await stockRepo.ReleaseStockAtomicAsync(res.StockId, res.Quantity, ct);
        return true;
    }

    public async Task<StockReservationDto?> ExtendReservationAsync(string reservationId, string orderNumber, CancellationToken ct = default)
    {
        var res = await resRepo.GetByIdAsync(reservationId, ct);
        if (res == null || res.Status != "active") return null;

        res.OrderNumber = orderNumber;
        res.ReservationType = "formal";
        res.ExpiresAt = DateTime.UtcNow.AddMinutes(30);
        res.UpdatedAt = DateTime.UtcNow;

        await resRepo.UpdateAsync(res, ct);
        return MapToDto(res);
    }

    public async Task<bool> ConfirmReservationAsync(string reservationId, string orderNumber, CancellationToken ct = default)
    {
        var res = await resRepo.GetByIdAsync(reservationId, ct);
        if (res == null || res.Status != "active") return false;

        var deducted = await stockRepo.DeductSoldStockAtomicAsync(res.StockId, res.Quantity, ct);
        if (!deducted) return false;

        res.Status = "confirmed";
        res.OrderNumber = orderNumber;
        res.UpdatedAt = DateTime.UtcNow;
        await resRepo.UpdateAsync(res, ct);

        // Check if store stock needs replenishment from Terrinca central warehouse
        if (notificationService != null)
        {
            try
            {
                var remaining = await stockRepo.GetByIdAsync(res.StockId, ct);
                if (remaining != null && remaining.LocationType == "store" && remaining.AvailableQuantity <= 1)
                {
                    await notificationService.PublishAsync(new CreateNotificationDto(
                        Type: "inventory.replenishment_needed",
                        Title: "Alerta de Reposición a Depósito Terrinca",
                        Message: $"Stock crítico para '{remaining.ProductName}' en {remaining.LocationName} ({remaining.AvailableQuantity} disponible). Almacén Central Terrinca debe preparar despacho de reposición.",
                        Severity: "warning",
                        Link: "/inventario/transferencias",
                        TargetRoles: new List<string> { "Administrator", "Warehouse Manager", "Store Manager" }
                    ), ct);
                }
            }
            catch
            {
                // ponytail: do not fail order flow if notification publish fails
            }
        }

        return true;
    }

    public async Task<int> CleanupExpiredReservationsAsync(CancellationToken ct = default)
    {
        var expired = await resRepo.FindAsync(
            r => r.Status == "active" && r.ExpiresAt <= DateTime.UtcNow,
            ct);

        int count = 0;
        foreach (var r in expired)
        {
            r.Status = "released";
            r.UpdatedAt = DateTime.UtcNow;
            await resRepo.UpdateAsync(r, ct);
            await stockRepo.ReleaseStockAtomicAsync(r.StockId, r.Quantity, ct);
            count++;
        }

        return count;
    }

    private static StockReservationDto MapToDto(StockReservation r)
    {
        var remainingSeconds = (int)Math.Max(0, (r.ExpiresAt - DateTime.UtcNow).TotalSeconds);
        return new StockReservationDto(
            r.Id,
            r.StockId,
            r.ProductId,
            r.ProductName,
            r.LocationId,
            r.LocationName,
            r.VendorId,
            r.VendorName,
            r.Quantity,
            r.ReservationType,
            r.OrderNumber,
            r.ExpiresAt,
            r.Status,
            remainingSeconds);
    }
}

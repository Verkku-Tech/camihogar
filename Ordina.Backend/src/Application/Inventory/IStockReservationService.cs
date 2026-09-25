namespace Ordina.Application.Inventory;

public interface IStockReservationService
{
    Task<StockReservationDto> ReserveItemAsync(CreateStockReservationDto dto, CancellationToken ct = default);
    Task<StockReservationDto?> GetActiveReservationByStockIdAsync(string stockId, CancellationToken ct = default);
    Task<IReadOnlyList<StockReservationDto>> GetActiveReservationsAsync(string? vendorId = null, CancellationToken ct = default);
    Task<bool> ReleaseReservationAsync(string reservationId, CancellationToken ct = default);
    Task<StockReservationDto?> ExtendReservationAsync(string reservationId, string orderNumber, CancellationToken ct = default);
    Task<bool> ConfirmReservationAsync(string reservationId, string orderNumber, CancellationToken ct = default);
    Task<int> CleanupExpiredReservationsAsync(CancellationToken ct = default);
}

namespace Ordina.Application.Inventory;

public interface IStockTransferService
{
    Task<StockTransferDto> CreateTransferAsync(CreateStockTransferDto dto, CancellationToken ct = default);
    Task<StockTransferDto?> ConfirmTransferAsync(string transferId, string transferredBy, CancellationToken ct = default);
    Task<bool> CancelTransferAsync(string transferId, CancellationToken ct = default);
    Task<IReadOnlyList<StockTransferDto>> GetAllTransfersAsync(string? status = null, string? locationId = null, CancellationToken ct = default);
    Task<StockTransferDto?> GetByIdAsync(string id, CancellationToken ct = default);
}

namespace Ordina.Application.Inventory;

public interface IPhysicalStockService
{
    Task<IReadOnlyList<PhysicalStockDto>> GetStockListAsync(string? locationId = null, string? categoryId = null, string? search = null, bool? onlyAvailable = null, CancellationToken ct = default);
    Task<PhysicalStockDto?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<PhysicalStockDto> AddManualStockAsync(ManualStockEntryDto dto, CancellationToken ct = default);
    Task<StockImportSummaryDto> ImportExcelAsync(Stream fileStream, CancellationToken ct = default);
    Task<byte[]> GenerateExcelTemplateAsync(CancellationToken ct = default);
}

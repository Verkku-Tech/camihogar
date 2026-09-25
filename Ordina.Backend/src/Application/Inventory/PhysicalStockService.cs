using ClosedXML.Excel;
using Ordina.Application.Common;
using Ordina.Domain.Catalog;
using Ordina.Domain.Inventory;
using Ordina.Domain.Stores;

namespace Ordina.Application.Inventory;

public class PhysicalStockService(
    IPhysicalStockRepository stockRepo,
    IProductRepository prodRepo,
    IRepository<Store> storeRepo,
    IRepository<Warehouse> warehouseRepo) : IPhysicalStockService
{
    public async Task<IReadOnlyList<PhysicalStockDto>> GetStockListAsync(
        string? locationId = null,
        string? categoryId = null,
        string? search = null,
        bool? onlyAvailable = null,
        CancellationToken ct = default)
    {
        var all = await stockRepo.GetAllAsync(ct);
        var query = all.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(locationId))
        {
            query = query.Where(s => string.Equals(s.LocationId, locationId, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(categoryId))
        {
            query = query.Where(s => string.Equals(s.CategoryId, categoryId, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(s =>
                s.ProductName.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                s.Sku.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                s.VariantKey.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        if (onlyAvailable == true)
        {
            query = query.Where(s => s.AvailableQuantity > 0);
        }

        return query.OrderBy(s => s.ProductName).ThenBy(s => s.LocationName).Select(MapToDto).ToList();
    }

    public async Task<PhysicalStockDto?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var entity = await stockRepo.GetByIdAsync(id, ct);
        return entity == null ? null : MapToDto(entity);
    }

    public async Task<PhysicalStockDto> AddManualStockAsync(ManualStockEntryDto dto, CancellationToken ct = default)
    {
        var product = await prodRepo.GetByIdAsync(dto.ProductId, ct)
            ?? throw new InvalidOperationException($"Producto con id {dto.ProductId} no encontrado.");

        string locationName;
        if (string.Equals(dto.LocationType, "warehouse", StringComparison.OrdinalIgnoreCase))
        {
            var warehouse = await warehouseRepo.GetByIdAsync(dto.LocationId, ct)
                ?? throw new InvalidOperationException($"Almacén con id {dto.LocationId} no encontrado.");
            locationName = warehouse.Name;
        }
        else
        {
            var store = await storeRepo.GetByIdAsync(dto.LocationId, ct)
                ?? throw new InvalidOperationException($"Tienda con id {dto.LocationId} no encontrada.");
            locationName = store.Name;
        }

        var variantKey = PhysicalStock.BuildVariantKey(dto.Attributes);

        var existingList = await stockRepo.FindAsync(
            s => s.ProductId == dto.ProductId && s.LocationId == dto.LocationId && s.VariantKey == variantKey,
            ct);

        var existing = existingList.FirstOrDefault();

        if (existing != null)
        {
            existing.Quantity += dto.Quantity;
            if (dto.CostUsd > 0) existing.CostUsd = dto.CostUsd;
            if (dto.PriceUsd > 0) existing.PriceUsd = dto.PriceUsd;
            existing.UpdatedAt = DateTime.UtcNow;
            await stockRepo.UpdateAsync(existing, ct);
            return MapToDto(existing);
        }

        var newStock = new PhysicalStock
        {
            ProductId = product.Id,
            ProductName = product.Name,
            Sku = product.SKU,
            CategoryId = product.CategoryId,
            CategoryName = product.Category,
            LocationType = dto.LocationType.ToLowerInvariant(),
            LocationId = dto.LocationId,
            LocationName = locationName,
            Attributes = dto.Attributes ?? new Dictionary<string, string>(),
            VariantKey = variantKey,
            Quantity = dto.Quantity,
            ReservedQuantity = 0,
            PriceUsd = dto.PriceUsd > 0 ? dto.PriceUsd : product.Price,
            CostUsd = dto.CostUsd,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await stockRepo.AddAsync(newStock, ct);
        return MapToDto(created);
    }

    public async Task<StockImportSummaryDto> ImportExcelAsync(Stream fileStream, CancellationToken ct = default)
    {
        var errors = new List<string>();
        int createdCount = 0;
        int updatedCount = 0;
        int totalRows = 0;

        using var workbook = new XLWorkbook(fileStream);
        var worksheet = workbook.Worksheets.FirstOrDefault()
            ?? throw new InvalidOperationException("El archivo Excel no contiene hojas de cálculo.");

        var stores = await storeRepo.GetAllAsync(ct);
        var warehouses = await warehouseRepo.GetAllAsync(ct);
        var products = await prodRepo.GetAllAsync(ct);

        var rowNumber = 2; // Row 1 is header
        while (!worksheet.Row(rowNumber).IsEmpty())
        {
            var row = worksheet.Row(rowNumber);
            totalRows++;

            var sku = row.Cell(1).GetString().Trim();
            var productName = row.Cell(2).GetString().Trim();
            var locationTypeRaw = row.Cell(3).GetString().Trim().ToLowerInvariant();
            var locationIdentifier = row.Cell(4).GetString().Trim();
            var quantityStr = row.Cell(5).GetString().Trim();
            var attributesRaw = row.Cell(6).GetString().Trim();
            var priceStr = row.Cell(7).GetString().Trim();
            var costStr = row.Cell(8).GetString().Trim();

            if (string.IsNullOrWhiteSpace(sku) && string.IsNullOrWhiteSpace(productName))
            {
                errors.Add($"Fila {rowNumber}: SKU o Nombre de Producto requerido.");
                rowNumber++;
                continue;
            }

            var product = products.FirstOrDefault(p =>
                (!string.IsNullOrWhiteSpace(sku) && string.Equals(p.SKU, sku, StringComparison.OrdinalIgnoreCase)) ||
                string.Equals(p.Name, productName, StringComparison.OrdinalIgnoreCase));

            if (product == null)
            {
                errors.Add($"Fila {rowNumber}: No se encontró el producto '{sku ?? productName}' en el catálogo.");
                rowNumber++;
                continue;
            }

            string locationType = locationTypeRaw.Contains("almac") ? "warehouse" : "store";
            string locationId;
            string locationName;

            if (locationType == "warehouse")
            {
                var warehouse = warehouses.FirstOrDefault(w =>
                    string.Equals(w.Code, locationIdentifier, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(w.Name, locationIdentifier, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(w.Id, locationIdentifier, StringComparison.OrdinalIgnoreCase));

                if (warehouse == null)
                {
                    errors.Add($"Fila {rowNumber}: Almacén '{locationIdentifier}' no encontrado.");
                    rowNumber++;
                    continue;
                }
                locationId = warehouse.Id;
                locationName = warehouse.Name;
            }
            else
            {
                var store = stores.FirstOrDefault(s =>
                    string.Equals(s.Name, locationIdentifier, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(s.Id, locationIdentifier, StringComparison.OrdinalIgnoreCase));

                if (store == null)
                {
                    errors.Add($"Fila {rowNumber}: Tienda '{locationIdentifier}' no encontrada.");
                    rowNumber++;
                    continue;
                }
                locationId = store.Id;
                locationName = store.Name;
            }

            if (!int.TryParse(quantityStr, out var quantity) || quantity < 0)
            {
                errors.Add($"Fila {rowNumber}: Cantidad inválida '{quantityStr}'.");
                rowNumber++;
                continue;
            }

            decimal.TryParse(priceStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var price);
            decimal.TryParse(costStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var cost);

            var attrs = ParseAttributes(attributesRaw);
            var variantKey = PhysicalStock.BuildVariantKey(attrs);

            var existingList = await stockRepo.FindAsync(
                s => s.ProductId == product.Id && s.LocationId == locationId && s.VariantKey == variantKey,
                ct);

            var existing = existingList.FirstOrDefault();

            if (existing != null)
            {
                existing.Quantity += quantity;
                if (price > 0) existing.PriceUsd = price;
                if (cost > 0) existing.CostUsd = cost;
                existing.UpdatedAt = DateTime.UtcNow;
                await stockRepo.UpdateAsync(existing, ct);
                updatedCount++;
            }
            else
            {
                var newEntity = new PhysicalStock
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    Sku = product.SKU,
                    CategoryId = product.CategoryId,
                    CategoryName = product.Category,
                    LocationType = locationType,
                    LocationId = locationId,
                    LocationName = locationName,
                    Attributes = attrs,
                    VariantKey = variantKey,
                    Quantity = quantity,
                    ReservedQuantity = 0,
                    PriceUsd = price > 0 ? price : product.Price,
                    CostUsd = cost,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await stockRepo.AddAsync(newEntity, ct);
                createdCount++;
            }

            rowNumber++;
        }

        return new StockImportSummaryDto(totalRows, createdCount, updatedCount, errors);
    }

    public Task<byte[]> GenerateExcelTemplateAsync(CancellationToken ct = default)
    {
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Existencias");

        ws.Cell(1, 1).Value = "SKU";
        ws.Cell(1, 2).Value = "Nombre Producto";
        ws.Cell(1, 3).Value = "Tipo Sede (Tienda/Almacén)";
        ws.Cell(1, 4).Value = "Código o Nombre Sede";
        ws.Cell(1, 5).Value = "Cantidad";
        ws.Cell(1, 6).Value = "Atributos (Tela=Lino, Color=Gris, Medida=2x2)";
        ws.Cell(1, 7).Value = "Precio USD";
        ws.Cell(1, 8).Value = "Costo USD";

        var headerRow = ws.Row(1);
        headerRow.Style.Font.Bold = true;
        headerRow.Style.Fill.BackgroundColor = XLColor.FromHtml("#0284C7");
        headerRow.Style.Font.FontColor = XLColor.White;

        // Sample rows
        ws.Cell(2, 1).Value = "TUR-01";
        ws.Cell(2, 2).Value = "Cama Turín";
        ws.Cell(2, 3).Value = "Tienda";
        ws.Cell(2, 4).Value = "Tienda Guatire";
        ws.Cell(2, 5).Value = 2;
        ws.Cell(2, 6).Value = "Tela=Lino, Color=Gris, Medida=2x2";
        ws.Cell(2, 7).Value = 350.00;
        ws.Cell(2, 8).Value = 180.00;

        ws.Cell(3, 1).Value = "TUR-01";
        ws.Cell(3, 2).Value = "Cama Turín";
        ws.Cell(3, 3).Value = "Almacén";
        ws.Cell(3, 4).Value = "TERR-01";
        ws.Cell(3, 5).Value = 8;
        ws.Cell(3, 6).Value = "Tela=Lino, Color=Beige, Medida=2x2";
        ws.Cell(3, 7).Value = 350.00;
        ws.Cell(3, 8).Value = 180.00;

        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return Task.FromResult(ms.ToArray());
    }

    private static Dictionary<string, string> ParseAttributes(string raw)
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(raw)) return dict;

        var parts = raw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            var kv = part.Split('=');
            if (kv.Length == 2)
            {
                var k = kv[0].Trim();
                var v = kv[1].Trim();
                if (!string.IsNullOrEmpty(k) && !string.IsNullOrEmpty(v))
                {
                    dict[k] = v;
                }
            }
        }
        return dict;
    }

    private static PhysicalStockDto MapToDto(PhysicalStock s) =>
        new(
            s.Id,
            s.ProductId,
            s.ProductName,
            s.Sku,
            s.CategoryId,
            s.CategoryName,
            s.LocationType,
            s.LocationId,
            s.LocationName,
            s.Attributes,
            s.VariantKey,
            s.Quantity,
            s.ReservedQuantity,
            s.AvailableQuantity,
            s.PriceUsd,
            s.CostUsd,
            s.UpdatedAt ?? s.CreatedAt);
}

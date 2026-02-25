using ClosedXML.Excel;
using Microsoft.Extensions.Logging;
using Ordina.Database.Entities.Category;
using Ordina.Database.Entities.Product;
using Ordina.Database.Repositories;
using Ordina.Providers.Application.DTOs;

namespace Ordina.Providers.Application.Services;

public class ImportService : IImportService
{
    private readonly ICategoryRepository _categoryRepository;
    private readonly IProductRepository _productRepository;
    private readonly ILogger<ImportService> _logger;

    private const int ColProduct = 2;    // Columna B
    private const int ColAttribute = 3;  // Columna C
    private const int ColValue = 4;      // Columna D
    private const int ColPrice = 5;      // Columna E

    private static readonly HashSet<string> HeaderKeywords = new(StringComparer.OrdinalIgnoreCase)
    {
        "PRODUCTO", "PRODUCTOS", "CATEGORIAS", "CATEGORIA", "ATRIBUTOS", "ATRIBUTO"
    };

    private static readonly HashSet<string> IgnoredProductNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "PRODUCTO", "PRODUCTOS", "CATEGORIAS", "CATEGORIA", "ATRIBUTOS", "ATRIBUTO",
        "VALOR DEL ATRIBUTO", "VALOR", "PRECIO"
    };

    public ImportService(
        ICategoryRepository categoryRepository,
        IProductRepository productRepository,
        ILogger<ImportService> logger)
    {
        _categoryRepository = categoryRepository;
        _productRepository = productRepository;
        _logger = logger;
    }

    public async Task<ImportProductsResultDto> ImportProductsFromExcelAsync(Stream fileStream, string currency)
    {
        var result = new ImportProductsResultDto();

        using var workbook = new XLWorkbook(fileStream);
        result.TotalSheets = workbook.Worksheets.Count;

        foreach (var worksheet in workbook.Worksheets)
        {
            var sheetResult = new SheetImportResultDto
            {
                SheetName = worksheet.Name.Trim()
            };

            try
            {
                await ProcessWorksheetAsync(worksheet, sheetResult, result, currency);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error crítico procesando hoja '{SheetName}'", worksheet.Name);
                sheetResult.Errors.Add($"Error crítico: {ex.Message}");
            }

            result.Sheets.Add(sheetResult);
        }

        return result;
    }

    private async Task ProcessWorksheetAsync(
        IXLWorksheet worksheet,
        SheetImportResultDto sheetResult,
        ImportProductsResultDto globalResult,
        string currency)
    {
        var categoryName = sheetResult.SheetName;
        var headerRow = DetectHeaderRow(worksheet);
        var dataStartRow = headerRow + 1;

        _logger.LogInformation(
            "Hoja '{SheetName}': header en fila {Header}, datos desde fila {DataStart}",
            categoryName, headerRow, dataStartRow);

        var rows = ParseWorksheetRows(worksheet, dataStartRow);
        if (rows.Count == 0)
        {
            _logger.LogWarning("Hoja '{SheetName}' sin filas de datos válidas — omitida", categoryName);
            return;
        }

        var (category, categoryCreated) = await GetOrCreateCategoryAsync(categoryName);
        sheetResult.CategoryId = category.Id;
        sheetResult.CategoryCreated = categoryCreated;

        var (updatedCategory, categoryChanged, valuesAdded) =
            await MergeCategoryAttributesAsync(category, rows, currency);
        sheetResult.CategoryUpdated = categoryChanged && !categoryCreated;
        sheetResult.ValuesAdded = valuesAdded;

        if (categoryCreated)
            globalResult.TotalCategoriesCreated++;
        else if (categoryChanged)
            globalResult.TotalCategoriesUpdated++;
        globalResult.TotalValuesAdded += valuesAdded;

        var (productsCreated, productsSkipped) =
            await CreateProductsAsync(updatedCategory, rows, currency);
        sheetResult.ProductsCreated = productsCreated;
        sheetResult.ProductsSkipped = productsSkipped;
        globalResult.TotalProductsCreated += productsCreated;
        globalResult.TotalProductsSkipped += productsSkipped;
    }

    /// <summary>
    /// Recorre las primeras filas buscando una que contenga palabras clave de encabezado.
    /// </summary>
    private int DetectHeaderRow(IXLWorksheet worksheet)
    {
        for (int row = 1; row <= 10; row++)
        {
            for (int col = 1; col <= 5; col++)
            {
                var cellText = worksheet.Cell(row, col).GetString().Trim();
                if (HeaderKeywords.Contains(cellText))
                    return row;
            }
        }
        return 3;
    }

    private List<ExcelRowData> ParseWorksheetRows(IXLWorksheet worksheet, int dataStartRow)
    {
        var rows = new List<ExcelRowData>();
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 0;

        if (lastRow < dataStartRow) return rows;

        string currentAttributeTitle = string.Empty;
        List<string> currentProducts = new();

        for (int rowNum = dataStartRow; rowNum <= lastRow; rowNum++)
        {
            var colB = worksheet.Cell(rowNum, ColProduct).GetString().Trim();
            if (!string.IsNullOrWhiteSpace(colB))
            {
                var parsed = colB
                    .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrWhiteSpace(p) && !IsIgnoredName(p))
                    .ToList();

                if (parsed.Count > 0)
                    currentProducts = parsed;
            }

            var colC = worksheet.Cell(rowNum, ColAttribute).GetString().Trim();
            if (!string.IsNullOrWhiteSpace(colC) && !IsIgnoredName(colC))
                currentAttributeTitle = colC;

            var valueLabel = worksheet.Cell(rowNum, ColValue).GetString().Trim();
            if (string.IsNullOrWhiteSpace(valueLabel) || IsIgnoredName(valueLabel))
                continue;

            decimal priceAdjustment = 0;
            var priceCell = worksheet.Cell(rowNum, ColPrice);
            if (priceCell.TryGetValue(out decimal priceVal))
                priceAdjustment = priceVal;
            else
            {
                var priceStr = priceCell.GetString().Trim();
                if (!string.IsNullOrWhiteSpace(priceStr))
                    decimal.TryParse(priceStr, out priceAdjustment);
            }

            rows.Add(new ExcelRowData(
                rowNum,
                new List<string>(currentProducts),
                currentAttributeTitle,
                valueLabel,
                priceAdjustment));
        }

        return rows;
    }

    private async Task<(Category category, bool created)> GetOrCreateCategoryAsync(string name)
    {
        var existing = await _categoryRepository.GetByNameAsync(name);
        if (existing != null)
            return (existing, false);

        var newCategory = new Category
        {
            Name = name,
            Description = name,
            MaxDiscount = 0,
            Attributes = new List<CategoryAttribute>(),
            Products = 0,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _categoryRepository.CreateAsync(newCategory);
        _logger.LogInformation("Categoría '{Name}' creada durante importación", name);
        return (created, true);
    }

    private async Task<(Category category, bool changed, int valuesAdded)> MergeCategoryAttributesAsync(
        Category category,
        List<ExcelRowData> rows,
        string currency)
    {
        bool changed = false;
        int valuesAdded = 0;

        var groups = rows
            .Where(r => !string.IsNullOrWhiteSpace(r.AttributeTitle))
            .GroupBy(r => r.AttributeTitle, StringComparer.OrdinalIgnoreCase);

        foreach (var group in groups)
        {
            var title = group.Key;

            var attr = category.Attributes
                .FirstOrDefault(a => string.Equals(a.Title, title, StringComparison.OrdinalIgnoreCase));

            if (attr == null)
            {
                attr = new CategoryAttribute
                {
                    Id = Guid.NewGuid().ToString(),
                    Title = title,
                    Description = title,
                    ValueType = "Select",
                    Required = false,
                    Values = new List<AttributeValue>()
                };
                category.Attributes.Add(attr);
                changed = true;
            }

            foreach (var row in group)
            {
                var existingValue = attr.Values.FirstOrDefault(v =>
                    string.Equals(v.Label, row.ValueLabel, StringComparison.OrdinalIgnoreCase));

                if (existingValue == null)
                {
                    attr.Values.Add(new AttributeValue
                    {
                        Id = Guid.NewGuid().ToString(),
                        Label = row.ValueLabel,
                        IsDefault = false,
                        PriceAdjustment = row.PriceAdjustment,
                        PriceAdjustmentCurrency = currency
                    });
                    changed = true;
                    valuesAdded++;
                }
                else if (existingValue.PriceAdjustment != row.PriceAdjustment ||
                         existingValue.PriceAdjustmentCurrency != currency)
                {
                    existingValue.PriceAdjustment = row.PriceAdjustment;
                    existingValue.PriceAdjustmentCurrency = currency;
                    changed = true;
                }
            }
        }

        if (changed)
        {
            category.UpdatedAt = DateTime.UtcNow;
            category = await _categoryRepository.UpdateAsync(category);
            _logger.LogInformation(
                "Atributos de categoría '{Name}' actualizados ({ValuesAdded} valores agregados)",
                category.Name, valuesAdded);
        }

        return (category, changed, valuesAdded);
    }

    private async Task<(int created, int skipped)> CreateProductsAsync(
        Category category,
        List<ExcelRowData> rows,
        string currency)
    {
        var uniqueNames = rows
            .SelectMany(r => r.ProductNames)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        int created = 0;
        int skipped = 0;

        foreach (var productName in uniqueNames)
        {
            var existing = await _productRepository.GetByNameAndCategoryIdAsync(productName, category.Id);
            if (existing != null)
            {
                skipped++;
                continue;
            }

            var sku = GenerateSku(category.Name, productName);

            if (await _productRepository.SkuExistsAsync(sku))
                sku = $"{sku}-{Guid.NewGuid().ToString("N")[..6]}";

            var product = new Product
            {
                Name = productName,
                CategoryId = category.Id,
                Category = category.Name,
                Price = 0,
                PriceCurrency = currency,
                Stock = 0,
                Status = "active",
                SKU = sku,
                Description = $"{productName} — {category.Name}",
                CreatedAt = DateTime.UtcNow
            };

            await _productRepository.CreateAsync(product);
            created++;

            _logger.LogInformation(
                "Producto '{ProductName}' creado en categoría '{Category}' (SKU: {Sku})",
                productName, category.Name, sku);
        }

        // Actualizar el conteo de productos en la categoría
        if (created > 0)
        {
            category.Products += created;
            category.UpdatedAt = DateTime.UtcNow;
            await _categoryRepository.UpdateAsync(category);
        }

        return (created, skipped);
    }

    private static string GenerateSku(string category, string product)
    {
        var raw = $"{category}-{product}"
            .ToUpperInvariant()
            .Replace(" ", "-")
            .Replace("/", "-")
            .Replace("--", "-")
            .Trim('-');

        return raw.Length > 100 ? raw[..100] : raw;
    }

    private static bool IsIgnoredName(string value)
    {
        if (IgnoredProductNames.Contains(value))
            return true;

        var upper = value.ToUpperInvariant();
        return upper.StartsWith("OJO ") || upper.Contains("IMAGEN DE REFERENCIA");
    }

    private sealed record ExcelRowData(
        int RowNumber,
        List<string> ProductNames,
        string AttributeTitle,
        string ValueLabel,
        decimal PriceAdjustment);
}

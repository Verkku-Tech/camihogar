using ClosedXML.Excel;
using Microsoft.Extensions.Logging;
using Ordina.Database.Entities.Category;
using Ordina.Database.Repositories;
using Ordina.Providers.Application.DTOs;

namespace Ordina.Providers.Application.Services;

public class ImportService : IImportService
{
    private readonly ICategoryRepository _categoryRepository;
    private readonly ILogger<ImportService> _logger;

    private const int ColAttribute = 3;
    private const int ColValue = 4;
    private const int DataStartRow = 4;

    public ImportService(
        ICategoryRepository categoryRepository,
        ILogger<ImportService> logger)
    {
        _categoryRepository = categoryRepository;
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
                await ProcessWorksheetAsync(worksheet, sheetResult, result);
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
        ImportProductsResultDto globalResult)
    {
        var categoryName = sheetResult.SheetName;

        var rows = ParseWorksheetRows(worksheet);
        if (rows.Count == 0)
        {
            _logger.LogWarning("Hoja '{SheetName}' sin filas de datos válidas — omitida", categoryName);
            return;
        }

        var (category, categoryCreated) = await GetOrCreateCategoryAsync(categoryName);
        sheetResult.CategoryId = category.Id;
        sheetResult.CategoryCreated = categoryCreated;

        var (updatedCategory, categoryChanged, valuesAdded) = await MergeCategoryAttributesAsync(category, rows);
        sheetResult.CategoryUpdated = categoryChanged && !categoryCreated;
        sheetResult.ValuesAdded = valuesAdded;

        if (categoryCreated)
            globalResult.TotalCategoriesCreated++;
        else if (categoryChanged)
            globalResult.TotalCategoriesUpdated++;

        globalResult.TotalValuesAdded += valuesAdded;
    }

    private List<ExcelRowData> ParseWorksheetRows(IXLWorksheet worksheet)
    {
        var rows = new List<ExcelRowData>();
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 0;

        if (lastRow < DataStartRow) return rows;

        string currentAttributeTitle = string.Empty;

        for (int rowNum = DataStartRow; rowNum <= lastRow; rowNum++)
        {
            var colC = worksheet.Cell(rowNum, ColAttribute).GetString().Trim();
            if (!string.IsNullOrWhiteSpace(colC))
                currentAttributeTitle = colC;

            var valueLabel = worksheet.Cell(rowNum, ColValue).GetString().Trim();
            if (string.IsNullOrWhiteSpace(valueLabel)) continue;

            rows.Add(new ExcelRowData(rowNum, currentAttributeTitle, valueLabel));
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
        List<ExcelRowData> rows)
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
                var exists = attr.Values.Any(v =>
                    string.Equals(v.Label, row.ValueLabel, StringComparison.OrdinalIgnoreCase));

                if (!exists)
                {
                    attr.Values.Add(new AttributeValue
                    {
                        Id = Guid.NewGuid().ToString(),
                        Label = row.ValueLabel,
                        IsDefault = false
                    });
                    changed = true;
                    valuesAdded++;
                }
            }
        }

        if (changed)
        {
            category.UpdatedAt = DateTime.UtcNow;
            category = await _categoryRepository.UpdateAsync(category);
            _logger.LogInformation("Atributos de categoría '{Name}' actualizados ({ValuesAdded} valores agregados)", category.Name, valuesAdded);
        }

        return (category, changed, valuesAdded);
    }

    private sealed record ExcelRowData(
        int RowNumber,
        string AttributeTitle,
        string ValueLabel);
}

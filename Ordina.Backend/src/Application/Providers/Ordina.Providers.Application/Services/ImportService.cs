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

    // Nombres esperados de las hojas
    private const string SheetSchema = "ESQUEMA_CATEGORIAS";
    private const string SheetValues = "VALORES_Y_PRECIOS";
    private const string SheetProducts = "PRODUCTOS_FINALES";

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

        // ── Fase 1: Parsear las 3 hojas ──────────────────────────────────
        var schemaRows = ParseSchemaSheet(workbook);
        var valueRows = ParseValuesSheet(workbook);
        var productRows = ParseProductsSheet(workbook);

        _logger.LogInformation(
            "Importación: {Schema} filas de esquema, {Values} filas de valores, {Products} filas de productos",
            schemaRows.Count, valueRows.Count, productRows.Count);

        // ── Fase 2: Ordenar categorías por dependencias ──────────────────
        var categoryOrder = TopologicalSortCategories(schemaRows, valueRows);
        _logger.LogInformation("Orden de creación de categorías: {Order}",
            string.Join(" → ", categoryOrder));

        // Acumular categorías creadas para poder resolver ProductId después
        var categoryMap = new Dictionary<string, Category>(StringComparer.OrdinalIgnoreCase);

        // ── Fase 3: Crear categorías con atributos y valores ─────────────
        foreach (var categoryName in categoryOrder)
        {
            var sheetResult = new SheetImportResultDto
            {
                SheetName = categoryName
            };

            try
            {
                await ProcessCategoryAsync(
                    categoryName, schemaRows, valueRows,
                    categoryMap, sheetResult, result, currency);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando categoría '{Category}'", categoryName);
                sheetResult.Errors.Add($"Error crítico: {ex.Message}");
            }

            result.Sheets.Add(sheetResult);
        }

        // ── Fase 4: Crear productos finales ──────────────────────────────
        var productSheetResult = new SheetImportResultDto
        {
            SheetName = "PRODUCTOS_FINALES"
        };

        try
        {
            await CreateFinalProductsAsync(
                productRows, categoryMap, valueRows,
                productSheetResult, result, currency);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creando productos finales");
            productSheetResult.Errors.Add($"Error crítico: {ex.Message}");
        }

        if (productSheetResult.ProductsCreated > 0 || productSheetResult.ProductsSkipped > 0 || productSheetResult.Errors.Count > 0)
        {
            result.Sheets.Add(productSheetResult);
        }

        return result;
    }

    // ════════════════════════════════════════════════════════════════════
    //  FASE 1: Parseo de hojas
    // ════════════════════════════════════════════════════════════════════

    private List<SchemaRow> ParseSchemaSheet(XLWorkbook workbook)
    {
        var rows = new List<SchemaRow>();
        var ws = FindSheet(workbook, SheetSchema);
        if (ws == null) return rows;

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
        for (int r = 2; r <= lastRow; r++) // fila 1 = header
        {
            var category = ws.Cell(r, 1).GetString().Trim();
            var attribute = ws.Cell(r, 2).GetString().Trim();
            var dataType = ws.Cell(r, 3).GetString().Trim();
            var required = ws.Cell(r, 4).GetString().Trim();
            var nestedProduct = ws.Cell(r, 5).GetString().Trim();

            if (string.IsNullOrWhiteSpace(category) || string.IsNullOrWhiteSpace(attribute))
                continue;

            rows.Add(new SchemaRow(category, attribute, dataType, required, nestedProduct));
        }

        return rows;
    }

    private List<ValueRow> ParseValuesSheet(XLWorkbook workbook)
    {
        var rows = new List<ValueRow>();
        var ws = FindSheet(workbook, SheetValues);
        if (ws == null) return rows;

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
        for (int r = 2; r <= lastRow; r++)
        {
            var category = ws.Cell(r, 1).GetString().Trim();
            var attribute = ws.Cell(r, 2).GetString().Trim();
            var valueOption = ws.Cell(r, 3).GetString().Trim();

            decimal priceAlteration = 0;
            var priceCell = ws.Cell(r, 4);
            if (priceCell.TryGetValue(out decimal priceVal))
                priceAlteration = priceVal;
            else
            {
                var priceStr = priceCell.GetString().Trim();
                if (!string.IsNullOrWhiteSpace(priceStr))
                    decimal.TryParse(priceStr, out priceAlteration);
            }

            if (string.IsNullOrWhiteSpace(category) || string.IsNullOrWhiteSpace(attribute))
                continue;

            rows.Add(new ValueRow(category, attribute, valueOption, priceAlteration));
        }

        return rows;
    }

    private List<ProductRow> ParseProductsSheet(XLWorkbook workbook)
    {
        var rows = new List<ProductRow>();
        var ws = FindSheet(workbook, SheetProducts);
        if (ws == null) return rows;

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
        for (int r = 2; r <= lastRow; r++)
        {
            var category = ws.Cell(r, 1).GetString().Trim();
            var sku = ws.Cell(r, 2).GetString().Trim();
            var name = ws.Cell(r, 3).GetString().Trim();

            decimal priceBase = 0;
            var priceCell = ws.Cell(r, 4);
            if (priceCell.TryGetValue(out decimal priceVal))
                priceBase = priceVal;

            var fixedValues = ws.Cell(r, 5).GetString().Trim();

            if (string.IsNullOrWhiteSpace(category) || string.IsNullOrWhiteSpace(name))
                continue;

            rows.Add(new ProductRow(category, sku, name, priceBase, fixedValues));
        }

        return rows;
    }

    private IXLWorksheet? FindSheet(XLWorkbook workbook, string name)
    {
        // Buscar por nombre exacto o parcial (case-insensitive)
        var ws = workbook.Worksheets.FirstOrDefault(w =>
            string.Equals(w.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));

        if (ws == null)
        {
            // Buscar por coincidencia parcial
            ws = workbook.Worksheets.FirstOrDefault(w =>
                w.Name.Trim().Contains(name, StringComparison.OrdinalIgnoreCase) ||
                name.Contains(w.Name.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        if (ws == null)
            _logger.LogWarning("Hoja '{SheetName}' no encontrada en el archivo Excel", name);

        return ws;
    }

    // ════════════════════════════════════════════════════════════════════
    //  FASE 2: Orden topológico de categorías
    // ════════════════════════════════════════════════════════════════════

    private List<string> TopologicalSortCategories(
        List<SchemaRow> schemaRows,
        List<ValueRow> valueRows)
    {
        // Obtener todas las categorías únicas (de esquema + valores)
        var allCategories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in schemaRows)
            allCategories.Add(row.Category);
        foreach (var row in valueRows)
            allCategories.Add(row.Category);

        // Construir grafo de dependencias: categoría → depende de categorías anidadas
        var dependsOn = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var cat in allCategories)
            dependsOn[cat] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in schemaRows)
        {
            if (!string.IsNullOrWhiteSpace(row.NestedProduct) &&
                allCategories.Contains(row.NestedProduct))
            {
                dependsOn[row.Category].Add(row.NestedProduct);
            }
        }

        // Topological sort (Kahn's algorithm)
        var inDegree = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var cat in allCategories)
            inDegree[cat] = 0;

        foreach (var entry in dependsOn)
        {
            foreach (var dep in entry.Value)
            {
                // entry.Key depende de dep, así que dep debe venir primero
                // Esto no afecta el inDegree del dep, sino del que depende
            }
        }

        // Calcular in-degree: cuántas categorías dependen de cada una
        // En realidad, queremos: para cada categoría, cuántas dependencias tiene
        // Las categorías sin dependencias van primero
        var sorted = new List<string>();
        var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var visiting = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void Visit(string cat)
        {
            if (visited.Contains(cat)) return;
            if (visiting.Contains(cat))
            {
                _logger.LogWarning("Dependencia circular detectada en categoría '{Category}'", cat);
                return;
            }

            visiting.Add(cat);

            if (dependsOn.TryGetValue(cat, out var deps))
            {
                foreach (var dep in deps)
                    Visit(dep);
            }

            visiting.Remove(cat);
            visited.Add(cat);
            sorted.Add(cat);
        }

        foreach (var cat in allCategories)
            Visit(cat);

        return sorted;
    }

    // ════════════════════════════════════════════════════════════════════
    //  FASE 3: Crear categorías con atributos y valores
    // ════════════════════════════════════════════════════════════════════

    private async Task ProcessCategoryAsync(
        string categoryName,
        List<SchemaRow> allSchemaRows,
        List<ValueRow> allValueRows,
        Dictionary<string, Category> categoryMap,
        SheetImportResultDto sheetResult,
        ImportProductsResultDto globalResult,
        string currency)
    {
        // Obtener o crear la categoría
        var (category, categoryCreated) = await GetOrCreateCategoryAsync(categoryName);
        sheetResult.CategoryId = category.Id;
        sheetResult.CategoryCreated = categoryCreated;

        if (categoryCreated)
            globalResult.TotalCategoriesCreated++;

        // Obtener las filas de esquema para esta categoría
        var schemaForCategory = allSchemaRows
            .Where(r => string.Equals(r.Category, categoryName, StringComparison.OrdinalIgnoreCase))
            .ToList();

        // Obtener las filas de valores para esta categoría
        var valuesForCategory = allValueRows
            .Where(r => string.Equals(r.Category, categoryName, StringComparison.OrdinalIgnoreCase))
            .ToList();

        bool categoryChanged = false;
        int valuesAdded = 0;

        if (schemaForCategory.Count > 0)
        {
            // Categoría definida en ESQUEMA_CATEGORIAS — usar esquema explícito
            foreach (var schemaRow in schemaForCategory)
            {
                var (changed, added) = MergeAttribute(
                    category, schemaRow, valuesForCategory,
                    categoryMap, currency);
                if (changed) categoryChanged = true;
                valuesAdded += added;
            }
        }
        else if (valuesForCategory.Count > 0)
        {
            // Categoría solo en VALORES_Y_PRECIOS — inferir atributos
            var attributeGroups = valuesForCategory
                .GroupBy(v => v.Attribute, StringComparer.OrdinalIgnoreCase);

            foreach (var group in attributeGroups)
            {
                var inferredSchema = new SchemaRow(
                    categoryName, group.Key, "seleccion", "SI", "");

                var (changed, added) = MergeAttribute(
                    category, inferredSchema, valuesForCategory,
                    categoryMap, currency);
                if (changed) categoryChanged = true;
                valuesAdded += added;
            }
        }

        if (categoryChanged)
        {
            if (!categoryCreated) sheetResult.CategoryUpdated = true;
            if (!categoryCreated) globalResult.TotalCategoriesUpdated++;

            category.UpdatedAt = DateTime.UtcNow;
            category = await _categoryRepository.UpdateAsync(category);
            _logger.LogInformation(
                "Categoría '{Name}' actualizada ({ValuesAdded} valores)",
                category.Name, valuesAdded);
        }

        sheetResult.ValuesAdded = valuesAdded;
        globalResult.TotalValuesAdded += valuesAdded;

        // Almacenar en mapa para resolver dependencias
        categoryMap[categoryName] = category;
    }

    /// <summary>
    /// Mapea Tipo_Dato del Excel al ValueType del modelo.
    /// </summary>
    private static string MapValueType(string tipoDato) => tipoDato.ToLowerInvariant() switch
    {
        "seleccion" => "Select",
        "seleccion_multiple" => "Multiple select",
        "producto" => "Product",
        "numerico" => "Number",
        _ => "Select"
    };

    /// <summary>
    /// Merge un atributo (del esquema) con sus valores correspondientes sobre la categoría.
    /// </summary>
    private (bool changed, int valuesAdded) MergeAttribute(
        Category category,
        SchemaRow schema,
        List<ValueRow> allValuesForCategory,
        Dictionary<string, Category> categoryMap,
        string currency)
    {
        bool changed = false;
        int valuesAdded = 0;

        var valueType = MapValueType(schema.DataType);
        var isRequired = string.Equals(schema.Required, "SI", StringComparison.OrdinalIgnoreCase);

        // Buscar atributo existente
        var attr = category.Attributes
            .FirstOrDefault(a => string.Equals(a.Title, schema.Attribute, StringComparison.OrdinalIgnoreCase));

        if (attr == null)
        {
            attr = new CategoryAttribute
            {
                Id = Guid.NewGuid().ToString(),
                Title = schema.Attribute,
                Description = schema.Attribute,
                ValueType = valueType,
                Required = isRequired,
                Values = new List<AttributeValue>()
            };
            category.Attributes.Add(attr);
            changed = true;
        }
        else
        {
            // Actualizar tipo y requerido si cambió
            if (attr.ValueType != valueType)
            {
                attr.ValueType = valueType;
                changed = true;
            }
            if (attr.Required != isRequired)
            {
                attr.Required = isRequired;
                changed = true;
            }
        }

        // Agregar valores de VALORES_Y_PRECIOS
        var valuesForAttribute = allValuesForCategory
            .Where(v => string.Equals(v.Attribute, schema.Attribute, StringComparison.OrdinalIgnoreCase))
            .ToList();

        foreach (var valueRow in valuesForAttribute)
        {
            var existingValue = attr.Values.FirstOrDefault(v =>
                string.Equals(v.Label, valueRow.ValueOption, StringComparison.OrdinalIgnoreCase));

            if (existingValue == null)
            {
                var newValue = new AttributeValue
                {
                    Id = Guid.NewGuid().ToString(),
                    Label = valueRow.ValueOption,
                    IsDefault = false,
                    PriceAdjustment = valueRow.PriceAlteration,
                    PriceAdjustmentCurrency = currency
                };

                // Si el atributo es tipo Product, intentar resolver ProductId
                if (valueType == "Product" && !string.IsNullOrWhiteSpace(schema.NestedProduct))
                {
                    newValue.ProductId = ResolveProductId(
                        schema.NestedProduct, valueRow.ValueOption, categoryMap);
                }

                attr.Values.Add(newValue);
                changed = true;
                valuesAdded++;
            }
            else
            {
                // Actualizar precio si cambió
                if (existingValue.PriceAdjustment != valueRow.PriceAlteration ||
                    existingValue.PriceAdjustmentCurrency != currency)
                {
                    existingValue.PriceAdjustment = valueRow.PriceAlteration;
                    existingValue.PriceAdjustmentCurrency = currency;
                    changed = true;
                }

                // Actualizar ProductId si es tipo Product y no tiene
                if (valueType == "Product" &&
                    string.IsNullOrWhiteSpace(existingValue.ProductId) &&
                    !string.IsNullOrWhiteSpace(schema.NestedProduct))
                {
                    existingValue.ProductId = ResolveProductId(
                        schema.NestedProduct, valueRow.ValueOption, categoryMap);
                    if (!string.IsNullOrWhiteSpace(existingValue.ProductId))
                        changed = true;
                }
            }
        }

        return (changed, valuesAdded);
    }

    /// <summary>
    /// Busca un producto en la categoría anidada por nombre.
    /// Retorna null si no se encuentra (ej: "Sin Copete" no tiene producto).
    /// </summary>
    private string? ResolveProductId(
        string nestedCategoryName,
        string valueLabel,
        Dictionary<string, Category> categoryMap)
    {
        // Buscar la categoría anidada
        if (!categoryMap.TryGetValue(nestedCategoryName, out var nestedCategory))
            return null;

        // Buscar un producto en esa categoría cuyo nombre contenga el label
        var product = _productRepository.GetByNameAndCategoryIdAsync(
            valueLabel, nestedCategory.Id).Result;

        if (product != null)
            return product.Id;

        // Intentar búsqueda parcial: si el label del valor coincide con parte del nombre del producto
        // Por ejemplo: valor "Ítalo" podría matchear producto "Copete Ítalo Individual"
        // Esto se resuelve a null si no hay match — es una opción sin producto (ej: "Sin Copete")
        _logger.LogDebug(
            "No se encontró producto '{Label}' en categoría '{Category}' — valor sin ProductId",
            valueLabel, nestedCategoryName);

        return null;
    }

    // ════════════════════════════════════════════════════════════════════
    //  FASE 4: Crear productos finales
    // ════════════════════════════════════════════════════════════════════

    private async Task CreateFinalProductsAsync(
        List<ProductRow> productRows,
        Dictionary<string, Category> categoryMap,
        List<ValueRow> allValueRows,
        SheetImportResultDto sheetResult,
        ImportProductsResultDto globalResult,
        string currency)
    {
        foreach (var row in productRows)
        {
            try
            {
                // Resolver categoría
                if (!categoryMap.TryGetValue(row.Category, out var category))
                {
                    // Intentar buscar en BD si no está en el mapa
                    category = await _categoryRepository.GetByNameAsync(row.Category);
                    if (category == null)
                    {
                        sheetResult.Errors.Add(
                            $"Categoría '{row.Category}' no encontrada para producto '{row.Name}'");
                        continue;
                    }
                    categoryMap[row.Category] = category;
                }

                // Parsear valores fijos y calcular precio
                var attributes = ParseFixedValues(row.FixedValues);
                var calculatedPrice = CalculatePrice(
                    row.PriceBase, row.Category, row.FixedValues, allValueRows);

                // Verificar si el producto ya existe por SKU
                Product? existingProduct = null;
                if (!string.IsNullOrWhiteSpace(row.Sku))
                {
                    existingProduct = await _productRepository.GetBySkuAsync(row.Sku);
                }

                // Si no se encontró por SKU, buscar por nombre+categoría
                existingProduct ??= await _productRepository.GetByNameAndCategoryIdAsync(row.Name, category.Id);

                if (existingProduct != null)
                {
                    // Verificar si hay cambios que aplicar
                    bool hasChanges = false;

                    if (existingProduct.Price != calculatedPrice)
                    {
                        existingProduct.Price = calculatedPrice;
                        hasChanges = true;
                    }

                    if (existingProduct.PriceCurrency != currency)
                    {
                        existingProduct.PriceCurrency = currency;
                        hasChanges = true;
                    }

                    // Comparar atributos fijos
                    if (attributes.Count > 0 && !AttributesEqual(existingProduct.Attributes, attributes))
                    {
                        existingProduct.Attributes = attributes;
                        hasChanges = true;
                    }

                    // Actualizar nombre si cambió (puede pasar si se encontró por SKU)
                    if (!string.Equals(existingProduct.Name, row.Name, StringComparison.Ordinal))
                    {
                        existingProduct.Name = row.Name;
                        hasChanges = true;
                    }

                    if (hasChanges)
                    {
                        existingProduct.UpdatedAt = DateTime.UtcNow;
                        await _productRepository.UpdateAsync(existingProduct);
                        sheetResult.ProductsUpdated++;
                        globalResult.TotalProductsUpdated++;

                        _logger.LogInformation(
                            "Producto '{Name}' actualizado (SKU: {Sku}, Precio: {Price} {Currency})",
                            existingProduct.Name, existingProduct.SKU, calculatedPrice, currency);
                    }
                    else
                    {
                        sheetResult.ProductsSkipped++;
                        globalResult.TotalProductsSkipped++;
                        _logger.LogDebug(
                            "Producto '{Name}' sin cambios — omitido",
                            existingProduct.Name);
                    }

                    continue;
                }

                // Producto nuevo — crear
                var sku = !string.IsNullOrWhiteSpace(row.Sku)
                    ? row.Sku
                    : GenerateSku(row.Category, row.Name);

                var product = new Product
                {
                    Name = row.Name,
                    CategoryId = category.Id,
                    Category = category.Name,
                    Price = calculatedPrice,
                    PriceCurrency = currency,
                    Stock = 0,
                    Status = "active",
                    SKU = sku,
                    Description = $"{row.Name} — {category.Name}",
                    Attributes = attributes,
                    CreatedAt = DateTime.UtcNow
                };

                await _productRepository.CreateAsync(product);
                sheetResult.ProductsCreated++;
                globalResult.TotalProductsCreated++;

                _logger.LogInformation(
                    "Producto '{Name}' creado (SKU: {Sku}, Precio: {Price} {Currency})",
                    row.Name, sku, calculatedPrice, currency);
            }
            catch (Exception ex)
            {
                sheetResult.Errors.Add($"Error procesando producto '{row.Name}': {ex.Message}");
                _logger.LogError(ex, "Error procesando producto '{Name}'", row.Name);
            }
        }

        // Actualizar conteo de productos por categoría
        var productsByCategory = productRows
            .GroupBy(p => p.Category, StringComparer.OrdinalIgnoreCase);

        foreach (var group in productsByCategory)
        {
            if (categoryMap.TryGetValue(group.Key, out var cat))
            {
                var currentProductCount = await _productRepository.CountByCategoryIdAsync(cat.Id);
                if (cat.Products != (int)currentProductCount)
                {
                    cat.Products = (int)currentProductCount;
                    cat.UpdatedAt = DateTime.UtcNow;
                    await _categoryRepository.UpdateAsync(cat);
                }
            }
        }
    }

    /// <summary>
    /// Compara dos diccionarios de atributos para detectar cambios.
    /// </summary>
    private static bool AttributesEqual(Dictionary<string, object>? a, Dictionary<string, object>? b)
    {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        if (a.Count != b.Count) return false;

        foreach (var kvp in a)
        {
            if (!b.TryGetValue(kvp.Key, out var bVal)) return false;
            if (!string.Equals(kvp.Value?.ToString(), bVal?.ToString(), StringComparison.Ordinal))
                return false;
        }

        return true;
    }

    /// <summary>
    /// Parsea "Atributo:Valor;Atributo:Valor" en un diccionario.
    /// </summary>
    private static Dictionary<string, object> ParseFixedValues(string fixedValues)
    {
        var dict = new Dictionary<string, object>();
        if (string.IsNullOrWhiteSpace(fixedValues)) return dict;

        var pairs = fixedValues.Split(';', StringSplitOptions.RemoveEmptyEntries);
        foreach (var pair in pairs)
        {
            var parts = pair.Split(':', 2);
            if (parts.Length == 2)
            {
                var key = parts[0].Trim();
                var value = parts[1].Trim();
                dict[key] = value;
            }
        }

        return dict;
    }

    /// <summary>
    /// Calcula el precio final sumando el precio base + las alteraciones de cada valor fijo.
    /// </summary>
    private decimal CalculatePrice(
        decimal priceBase,
        string categoryName,
        string fixedValues,
        List<ValueRow> allValueRows)
    {
        var total = priceBase;

        if (string.IsNullOrWhiteSpace(fixedValues)) return total;

        var pairs = fixedValues.Split(';', StringSplitOptions.RemoveEmptyEntries);
        foreach (var pair in pairs)
        {
            var parts = pair.Split(':', 2);
            if (parts.Length != 2) continue;

            var attributeName = parts[0].Trim();
            var valueName = parts[1].Trim();

            // Buscar la alteración de precio para este valor
            var valueRow = allValueRows.FirstOrDefault(v =>
                string.Equals(v.Category, categoryName, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(v.Attribute, attributeName, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(v.ValueOption, valueName, StringComparison.OrdinalIgnoreCase));

            if (valueRow != null)
                total += valueRow.PriceAlteration;
        }

        return total;
    }

    // ════════════════════════════════════════════════════════════════════
    //  Helpers
    // ════════════════════════════════════════════════════════════════════

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

    // ════════════════════════════════════════════════════════════════════
    //  Records para datos parseados
    // ════════════════════════════════════════════════════════════════════

    private sealed record SchemaRow(
        string Category,
        string Attribute,
        string DataType,
        string Required,
        string NestedProduct);

    private sealed record ValueRow(
        string Category,
        string Attribute,
        string ValueOption,
        decimal PriceAlteration);

    private sealed record ProductRow(
        string Category,
        string Sku,
        string Name,
        decimal PriceBase,
        string FixedValues);

    // ════════════════════════════════════════════════════════════════════
    //  EXPORT: Generar Excel con formato (vacío o con datos)
    // ════════════════════════════════════════════════════════════════════

    public async Task<byte[]> ExportProductsToExcelAsync(bool includeData, string currency)
    {
        using var workbook = new XLWorkbook();

        // ── Hoja 1: ESQUEMA_CATEGORIAS ──────────────────────────────────
        var wsSchema = workbook.Worksheets.Add(SheetSchema);
        wsSchema.Cell(1, 1).Value = "Categoria";
        wsSchema.Cell(1, 2).Value = "Atributo";
        wsSchema.Cell(1, 3).Value = "Tipo_Dato";
        wsSchema.Cell(1, 4).Value = "Requerido";
        wsSchema.Cell(1, 5).Value = "Producto_Anidado";
        StyleHeaderRow(wsSchema, 5);

        // ── Hoja 2: VALORES_Y_PRECIOS ───────────────────────────────────
        var wsValues = workbook.Worksheets.Add(SheetValues);
        wsValues.Cell(1, 1).Value = "Categoria";
        wsValues.Cell(1, 2).Value = "Atributo";
        wsValues.Cell(1, 3).Value = "Opcion_Valor";
        wsValues.Cell(1, 4).Value = "Alteracion_Precio";
        StyleHeaderRow(wsValues, 4);

        // ── Hoja 3: PRODUCTOS_FINALES ───────────────────────────────────
        var wsProducts = workbook.Worksheets.Add(SheetProducts);
        wsProducts.Cell(1, 1).Value = "Categoria";
        wsProducts.Cell(1, 2).Value = "SKU";
        wsProducts.Cell(1, 3).Value = "Nombre";
        wsProducts.Cell(1, 4).Value = "Precio_Base";
        wsProducts.Cell(1, 5).Value = "Valores_Fijos";
        StyleHeaderRow(wsProducts, 5);

        if (includeData)
        {
            await FillExportData(wsSchema, wsValues, wsProducts, currency);
        }

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    private async Task FillExportData(
        IXLWorksheet wsSchema,
        IXLWorksheet wsValues,
        IXLWorksheet wsProducts,
        string currency)
    {
        var categories = (await _categoryRepository.GetAllAsync()).ToList();
        int schemaRow = 2;
        int valueRow = 2;

        foreach (var cat in categories)
        {
            foreach (var attr in cat.Attributes)
            {
                // Escribir esquema
                var tipoDato = attr.ValueType switch
                {
                    "Select" => "seleccion",
                    "MultipleSelect" => "seleccion_multiple",
                    "Product" => "producto",
                    _ => "seleccion"
                };

                wsSchema.Cell(schemaRow, 1).Value = cat.Name;
                wsSchema.Cell(schemaRow, 2).Value = attr.Title;
                wsSchema.Cell(schemaRow, 3).Value = tipoDato;
                wsSchema.Cell(schemaRow, 4).Value = attr.Required == true ? "SI" : "NO";
                wsSchema.Cell(schemaRow, 5).Value = ""; // NestedProduct — no se puede inferir fácilmente
                schemaRow++;

                // Escribir valores
                foreach (var val in attr.Values)
                {
                    wsValues.Cell(valueRow, 1).Value = cat.Name;
                    wsValues.Cell(valueRow, 2).Value = attr.Title;
                    wsValues.Cell(valueRow, 3).Value = val.Label;
                    wsValues.Cell(valueRow, 4).Value = val.PriceAdjustment;
                    valueRow++;
                }
            }
        }

        // Escribir productos
        var allProducts = (await _productRepository.GetAllAsync()).ToList();
        int prodRow = 2;

        foreach (var prod in allProducts)
        {
            // Resolver nombre de categoría
            var catName = prod.Category;
            if (string.IsNullOrWhiteSpace(catName))
            {
                var cat = categories.FirstOrDefault(c => c.Id == prod.CategoryId);
                catName = cat?.Name ?? "";
            }

            // Reconstruir valores fijos
            var fixedValues = "";
            if (prod.Attributes != null && prod.Attributes.Count > 0)
            {
                fixedValues = string.Join(";",
                    prod.Attributes.Select(kvp => $"{kvp.Key}:{kvp.Value}"));
            }

            wsProducts.Cell(prodRow, 1).Value = catName;
            wsProducts.Cell(prodRow, 2).Value = prod.SKU;
            wsProducts.Cell(prodRow, 3).Value = prod.Name;
            wsProducts.Cell(prodRow, 4).Value = prod.Price;
            wsProducts.Cell(prodRow, 5).Value = fixedValues;
            prodRow++;
        }

        // Auto-ajustar columnas
        wsSchema.Columns().AdjustToContents();
        wsValues.Columns().AdjustToContents();
        wsProducts.Columns().AdjustToContents();
    }

    private static void StyleHeaderRow(IXLWorksheet ws, int columnCount)
    {
        var headerRange = ws.Range(1, 1, 1, columnCount);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = XLColor.DarkGreen;
        headerRange.Style.Font.FontColor = XLColor.White;
        ws.Columns().AdjustToContents();
    }
}

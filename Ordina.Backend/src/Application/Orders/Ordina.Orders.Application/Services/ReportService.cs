using System;
using System.IO;
using System.Linq;
using Microsoft.Extensions.Logging;
using SpreadsheetLight;
using Ordina.Database.Entities.Order;
using Ordina.Database.Entities.Category;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Services;

public interface IReportService
{
    Task<Stream> GenerateManufacturingReportAsync(
        string status, 
        string? manufacturerId = null, 
        string? orderNumber = null, 
        DateTime? startDate = null, 
        DateTime? endDate = null,
        string? searchTerm = null);
    
    Task<List<ManufacturingReportRowDto>> GetManufacturingReportDataAsync(
        string status, 
        string? manufacturerId = null, 
        string? orderNumber = null, 
        DateTime? startDate = null, 
        DateTime? endDate = null,
        string? searchTerm = null);
    
    Task<Stream> GeneratePaymentsReportAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        string? paymentMethod = null,
        string? accountId = null);
    
    Task<List<PaymentReportRowDto>> GetPaymentsReportDataAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        string? paymentMethod = null,
        string? accountId = null);
}

public class ReportService : IReportService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IProviderRepository _providerRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly ILogger<ReportService> _logger;

    public ReportService(
        IOrderRepository orderRepository,
        IProviderRepository providerRepository,
        ICategoryRepository categoryRepository,
        ILogger<ReportService> logger)
    {
        _orderRepository = orderRepository;
        _providerRepository = providerRepository;
        _categoryRepository = categoryRepository;
        _logger = logger;
    }

    public async Task<List<ManufacturingReportRowDto>> GetManufacturingReportDataAsync(
        string status, 
        string? manufacturerId = null, 
        string? orderNumber = null, 
        DateTime? startDate = null, 
        DateTime? endDate = null,
        string? searchTerm = null)
    {
        // Validar estado
        if (string.IsNullOrWhiteSpace(status) || 
            !new[] { "debe_fabricar", "fabricando", "fabricado" }.Contains(status))
        {
            throw new ArgumentException("El estado debe ser: debe_fabricar, fabricando o fabricado", nameof(status));
        }

        try
        {
            _logger.LogInformation("Obteniendo datos del reporte con estado: {Status}", status);
            
            // Usar el método privado para obtener los datos filtrados
            var reportData = await GetFilteredReportDataAsync(
                status, 
                manufacturerId, 
                orderNumber, 
                startDate, 
                endDate, 
                searchTerm);
            
            // Convertir a DTO
            return reportData.Select(row => new ManufacturingReportRowDto
            {
                Fecha = row.Fecha,
                Pedido = row.Pedido,
                Estado = row.Estado,
                Cliente = row.Cliente,
                Fabricante = row.Fabricante,
                Cantidad = row.Cantidad,
                Descripcion = row.Descripcion,
                Observaciones = row.Observaciones
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener datos del reporte de fabricación. Status: {Status}", status);
            throw;
        }
    }

    public async Task<Stream> GenerateManufacturingReportAsync(
        string status, 
        string? manufacturerId = null, 
        string? orderNumber = null, 
        DateTime? startDate = null, 
        DateTime? endDate = null,
        string? searchTerm = null)
    {
        // Validar estado
        if (string.IsNullOrWhiteSpace(status) || 
            !new[] { "debe_fabricar", "fabricando", "fabricado" }.Contains(status))
        {
            throw new ArgumentException("El estado debe ser: debe_fabricar, fabricando o fabricado", nameof(status));
        }

        try
        {
            _logger.LogInformation("Iniciando generación de reporte con estado: {Status}", status);
            
            // Obtener los datos filtrados usando el método privado común
            var reportData = await GetFilteredReportDataAsync(
                status, 
                manufacturerId, 
                orderNumber, 
                startDate, 
                endDate, 
                searchTerm);

            // 3. Ordenar por fecha (más reciente primero)
            reportData = reportData
                .OrderByDescending(r => r.Fecha)
                .ThenBy(r => r.Pedido)
                .ToList();

            // 5. Generar Excel con SpreadsheetLight
            var stream = new MemoryStream();
            
            using (var sl = new SLDocument())
            {
                // Headers en la fila 1
                sl.SetCellValue(1, 1, "Fecha");
                sl.SetCellValue(1, 2, "Pedido");
                sl.SetCellValue(1, 3, "Estado");
                sl.SetCellValue(1, 4, "Cliente");
                sl.SetCellValue(1, 5, "Fabricante");
                sl.SetCellValue(1, 6, "Cantidad");
                sl.SetCellValue(1, 7, "Descripción");
                sl.SetCellValue(1, 8, "Observaciones");

                // Estilo de headers - solo negrita por ahora
                var headerStyle = sl.CreateStyle();
                headerStyle.Font.Bold = true;

                // Aplicar estilo a las celdas de headers
                for (int col = 1; col <= 8; col++)
                {
                    sl.SetCellStyle(1, col, headerStyle);
                }

                // Llenar datos desde la fila 2
                int row = 2;
                foreach (var item in reportData)
                {
                    sl.SetCellValue(row, 1, item.Fecha);
                    sl.SetCellValue(row, 2, item.Pedido);
                    sl.SetCellValue(row, 3, item.Estado);
                    sl.SetCellValue(row, 4, item.Cliente);
                    sl.SetCellValue(row, 5, item.Fabricante);
                    sl.SetCellValue(row, 6, item.Cantidad);
                    sl.SetCellValue(row, 7, item.Descripcion);
                    sl.SetCellValue(row, 8, item.Observaciones);
                    row++;
                }

                // Ajustar ancho de columnas
                sl.SetColumnWidth(1, 12);  // Fecha
                sl.SetColumnWidth(2, 15);  // Pedido
                sl.SetColumnWidth(3, 15);  // Estado
                sl.SetColumnWidth(4, 25);  // Cliente
                sl.SetColumnWidth(5, 25);  // Fabricante
                sl.SetColumnWidth(6, 10);  // Cantidad
                sl.SetColumnWidth(7, 50);  // Descripción
                sl.SetColumnWidth(8, 40);  // Observaciones

                // Guardar en el stream antes de que se cierre el SLDocument
                sl.SaveAs(stream);
            }
            
            // Asegurarse de que el stream esté al inicio después de que se cierre el SLDocument
            stream.Position = 0;
            
            _logger.LogInformation("Reporte generado exitosamente. Filas: {RowCount}, Tamaño del stream: {StreamLength}", reportData.Count, stream.Length);
            
            return stream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al generar reporte de fabricación. Status: {Status}, ManufacturerId: {ManufacturerId}, OrderNumber: {OrderNumber}", 
                status, manufacturerId, orderNumber);
            throw;
        }
    }

    // Método privado común para obtener los datos filtrados del reporte
    private async Task<List<ManufacturingReportRow>> GetFilteredReportDataAsync(
        string status, 
        string? manufacturerId, 
        string? orderNumber, 
        DateTime? startDate, 
        DateTime? endDate, 
        string? searchTerm)
    {
        // 1. Obtener todas las órdenes
        var orders = await _orderRepository.GetAllAsync();
        _logger.LogInformation("Órdenes obtenidas: {Count}", orders.Count());

        // 2. Filtrar productos según el estado de fabricación
        var reportData = new List<ManufacturingReportRow>();

        foreach (var order in orders)
        {
            // Filtrar por número de pedido si se especifica
            if (!string.IsNullOrWhiteSpace(orderNumber) && 
                !order.OrderNumber.Equals(orderNumber, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            // Filtrar por rango de fechas si se especifica
            if (startDate.HasValue && order.CreatedAt < startDate.Value)
            {
                continue;
            }
            if (endDate.HasValue && order.CreatedAt > endDate.Value.AddDays(1).AddSeconds(-1))
            {
                continue;
            }

            // Determinar si la orden coincide con el término de búsqueda (pedido o cliente)
            // Si coincide por pedido/cliente, incluimos todos los productos
            // Si no coincide por pedido/cliente, filtramos producto por producto
            bool orderMatchesSearchByOrderOrClient = true;
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                var search = searchTerm.ToLowerInvariant();
                var matchesOrder = order.OrderNumber.ToLowerInvariant().Contains(search);
                var matchesClient = order.ClientName.ToLowerInvariant().Contains(search);
                orderMatchesSearchByOrderOrClient = matchesOrder || matchesClient;
            }

            foreach (var product in order.Products)
            {
                // Solo productos que deben mandarse a fabricar
                if (product.LocationStatus != "mandar_a_fabricar")
                {
                    continue;
                }

                // Determinar el estado real del producto
                string? productStatus = product.ManufacturingStatus;
                
                // Si no tiene manufacturingStatus pero locationStatus es "mandar_a_fabricar",
                // asumimos que es "debe_fabricar"
                if (string.IsNullOrWhiteSpace(productStatus))
                {
                    productStatus = "debe_fabricar";
                }

                // Filtrar por el estado solicitado
                if (productStatus != status)
                {
                    continue;
                }

                // Obtener nombre del fabricante
                string? manufacturerName = product.ManufacturingProviderName ?? "-";

                // Si se especifica manufacturerId, filtrar
                if (!string.IsNullOrWhiteSpace(manufacturerId))
                {
                    if (string.IsNullOrWhiteSpace(product.ManufacturingProviderId) ||
                        product.ManufacturingProviderId != manufacturerId)
                    {
                        continue;
                    }
                }

                // Si hay término de búsqueda y la orden no coincide por pedido/cliente,
                // verificar que el producto específico coincida
                if (!string.IsNullOrWhiteSpace(searchTerm) && !orderMatchesSearchByOrderOrClient)
                {
                    var search = searchTerm.ToLowerInvariant();
                    var matchesProductName = product.Name.ToLowerInvariant().Contains(search);
                    
                    if (!matchesProductName)
                    {
                        continue;
                    }
                }

                // Obtener etiqueta del estado
                var estadoLabel = productStatus switch
                {
                    "debe_fabricar" => "Por Fabricar",
                    "fabricando" => "Fabricando",
                    "fabricado" => "Fabricado",
                    _ => productStatus
                };

                reportData.Add(new ManufacturingReportRow
                {
                    Fecha = order.CreatedAt.ToString("yyyy-MM-dd"),
                    Pedido = order.OrderNumber,
                    Estado = estadoLabel,
                    Cliente = order.ClientName,
                    Fabricante = manufacturerName,
                    Cantidad = product.Quantity,
                    Descripcion = await FormatProductDescriptionAsync(product),
                    Observaciones = product.Observations ?? string.Empty
                });
            }
        }

        // Ordenar por fecha (más reciente primero)
        reportData = reportData
            .OrderByDescending(r => r.Fecha)
            .ThenBy(r => r.Pedido)
            .ToList();

        return reportData;
    }

    // Método simplificado: ahora los valores ya son labels, solo necesitamos formatearlos
    private async Task<string> FormatProductDescriptionAsync(OrderProduct product)
    {
        var parts = new List<string> { product.Name };

        if (product.Attributes == null || product.Attributes.Count == 0)
        {
            return string.Join(" | ", parts);
        }

        // 1. Obtener la categoría solo para obtener títulos de atributos
        Category? category = null;
        if (!string.IsNullOrWhiteSpace(product.Category))
        {
            category = await _categoryRepository.GetByNameAsync(product.Category);
        }

        _logger.LogInformation("Formateando descripción para producto '{ProductName}' con categoría '{Category}'. Atributos encontrados: {AttributeCount}", 
            product.Name, product.Category, product.Attributes.Count);

        // 2. Procesar cada atributo guardado
        var attributeStrings = new List<string>();

        foreach (var kvp in product.Attributes)
        {
            var attributeKey = kvp.Key;
            var attributeValue = kvp.Value;

            // Ignorar atributos anidados de productos (formato: "attrId_productId")
            if (attributeKey.Contains("_") && attributeKey.Split('_').Length == 2)
            {
                continue; // Los manejamos después
            }

            // 3. Obtener el título del atributo
            // Ahora la clave ya es el título, pero verificamos por compatibilidad
            string attributeTitle = attributeKey;
            if (category != null)
            {
                var categoryAttribute = category.Attributes?.FirstOrDefault(attr => 
                    (!string.IsNullOrEmpty(attr.Title) && attr.Title.Equals(attributeKey, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrEmpty(attr.Id) && attr.Id == attributeKey));
                
                if (categoryAttribute != null && !string.IsNullOrEmpty(categoryAttribute.Title))
                {
                    attributeTitle = categoryAttribute.Title;
                }
            }

            // 4. Formatear el valor directamente (ya es un label o valor numérico)
            // Para atributos tipo Product, aún necesitamos resolver IDs
            string valueLabel = "";
            if (category != null)
            {
                // Buscar por título primero (clave actual), luego por ID (compatibilidad)
                var categoryAttribute = category.Attributes?.FirstOrDefault(attr => 
                    (!string.IsNullOrEmpty(attr.Title) && attr.Title.Equals(attributeKey, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrEmpty(attr.Id) && attr.Id == attributeKey));
                
                // Solo resolver IDs para atributos tipo Product (que aún usan IDs)
                if (categoryAttribute != null && categoryAttribute.ValueType == "Product")
                {
                    valueLabel = ResolveProductAttributeValues(attributeValue, categoryAttribute);
                }
                else
                {
                    // Para otros tipos, el valor ya es un label o número
                    valueLabel = FormatAttributeValue(attributeValue);
                }
            }
            else
            {
                // Sin categoría, mostrar el valor tal cual
                valueLabel = FormatAttributeValue(attributeValue);
            }

            // 5. Agregar a la lista si hay valor
            if (!string.IsNullOrWhiteSpace(valueLabel))
            {
                attributeStrings.Add($"{attributeTitle}: {valueLabel}");
            }
            }

        // 6. Procesar atributos anidados de productos (formato: "attrId_productId")
        if (category != null)
            {
            ProcessNestedProductAttributes(product.Attributes, category, attributeStrings);
        }

        // 7. Agregar atributos formateados a la descripción
        if (attributeStrings.Count > 0)
        {
            parts.Add(string.Join(", ", attributeStrings));
            _logger.LogInformation("Descripción formateada para '{ProductName}': '{Description}'", 
                product.Name, string.Join(" | ", parts));
        }

        return string.Join(" | ", parts);
    }

    // Método simplificado para formatear valores (ya son labels o números)
    private string FormatAttributeValue(object? value)
    {
        if (value == null)
            return "";

        // Manejar JsonElement
        if (value is System.Text.Json.JsonElement jsonElement)
        {
            switch (jsonElement.ValueKind)
            {
                case System.Text.Json.JsonValueKind.String:
                    return jsonElement.GetString() ?? "";
                case System.Text.Json.JsonValueKind.Number:
                    return jsonElement.GetRawText();
                case System.Text.Json.JsonValueKind.Array:
                    return string.Join(", ", 
                        jsonElement.EnumerateArray()
                            .Select(e => e.ValueKind == System.Text.Json.JsonValueKind.String 
                                ? e.GetString() 
                                : e.GetRawText())
                            .Where(s => !string.IsNullOrEmpty(s)));
                default:
                    return jsonElement.GetRawText();
            }
        }

        // Manejar arrays
        if (value is System.Collections.IEnumerable enumerable && !(value is string))
        {
            return string.Join(", ", 
                enumerable.Cast<object>()
                    .Select(v => v?.ToString() ?? "")
                    .Where(s => !string.IsNullOrEmpty(s)));
        }

        return value.ToString() ?? "";
    }


    // Resolver valores de atributos de tipo Product (aún usan IDs)
    private string ResolveProductAttributeValues(object? attributeValue, CategoryAttribute categoryAttribute)
    {
        if (attributeValue == null || categoryAttribute.Values == null || categoryAttribute.Values.Count == 0)
        {
            return FormatAttributeValue(attributeValue);
        }

        // Los atributos de tipo Product guardan arrays de IDs de productos
        if (attributeValue is System.Collections.IEnumerable enumerable && !(attributeValue is string))
        {
            var productLabels = new List<string>();
            foreach (var productId in enumerable)
            {
                var productIdStr = productId?.ToString();
                if (string.IsNullOrEmpty(productIdStr))
                    continue;

                // Buscar el producto en los values del atributo
                // Comparar por ProductId (string) o por Id (string)
                var productValue = categoryAttribute.Values.FirstOrDefault(v => 
                    (!string.IsNullOrEmpty(v.ProductId) && v.ProductId == productIdStr) ||
                    (!string.IsNullOrEmpty(v.Id) && v.Id == productIdStr));

                if (productValue != null && !string.IsNullOrEmpty(productValue.Label))
                {
                    productLabels.Add(productValue.Label);
                }
                else
                {
                    // Si no se encuentra, mostrar el ID
                    productLabels.Add($"Producto {productIdStr}");
                }
            }
            return string.Join(", ", productLabels);
        }

        // Valor único
        var singleProductIdStr = attributeValue.ToString();
        if (string.IsNullOrEmpty(singleProductIdStr))
        {
            return FormatAttributeValue(attributeValue);
        }

        var singleProductValue = categoryAttribute.Values.FirstOrDefault(v => 
            (!string.IsNullOrEmpty(v.ProductId) && v.ProductId == singleProductIdStr) ||
            (!string.IsNullOrEmpty(v.Id) && v.Id == singleProductIdStr));

        return singleProductValue?.Label ?? $"Producto {singleProductIdStr}";
    }

    // Procesar atributos anidados de productos
    private void ProcessNestedProductAttributes(
        Dictionary<string, object>? attributes, 
        Category? category, 
        List<string> attributeStrings)
    {
        if (attributes == null || category == null)
            return;

        foreach (var kvp in attributes)
        {
            if (!kvp.Key.Contains("_") || kvp.Key.Split('_').Length != 2)
                continue;

            var parts = kvp.Key.Split('_');
            var attrId = parts[0];
            var productId = parts[1];

            // Buscar el atributo padre (buscar por título primero, luego por ID)
            var parentAttribute = category.Attributes?.FirstOrDefault(attr => 
                (!string.IsNullOrEmpty(attr.Title) && attr.Title.Equals(attrId, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrEmpty(attr.Id) && attr.Id == attrId));

            if (parentAttribute == null || parentAttribute.ValueType != "Product")
                continue;

            // Buscar el producto en los values
            var productValue = parentAttribute.Values?.FirstOrDefault(v => 
                (!string.IsNullOrEmpty(v.ProductId) && v.ProductId == productId) ||
                (!string.IsNullOrEmpty(v.Id) && v.Id == productId));

            if (productValue == null)
                continue;

            // Procesar atributos anidados
            if (kvp.Value is Dictionary<string, object> nestedAttributes)
            {
                var nestedStrings = new List<string>();
                foreach (var nestedKvp in nestedAttributes)
                {
                    var nestedValue = FormatAttributeValue(nestedKvp.Value);
                    if (!string.IsNullOrWhiteSpace(nestedValue))
                    {
                        nestedStrings.Add($"{nestedKvp.Key}: {nestedValue}");
                    }
                }

                if (nestedStrings.Count > 0)
                {
                    attributeStrings.Add(
                        $"{parentAttribute.Title} ({productValue.Label}): {string.Join(", ", nestedStrings)}");
                }
            }
        }
    }



    private class ManufacturingReportRow
    {
        public string Fecha { get; set; } = string.Empty;
        public string Pedido { get; set; } = string.Empty;
        public string Estado { get; set; } = string.Empty;
        public string Cliente { get; set; } = string.Empty;
        public string Fabricante { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public string Descripcion { get; set; } = string.Empty;
        public string Observaciones { get; set; } = string.Empty;
    }

    public async Task<List<PaymentReportRowDto>> GetPaymentsReportDataAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        string? paymentMethod = null,
        string? accountId = null)
    {
        try
        {
            _logger.LogInformation("Obteniendo datos del reporte de pagos");
            
            var reportData = await GetFilteredPaymentsDataAsync(
                startDate,
                endDate,
                paymentMethod,
                accountId);
            
            return reportData.Select(row => new PaymentReportRowDto
            {
                Fecha = row.Fecha,
                Pedido = row.Pedido,
                Cliente = row.Cliente,
                MetodoPago = row.MetodoPago,
                MontoOriginal = row.MontoOriginal,
                MonedaOriginal = row.MonedaOriginal,
                MontoBs = row.MontoBs,
                Cuenta = row.Cuenta,
                Referencia = row.Referencia
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener datos del reporte de pagos");
            throw;
        }
    }

    public async Task<Stream> GeneratePaymentsReportAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        string? paymentMethod = null,
        string? accountId = null)
    {
        try
        {
            _logger.LogInformation("Iniciando generación de reporte de pagos");
            
            var reportData = await GetFilteredPaymentsDataAsync(
                startDate,
                endDate,
                paymentMethod,
                accountId);

            // Ordenar por fecha (más reciente primero)
            reportData = reportData
                .OrderByDescending(r => r.Fecha)
                .ThenBy(r => r.Pedido)
                .ToList();

            // Generar Excel con SpreadsheetLight
            var stream = new MemoryStream();
            
            using (var sl = new SLDocument())
            {
                // Headers en la fila 1
                sl.SetCellValue(1, 1, "Fecha");
                sl.SetCellValue(1, 2, "Pedido");
                sl.SetCellValue(1, 3, "Cliente");
                sl.SetCellValue(1, 4, "Método de Pago");
                sl.SetCellValue(1, 5, "Monto");
                sl.SetCellValue(1, 6, "Moneda");
                sl.SetCellValue(1, 7, "Monto en Bs");
                sl.SetCellValue(1, 8, "Cuenta");
                sl.SetCellValue(1, 9, "Referencia/Remitente");

                // Estilo de headers
                var headerStyle = sl.CreateStyle();
                headerStyle.Font.Bold = true;

                // Aplicar estilo a las celdas de headers
                for (int col = 1; col <= 9; col++)
                {
                    sl.SetCellStyle(1, col, headerStyle);
                }

                // Llenar datos desde la fila 2
                int row = 2;
                foreach (var item in reportData)
                {
                    sl.SetCellValue(row, 1, item.Fecha);
                    sl.SetCellValue(row, 2, item.Pedido);
                    sl.SetCellValue(row, 3, item.Cliente);
                    sl.SetCellValue(row, 4, item.MetodoPago);
                    sl.SetCellValue(row, 5, (double)item.MontoOriginal);
                    sl.SetCellValue(row, 6, item.MonedaOriginal);
                    sl.SetCellValue(row, 7, (double)item.MontoBs);
                    sl.SetCellValue(row, 8, item.Cuenta);
                    sl.SetCellValue(row, 9, item.Referencia);
                    row++;
                }

                // Ajustar ancho de columnas
                sl.SetColumnWidth(1, 12);  // Fecha
                sl.SetColumnWidth(2, 15);  // Pedido
                sl.SetColumnWidth(3, 25);  // Cliente
                sl.SetColumnWidth(4, 20);  // Método de Pago
                sl.SetColumnWidth(5, 15);  // Monto
                sl.SetColumnWidth(6, 10);  // Moneda
                sl.SetColumnWidth(7, 15);  // Monto en Bs
                sl.SetColumnWidth(8, 30);  // Cuenta
                sl.SetColumnWidth(9, 30);  // Referencia/Remitente

                // Guardar en el stream
                sl.SaveAs(stream);
            }
            
            stream.Position = 0;
            
            _logger.LogInformation("Reporte de pagos generado exitosamente. Filas: {RowCount}", reportData.Count);
            
            return stream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al generar reporte de pagos");
            throw;
        }
    }

    private async Task<List<PaymentReportRow>> GetFilteredPaymentsDataAsync(
        DateTime? startDate,
        DateTime? endDate,
        string? paymentMethod,
        string? accountId)
    {
        var orders = await _orderRepository.GetAllAsync();
        _logger.LogInformation("Órdenes obtenidas: {Count}", orders.Count());

        var reportData = new List<PaymentReportRow>();

        foreach (var order in orders)
        {
            // Filtrar por rango de fechas si se especifica
            if (startDate.HasValue && order.CreatedAt < startDate.Value)
            {
                continue;
            }
            if (endDate.HasValue && order.CreatedAt > endDate.Value.AddDays(1).AddSeconds(-1))
            {
                continue;
            }

            // Procesar pagos mixtos si existen
            if (order.MixedPayments != null && order.MixedPayments.Count > 0)
            {
                foreach (var payment in order.MixedPayments)
                {
                    // Filtrar por método de pago
                    if (!string.IsNullOrWhiteSpace(paymentMethod) && payment.Method != paymentMethod)
                    {
                        continue;
                    }

                    // Filtrar por cuenta - solo si se especifica accountId y el pago tiene accountId que coincida
                    if (!string.IsNullOrWhiteSpace(accountId))
                    {
                        var paymentAccountId = payment.PaymentDetails?.AccountId;
                        if (string.IsNullOrWhiteSpace(paymentAccountId) || paymentAccountId != accountId)
                        {
                            continue;
                        }
                    }

                    var row = CreatePaymentReportRow(order, payment, payment.Date);
                    reportData.Add(row);
                }
            }

            // Procesar pagos parciales si existen
            if (order.PartialPayments != null && order.PartialPayments.Count > 0)
            {
                foreach (var payment in order.PartialPayments)
                {
                    // Filtrar por método de pago
                    if (!string.IsNullOrWhiteSpace(paymentMethod) && payment.Method != paymentMethod)
                    {
                        continue;
                    }

                    // Filtrar por cuenta - solo si se especifica accountId y el pago tiene accountId que coincida
                    if (!string.IsNullOrWhiteSpace(accountId))
                    {
                        var paymentAccountId = payment.PaymentDetails?.AccountId;
                        if (string.IsNullOrWhiteSpace(paymentAccountId) || paymentAccountId != accountId)
                        {
                            continue;
                        }
                    }

                    var row = CreatePaymentReportRow(order, payment, payment.Date);
                    reportData.Add(row);
                }
            }

            // Si no hay pagos parciales ni mixtos, usar el pago principal
            if ((order.PartialPayments == null || order.PartialPayments.Count == 0) &&
                (order.MixedPayments == null || order.MixedPayments.Count == 0) &&
                !string.IsNullOrWhiteSpace(order.PaymentMethod))
            {
                // Filtrar por método de pago
                if (!string.IsNullOrWhiteSpace(paymentMethod) && order.PaymentMethod != paymentMethod)
                {
                    continue;
                }

                // Filtrar por cuenta - solo si se especifica accountId y el pago tiene accountId que coincida
                if (!string.IsNullOrWhiteSpace(accountId))
                {
                    var paymentAccountId = order.PaymentDetails?.AccountId;
                    if (string.IsNullOrWhiteSpace(paymentAccountId) || paymentAccountId != accountId)
                    {
                        continue;
                    }
                }

                var referencia = GetPaymentReference(order.PaymentDetails, order.PaymentMethod);
                var cuenta = GetAccountDisplay(order.PaymentDetails);
                
                // Usar originalAmount y originalCurrency si están disponibles
                // Si no hay originalAmount, intentar usar CashReceived y CashCurrency para efectivo
                var montoOriginal = order.PaymentDetails?.OriginalAmount ?? 
                                   order.PaymentDetails?.CashReceived ?? 
                                   order.Total;
                var monedaOriginal = order.PaymentDetails?.OriginalCurrency ?? 
                                    order.PaymentDetails?.CashCurrency ?? 
                                    "Bs";
                
                // Calcular monto en Bs
                var montoBs = monedaOriginal == "Bs" 
                    ? montoOriginal 
                    : montoOriginal * (order.PaymentDetails?.ExchangeRate ?? 1);

                reportData.Add(new PaymentReportRow
                {
                    Fecha = order.CreatedAt.ToString("yyyy-MM-dd"),
                    Pedido = order.OrderNumber,
                    Cliente = order.ClientName,
                    MetodoPago = order.PaymentMethod,
                    MontoOriginal = montoOriginal,
                    MonedaOriginal = monedaOriginal,
                    MontoBs = montoBs,
                    Cuenta = cuenta,
                    Referencia = referencia
                });
            }
        }

        return reportData;
    }

    private PaymentReportRow CreatePaymentReportRow(Order order, PartialPayment payment, DateTime paymentDate)
    {
        var referencia = GetPaymentReference(payment.PaymentDetails, payment.Method);
        var cuenta = GetAccountDisplay(payment.PaymentDetails);
        
        // Usar originalAmount y originalCurrency si están disponibles
        // Si no hay originalAmount, intentar usar CashReceived y CashCurrency para efectivo
        // Si no hay ninguno, usar Amount (que siempre está en Bs) como último recurso
        var montoOriginal = payment.PaymentDetails?.OriginalAmount ?? 
                           payment.PaymentDetails?.CashReceived ?? 
                           payment.Amount;
        var monedaOriginal = payment.PaymentDetails?.OriginalCurrency ?? 
                            payment.PaymentDetails?.CashCurrency ?? 
                            "Bs";
        
        // Calcular monto en Bs
        var montoBs = monedaOriginal == "Bs" 
            ? montoOriginal 
            : montoOriginal * (payment.PaymentDetails?.ExchangeRate ?? 1);

        return new PaymentReportRow
        {
            Fecha = paymentDate.ToString("yyyy-MM-dd"),
            Pedido = order.OrderNumber,
            Cliente = order.ClientName,
            MetodoPago = payment.Method,
            MontoOriginal = montoOriginal,
            MonedaOriginal = monedaOriginal,
            MontoBs = montoBs,
            Cuenta = cuenta,
            Referencia = referencia
        };
    }

    private string GetPaymentReference(PaymentDetails? paymentDetails, string paymentMethod)
    {
        if (paymentDetails == null) return string.Empty;

        if (paymentMethod == "Zelle" && !string.IsNullOrWhiteSpace(paymentDetails.TransferenciaReference))
        {
            return paymentDetails.TransferenciaReference;
        }

        if (paymentMethod == "Pago Móvil" && !string.IsNullOrWhiteSpace(paymentDetails.PagomovilReference))
        {
            return paymentDetails.PagomovilReference;
        }

        if (paymentMethod == "Transferencia" && !string.IsNullOrWhiteSpace(paymentDetails.TransferenciaReference))
        {
            return paymentDetails.TransferenciaReference;
        }

        return string.Empty;
    }

    private string GetAccountDisplay(PaymentDetails? paymentDetails)
    {
        if (paymentDetails == null) return "-";
        
        // Si es cuenta digital, mostrar email
        if (!string.IsNullOrWhiteSpace(paymentDetails.Email))
        {
            return paymentDetails.Email;
        }
        
        // Si es cuenta bancaria, mostrar número enmascarado y banco
        if (!string.IsNullOrWhiteSpace(paymentDetails.AccountNumber) && 
            !string.IsNullOrWhiteSpace(paymentDetails.Bank))
        {
            var maskedNumber = MaskAccountNumber(paymentDetails.AccountNumber);
            return $"{maskedNumber} - {paymentDetails.Bank}";
        }
        
        return "-";
    }

    private string MaskAccountNumber(string accountNumber)
    {
        if (string.IsNullOrWhiteSpace(accountNumber) || accountNumber.Length < 8)
        {
            return accountNumber;
        }
        
        var first4 = accountNumber.Substring(0, 4);
        var last4 = accountNumber.Substring(accountNumber.Length - 4);
        return $"{first4}****{last4}";
    }

    private class PaymentReportRow
    {
        public string Fecha { get; set; } = string.Empty;
        public string Pedido { get; set; } = string.Empty;
        public string Cliente { get; set; } = string.Empty;
        public string MetodoPago { get; set; } = string.Empty;
        public decimal MontoOriginal { get; set; }
        public string MonedaOriginal { get; set; } = string.Empty;
        public decimal MontoBs { get; set; }
        public string Cuenta { get; set; } = string.Empty;
        public string Referencia { get; set; } = string.Empty;
    }
}



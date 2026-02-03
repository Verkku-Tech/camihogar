using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.Extensions.Logging;
using SpreadsheetLight;
using Ordina.Database.Entities.Order;
using Ordina.Database.Entities.Category;
using Ordina.Database.Entities.Commission;
using Ordina.Database.Entities.User;
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
    
    Task<Stream> GenerateCommissionsReportAsync(
        DateTime startDate,
        DateTime endDate,
        string? vendorId = null,
        string? team = null);
    
    Task<Stream> GenerateCommissionsReportFromDataAsync(
        List<CommissionReportRowDto> reportData);
    
    Task<List<CommissionReportRowDto>> GetCommissionsReportDataAsync(
        DateTime startDate,
        DateTime endDate,
        string? vendorId = null,
        string? team = null);
    
    Task<Stream> GenerateDispatchReportAsync(
        string? deliveryZone = null,
        DateTime? startDate = null,
        DateTime? endDate = null);
    
    Task<List<DispatchReportRowDto>> GetDispatchReportDataAsync(
        string? deliveryZone = null,
        DateTime? startDate = null,
        DateTime? endDate = null);
}

public class ReportService : IReportService
{
    private static readonly HashSet<string> ValidManufacturingStatuses = new HashSet<string>(new[]
    {
        "debe_fabricar",
        "fabricando",
        "almacen_no_fabricado"
    }, StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> FabricationLocationStatuses = new HashSet<string>(new[]
    {
        "mandar_a_fabricar",
        "fabricacion"
    }, StringComparer.OrdinalIgnoreCase);

    private readonly IOrderRepository _orderRepository;
    private readonly IProviderRepository _providerRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly ICommissionRepository _commissionRepository;
    private readonly IProductCommissionRepository _productCommissionRepository;
    private readonly ISaleTypeCommissionRuleRepository _saleTypeCommissionRuleRepository;
    private readonly IUserRepository _userRepository;
    private readonly IClientRepository _clientRepository;
    private readonly ILogger<ReportService> _logger;

    public ReportService(
        IOrderRepository orderRepository,
        IProviderRepository providerRepository,
        ICategoryRepository categoryRepository,
        ICommissionRepository commissionRepository,
        IProductCommissionRepository productCommissionRepository,
        ISaleTypeCommissionRuleRepository saleTypeCommissionRuleRepository,
        IUserRepository userRepository,
        IClientRepository clientRepository,
        ILogger<ReportService> logger)
    {
        _orderRepository = orderRepository;
        _providerRepository = providerRepository;
        _categoryRepository = categoryRepository;
        _commissionRepository = commissionRepository;
        _productCommissionRepository = productCommissionRepository;
        _saleTypeCommissionRuleRepository = saleTypeCommissionRuleRepository;
        _userRepository = userRepository;
        _clientRepository = clientRepository;
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
            !ValidManufacturingStatuses.Contains(status))
        {
            throw new ArgumentException("El estado debe ser: debe_fabricar, fabricando o almacen_no_fabricado", nameof(status));
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
            !ValidManufacturingStatuses.Contains(status))
        {
            throw new ArgumentException("El estado debe ser: debe_fabricar, fabricando o almacen_no_fabricado", nameof(status));
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
        var normalizedStatus = NormalizeManufacturingStatus(status);

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
                // Solo productos que deben mandarse a fabricar (aceptar "mandar_a_fabricar" y "FABRICACION")
                if (!IsFabricationLocation(product.LocationStatus))
                {
                    continue;
                }

                // Determinar el estado real del producto
                var productStatus = NormalizeManufacturingStatus(product.ManufacturingStatus);

                // Filtrar por el estado solicitado
                if (!productStatus.Equals(normalizedStatus, StringComparison.OrdinalIgnoreCase))
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
                    "almacen_no_fabricado" => "En almacén",
                    "fabricado" => "En almacén", // legacy
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

    private static string NormalizeManufacturingStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return "debe_fabricar";
        }

        var normalized = status.Trim().ToLowerInvariant();
        // Legacy: "fabricado" se trata como "almacen_no_fabricado"
        if (normalized == "fabricado") return "almacen_no_fabricado";
        return ValidManufacturingStatuses.Contains(normalized) ? normalized : "debe_fabricar";
    }

    private static bool IsFabricationLocation(string? locationStatus)
    {
        if (string.IsNullOrWhiteSpace(locationStatus))
        {
            return false;
        }

        return FabricationLocationStatuses.Contains(locationStatus.Trim());
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

    // ================================================================
    // COMMISSIONS REPORT METHODS
    // ================================================================

    public async Task<Stream> GenerateCommissionsReportAsync(
        DateTime startDate,
        DateTime endDate,
        string? vendorId = null,
        string? team = null)
    {
        try
        {
            _logger.LogInformation("Iniciando generación de reporte de comisiones");
            
            var reportData = await GetFilteredCommissionsDataAsync(
                startDate,
                endDate,
                vendorId,
                team);

            // Convertir de CommissionReportRow (clase interna) a CommissionReportRowDto
            var dtoData = reportData.Select(row => new CommissionReportRowDto
            {
                Fecha = row.Fecha,
                Cliente = row.Cliente,
                Vendedor = row.Vendedor,
                Pedido = row.Pedido,
                Descripcion = row.Descripcion,
                CantidadArticulos = row.CantidadArticulos,
                TipoCompra = row.TipoCompra,
                Comision = row.Comision,
                VendedorSecundario = row.VendedorSecundario,
                ComisionSecundaria = row.ComisionSecundaria,
                SueldoBase = row.SueldoBase,
                TasaComisionBase = row.TasaComisionBase,
                TasaAplicadaVendedor = row.TasaAplicadaVendedor,
                TasaAplicadaReferido = row.TasaAplicadaReferido,
                EsVentaCompartida = row.EsVentaCompartida,
                EsVendedorExclusivo = row.EsVendedorExclusivo
            }).ToList();

            return await GenerateCommissionsReportFromDataAsync(dtoData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al generar reporte de comisiones");
            throw;
        }
    }

    public Task<Stream> GenerateCommissionsReportFromDataAsync(
        List<CommissionReportRowDto> reportData)
    {
        try
        {
            _logger.LogInformation("Generando Excel de comisiones con {Count} registros", reportData.Count);

            // Ordenar por fecha (más reciente primero)
            var sortedData = reportData
                .OrderByDescending(r => r.Fecha)
                .ThenBy(r => r.Cliente)
                .ToList();

            // Generar Excel con SpreadsheetLight
            var stream = new MemoryStream();
            
            using (var sl = new SLDocument())
            {
                // Headers en la fila 1 (según especificaciones del documento)
                sl.SetCellValue(1, 1, "Fecha");
                sl.SetCellValue(1, 2, "Cliente");
                sl.SetCellValue(1, 3, "Vendedor");
                sl.SetCellValue(1, 4, "Pedido");
                sl.SetCellValue(1, 5, "Cant. Artículos");
                sl.SetCellValue(1, 6, "Tipo de Compra");
                sl.SetCellValue(1, 7, "Comisión Vendedor");
                sl.SetCellValue(1, 8, "Total Comisión + Sueldo");
                sl.SetCellValue(1, 9, "Comisión Postventa");

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
                foreach (var item in sortedData)
                {
                    sl.SetCellValue(row, 1, item.Fecha);
                    sl.SetCellValue(row, 2, item.Cliente);
                    sl.SetCellValue(row, 3, item.Vendedor);
                    sl.SetCellValue(row, 4, item.Pedido);
                    sl.SetCellValue(row, 5, item.CantidadArticulos);
                    sl.SetCellValue(row, 6, item.TipoCompra);
                    sl.SetCellValue(row, 7, (double)item.Comision);
                    sl.SetCellValue(row, 8, (double)item.TotalComisionMasSueldo);
                    sl.SetCellValue(row, 9, item.ComisionSecundaria.HasValue ? (double)item.ComisionSecundaria.Value : 0);
                    row++;
                }

                // Ajustar ancho de columnas
                sl.SetColumnWidth(1, 20);  // Fecha
                sl.SetColumnWidth(2, 30);  // Cliente
                sl.SetColumnWidth(3, 30);  // Vendedor
                sl.SetColumnWidth(4, 15);  // Pedido
                sl.SetColumnWidth(5, 15);  // Cant. Artículos
                sl.SetColumnWidth(6, 20);  // Tipo de Compra
                sl.SetColumnWidth(7, 18);  // Comisión Vendedor
                sl.SetColumnWidth(8, 22);  // Total Comisión + Sueldo
                sl.SetColumnWidth(9, 18);  // Comisión Postventa

                // Guardar en el stream antes de que se cierre el SLDocument
                sl.SaveAs(stream);
            }

            stream.Position = 0;
            return Task.FromResult<Stream>(stream);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al generar Excel de comisiones");
            throw;
        }
    }

    public async Task<List<CommissionReportRowDto>> GetCommissionsReportDataAsync(
        DateTime startDate,
        DateTime endDate,
        string? vendorId = null,
        string? team = null)
    {
        try
        {
            _logger.LogInformation("Obteniendo datos del reporte de comisiones");
            
            var reportData = await GetFilteredCommissionsDataAsync(
                startDate,
                endDate,
                vendorId,
                team);

            // Ordenar por fecha (más reciente primero)
            reportData = reportData
                .OrderByDescending(r => r.Fecha)
                .ThenBy(r => r.Cliente)
                .ToList();

            return reportData.Select(row => new CommissionReportRowDto
            {
                Fecha = row.Fecha,
                Cliente = row.Cliente,
                Vendedor = row.Vendedor,
                Pedido = row.Pedido,
                Descripcion = row.Descripcion,
                CantidadArticulos = row.CantidadArticulos,
                TipoCompra = row.TipoCompra,
                Comision = row.Comision,
                VendedorSecundario = row.VendedorSecundario,
                ComisionSecundaria = row.ComisionSecundaria,
                SueldoBase = row.SueldoBase,
                TasaComisionBase = row.TasaComisionBase,
                TasaAplicadaVendedor = row.TasaAplicadaVendedor,
                TasaAplicadaReferido = row.TasaAplicadaReferido,
                EsVentaCompartida = row.EsVentaCompartida,
                EsVendedorExclusivo = row.EsVendedorExclusivo
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener datos del reporte de comisiones");
            throw;
        }
    }

    private async Task<List<CommissionReportRow>> GetFilteredCommissionsDataAsync(
        DateTime startDate,
        DateTime endDate,
        string? vendorId = null,
        string? team = null)
    {
        var orders = await _orderRepository.GetAllAsync();
        var productCommissions = await _productCommissionRepository.GetAllAsync();
        var saleTypeRules = await _saleTypeCommissionRuleRepository.GetAllAsync();
        var users = await _userRepository.GetAllAsync();
        var reportData = new List<CommissionReportRow>();

        // Ajustar rango de fechas según el equipo si es necesario
        var (adjustedStartDate, adjustedEndDate) = AdjustDateRangeForTeam(startDate, endDate, team);

        foreach (var order in orders)
        {
            // Filtrar por fecha (OBLIGATORIO)
            if (order.CreatedAt < adjustedStartDate || order.CreatedAt > adjustedEndDate)
                continue;

            // Filtrar por vendedor si se especifica
            if (!string.IsNullOrWhiteSpace(vendorId) && order.VendorId != vendorId)
                continue;

            // Obtener datos del vendedor principal
            var mainVendor = users.FirstOrDefault(u => u.Id == order.VendorId);
            var isExclusiveVendor = mainVendor?.ExclusiveCommission ?? false;
            var vendorBaseSalary = mainVendor?.BaseSalary ?? 0m;

            // Procesar cada producto del pedido (una fila por producto)
            foreach (var product in order.Products)
            {
                var isSharedSale = !string.IsNullOrWhiteSpace(order.ReferrerId);
                
                // Calcular comisiones usando el nuevo sistema
                var (vendorCommission, referrerCommission, baseRate, appliedVendorRate, appliedReferrerRate) = 
                    CalculateProductCommission(product, order, productCommissions, saleTypeRules, users, isExclusiveVendor);
                
                if (isSharedSale && !isExclusiveVendor)
                {
                    // VENTA COMPARTIDA: Comisión según reglas de tipo de venta
                    reportData.Add(new CommissionReportRow
                    {
                        Fecha = order.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                        Cliente = order.ClientName,
                        Vendedor = order.VendorName,
                        Pedido = order.OrderNumber,
                        Descripcion = await FormatProductDescriptionAsync(product),
                        CantidadArticulos = product.Quantity,
                        TipoCompra = GetPurchaseType(order),
                        Comision = vendorCommission,
                        VendedorSecundario = order.ReferrerName,
                        ComisionSecundaria = referrerCommission,
                        SueldoBase = vendorBaseSalary,
                        TasaComisionBase = baseRate,
                        TasaAplicadaVendedor = appliedVendorRate,
                        TasaAplicadaReferido = appliedReferrerRate,
                        EsVentaCompartida = true,
                        EsVendedorExclusivo = isExclusiveVendor
                    });
                }
                else
                {
                    // VENTA NORMAL o VENDEDOR EXCLUSIVO: Comisión completa para vendedor
                    reportData.Add(new CommissionReportRow
                    {
                        Fecha = order.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                        Cliente = order.ClientName,
                        Vendedor = order.VendorName,
                        Pedido = order.OrderNumber,
                        Descripcion = await FormatProductDescriptionAsync(product),
                        CantidadArticulos = product.Quantity,
                        TipoCompra = GetPurchaseType(order),
                        Comision = vendorCommission,
                        SueldoBase = vendorBaseSalary,
                        TasaComisionBase = baseRate,
                        TasaAplicadaVendedor = appliedVendorRate,
                        EsVentaCompartida = false,
                        EsVendedorExclusivo = isExclusiveVendor
                    });
                }
            }
        }

        return reportData;
    }

    /// <summary>
    /// Calcula la comisión de un producto según el nuevo sistema:
    /// 1. Obtiene la comisión base de la categoría/familia del producto
    /// 2. Si es venta compartida, aplica las reglas de distribución por tipo de venta
    /// 3. Si el vendedor es exclusivo, no se comparte la comisión
    /// </summary>
    private (decimal vendorCommission, decimal referrerCommission, decimal baseRate, decimal appliedVendorRate, decimal appliedReferrerRate) 
        CalculateProductCommission(
            OrderProduct product,
            Order order,
            IEnumerable<ProductCommission> productCommissions,
            IEnumerable<SaleTypeCommissionRule> saleTypeRules,
            IEnumerable<User> users,
            bool isExclusiveVendor)
    {
        // 1. Obtener comisión base de la categoría del producto
        var categoryCommission = productCommissions.FirstOrDefault(c => 
            c.CategoryName.Equals(product.Category, StringComparison.OrdinalIgnoreCase) || 
            c.CategoryId == product.Category);
        
        var baseCommissionRate = categoryCommission?.CommissionValue ?? 0m;
        
        if (baseCommissionRate == 0)
        {
            _logger.LogWarning("No se encontró comisión configurada para la categoría '{Category}' del producto '{Product}'", 
                product.Category, product.Name);
            return (0m, 0m, 0m, 0m, 0m);
        }

        // 2. Calcular monto base del producto
        var productTotal = product.Total;
        
        // 3. Verificar si es venta compartida
        var isSharedSale = !string.IsNullOrWhiteSpace(order.ReferrerId);

        if (isSharedSale && !isExclusiveVendor)
        {
            // VENTA COMPARTIDA: Aplicar distribución según tipo de venta
            var saleType = DetermineSaleType(order);
            var rule = saleTypeRules.FirstOrDefault(r => 
                r.SaleType.Equals(saleType, StringComparison.OrdinalIgnoreCase));
            
            if (rule != null)
            {
                // La comisión se calcula aplicando el porcentaje de la regla al total del producto
                var vendorCommission = productTotal * (rule.VendorRate / 100);
                var referrerCommission = productTotal * (rule.ReferrerRate / 100);
                
                return (vendorCommission, referrerCommission, baseCommissionRate, rule.VendorRate, rule.ReferrerRate);
            }
            else
            {
                // Sin regla definida para este tipo de venta, usar comisión base dividida 50/50
                _logger.LogWarning("No se encontró regla de distribución para el tipo de venta '{SaleType}'. Dividiendo 50/50.", saleType);
                var halfCommission = productTotal * (baseCommissionRate / 100) / 2;
                return (halfCommission, halfCommission, baseCommissionRate, baseCommissionRate / 2, baseCommissionRate / 2);
            }
        }
        else
        {
            // VENTA NORMAL o VENDEDOR EXCLUSIVO: Comisión completa
            var fullCommission = productTotal * (baseCommissionRate / 100);
            return (fullCommission, 0m, baseCommissionRate, baseCommissionRate, 0m);
        }
    }

    /// <summary>
    /// Determina el tipo de venta del pedido para aplicar las reglas de distribución
    /// </summary>
    private string DetermineSaleType(Order order)
    {
        // Priorizar saleType, luego deliveryType
        if (!string.IsNullOrWhiteSpace(order.SaleType))
            return order.SaleType;
        
        if (!string.IsNullOrWhiteSpace(order.DeliveryType))
            return order.DeliveryType;
        
        return "entrega"; // Default
    }

    private string GetPurchaseType(Order order)
    {
        // Mapear deliveryType a tipo de compra
        if (!string.IsNullOrWhiteSpace(order.DeliveryType))
        {
            return order.DeliveryType switch
            {
                "entrega_programada" => "Entrega",
                "delivery_express" => "Delivery express",
                "retiro_tienda" => "Retiro por tienda",
                "retiro_almacen" => "Retiro por almacén",
                _ => order.DeliveryType
            };
        }

        // Fallback a saleType
        if (!string.IsNullOrWhiteSpace(order.SaleType))
        {
            return order.SaleType switch
            {
                "encargo" => "Encargo",
                "entrega" => "Entrega",
                "sistema_apartado" => "Sistema Apartado",
                _ => order.SaleType
            };
        }

        return "-";
    }

    private (DateTime start, DateTime end) AdjustDateRangeForTeam(DateTime startDate, DateTime endDate, string? team)
    {
        // Si no se especifica equipo, usar las fechas tal cual
        if (string.IsNullOrWhiteSpace(team))
            return (startDate, endDate);

        // Los ajustes por equipo se pueden hacer aquí si es necesario
        // Por ahora, retornamos las fechas tal cual
        return (startDate, endDate);
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

    // ================================================================
    // DISPATCH REPORT METHODS
    // ================================================================

    public async Task<Stream> GenerateDispatchReportAsync(
        string? deliveryZone = null,
        DateTime? startDate = null,
        DateTime? endDate = null)
    {
        try
        {
            _logger.LogInformation("Iniciando generación de reporte de despacho");
            
            var reportData = await GetFilteredDispatchDataAsync(
                deliveryZone,
                startDate,
                endDate);

            // Ordenar por zona y luego por fecha
            reportData = reportData
                .OrderBy(r => string.IsNullOrWhiteSpace(r.Zona) ? "ZZZ" : r.Zona)
                .ThenBy(r => r.Fecha)
                .ThenBy(r => r.NotaDespacho)
                .ToList();

            // Generar Excel con SpreadsheetLight
            var stream = new MemoryStream();
            
            using (var sl = new SLDocument())
            {
                // Headers en la fila 1
                sl.SetCellValue(1, 1, "Fecha");
                sl.SetCellValue(1, 2, "Nota de despacho");
                sl.SetCellValue(1, 3, "Cliente");
                sl.SetCellValue(1, 4, "Telefono1");
                sl.SetCellValue(1, 5, "Telefono2");
                sl.SetCellValue(1, 6, "Cantidad");
                sl.SetCellValue(1, 7, "Descripcion");
                sl.SetCellValue(1, 8, "Zona");
                sl.SetCellValue(1, 9, "Direccion");
                sl.SetCellValue(1, 10, "Observaciones");
                sl.SetCellValue(1, 11, "Estado de Pago");
                sl.SetCellValue(1, 12, "Importe Total");

                // Estilo de headers
                var headerStyle = sl.CreateStyle();
                headerStyle.Font.Bold = true;

                // Aplicar estilo a las celdas de headers
                for (int col = 1; col <= 12; col++)
                {
                    sl.SetCellStyle(1, col, headerStyle);
                }

                // Llenar datos desde la fila 2
                int row = 2;
                foreach (var item in reportData)
                {
                    sl.SetCellValue(row, 1, item.Fecha);
                    sl.SetCellValue(row, 2, item.NotaDespacho);
                    sl.SetCellValue(row, 3, item.Cliente);
                    sl.SetCellValue(row, 4, item.Telefono1);
                    sl.SetCellValue(row, 5, item.Telefono2);
                    sl.SetCellValue(row, 6, item.CantidadTotal);
                    sl.SetCellValue(row, 7, item.Descripcion);
                    sl.SetCellValue(row, 8, item.Zona);
                    sl.SetCellValue(row, 9, item.Direccion);
                    sl.SetCellValue(row, 10, item.Observaciones);
                    sl.SetCellValue(row, 11, item.EstadoPago);
                    sl.SetCellValue(row, 12, item.ImporteTotal);
                    row++;
                }

                // Ajustar ancho de columnas
                sl.SetColumnWidth(1, 12);  // Fecha
                sl.SetColumnWidth(2, 18);  // Nota de despacho
                sl.SetColumnWidth(3, 25);  // Cliente
                sl.SetColumnWidth(4, 15);  // Telefono1
                sl.SetColumnWidth(5, 15);  // Telefono2
                sl.SetColumnWidth(6, 10);  // Cantidad
                sl.SetColumnWidth(7, 60);  // Descripcion
                sl.SetColumnWidth(8, 20);  // Zona
                sl.SetColumnWidth(9, 40);  // Direccion
                sl.SetColumnWidth(10, 40); // Observaciones
                sl.SetColumnWidth(11, 15); // Estado de Pago
                sl.SetColumnWidth(12, 15); // Importe Total

                // Guardar en el stream antes de que se cierre el SLDocument
                sl.SaveAs(stream);
            }

            stream.Position = 0;
            return stream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al generar reporte de despacho");
            throw;
        }
    }

    public async Task<List<DispatchReportRowDto>> GetDispatchReportDataAsync(
        string? deliveryZone = null,
        DateTime? startDate = null,
        DateTime? endDate = null)
    {
        try
        {
            _logger.LogInformation("Obteniendo datos del reporte de despacho");
            
            var reportData = await GetFilteredDispatchDataAsync(
                deliveryZone,
                startDate,
                endDate);

            // Ordenar por zona y luego por fecha
            reportData = reportData
                .OrderBy(r => string.IsNullOrWhiteSpace(r.Zona) ? "ZZZ" : r.Zona)
                .ThenBy(r => r.Fecha)
                .ThenBy(r => r.NotaDespacho)
                .ToList();

            return reportData.Select(row => new DispatchReportRowDto
            {
                Fecha = row.Fecha,
                NotaDespacho = row.NotaDespacho,
                Cliente = row.Cliente,
                Telefono1 = row.Telefono1,
                Telefono2 = row.Telefono2,
                CantidadTotal = row.CantidadTotal,
                Descripcion = row.Descripcion,
                Zona = row.Zona,
                Direccion = row.Direccion,
                Observaciones = row.Observaciones,
                EstadoPago = row.EstadoPago,
                ImporteTotal = row.ImporteTotal
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener datos del reporte de despacho");
            throw;
        }
    }

    private async Task<List<DispatchReportRow>> GetFilteredDispatchDataAsync(
        string? deliveryZone = null,
        DateTime? startDate = null,
        DateTime? endDate = null)
    {
        var orders = await _orderRepository.GetAllAsync();
        var clients = await _clientRepository.GetAllAsync();
        var reportData = new List<DispatchReportRow>();

        foreach (var order in orders)
        {
            // Solo pedidos completados (listos para despacho)
            if (order.Status != "Completado" && order.Status != "Completada")
                continue;

            // Filtrar por zona (FILTRO PRINCIPAL)
            if (!string.IsNullOrWhiteSpace(deliveryZone) && 
                order.DeliveryZone != deliveryZone)
                continue;

            // Filtrar por fecha (opcional)
            if (startDate.HasValue && order.CreatedAt < startDate.Value)
                continue;
            if (endDate.HasValue && order.CreatedAt > endDate.Value.AddDays(1).AddSeconds(-1))
                continue;

            // Obtener datos del cliente
            var client = clients.FirstOrDefault(c => c.Id == order.ClientId);
            
            // Agrupar productos: concatenar descripciones
            var productDescriptions = new List<string>();
            if (order.Products != null && order.Products.Count > 0)
            {
                foreach (var product in order.Products)
                {
                    try
                    {
                        var productDesc = await FormatProductDescriptionAsync(product);
                        productDescriptions.Add($"{product.Quantity}x {productDesc}");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error al formatear descripción del producto {ProductName} en pedido {OrderNumber}", 
                            product?.Name ?? "desconocido", order.OrderNumber);
                        productDescriptions.Add($"{product?.Quantity ?? 0}x {product?.Name ?? "Producto desconocido"}");
                    }
                }
            }
            var descripcionCompleta = productDescriptions.Count > 0 
                ? string.Join(" | ", productDescriptions) 
                : "Sin productos";
            
            // Calcular cantidad total
            var cantidadTotal = order.Products?.Sum(p => p.Quantity) ?? 0;

            // Obtener tasa de cambio USD (usar la del pedido guardada al crear)
            decimal usdRate;
            decimal importeTotalUsd;
            string estadoPago;
            
            try
            {
                usdRate = GetUsdExchangeRate(order);
                
                // Convertir total a USD
                importeTotalUsd = order.Total / usdRate;

                // Determinar estado de pago (en USD)
                estadoPago = DeterminePaymentStatusInUsd(order, usdRate);
            }
            catch (InvalidOperationException ex)
            {
                // Si no hay tasa de cambio, omitir este pedido del reporte
                _logger.LogWarning("Omitiendo pedido {OrderNumber} del reporte de despacho: {Error}", 
                    order.OrderNumber, ex.Message);
                continue; // Saltar este pedido y continuar con el siguiente
            }

            // Mapear zona
            var zonaDisplay = MapDeliveryZone(order.DeliveryZone);

            reportData.Add(new DispatchReportRow
            {
                Fecha = order.CreatedAt.ToString("yyyy-MM-dd"),
                NotaDespacho = order.OrderNumber,
                Cliente = order.ClientName,
                Telefono1 = client?.Telefono ?? "",
                Telefono2 = client?.Telefono2 ?? "",
                CantidadTotal = cantidadTotal,
                Descripcion = descripcionCompleta,
                Zona = zonaDisplay,
                Direccion = order.DeliveryAddress ?? "",
                Observaciones = order.Observations ?? "",
                EstadoPago = estadoPago,
                ImporteTotal = importeTotalUsd
            });
        }

        return reportData;
    }

    private string MapDeliveryZone(string? zone)
    {
        if (string.IsNullOrWhiteSpace(zone))
            return "-";

        return zone switch
        {
            "caracas" => "Caracas",
            "g_g" => "G&G",
            "san_antonio_los_teques" => "San Antonio Los Teques",
            "caucagua_higuerote" => "Caucagua/Higuerote",
            "la_guaira" => "La Guaira",
            "charallave_cua" => "Charallave/Cua",
            "interior_pais" => "Interior País",
            _ => zone
        };
    }

    private string DeterminePaymentStatus(Order order)
    {
        try
        {
            // Calcular total pagado
            var totalPagado = CalculateTotalPaid(order);
            var total = order.Total;
            
            if (total <= 0)
                return "Pendiente";
            
            if (totalPagado >= total)
                return "Pagado";
            
            if (totalPagado > 0)
                return $"Parcial ({totalPagado:C})";
            
            return "Pendiente";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error al determinar estado de pago para pedido {OrderNumber}", order.OrderNumber);
            return "Pendiente";
        }
    }

    private string DeterminePaymentStatusInUsd(Order order, decimal usdRate)
    {
        try
        {
            // Calcular total pagado en Bs
            var totalPagadoBs = CalculateTotalPaid(order);
            var totalBs = order.Total;
            
            // Convertir a USD
            var totalPagadoUsd = totalPagadoBs / usdRate;
            var totalUsd = totalBs / usdRate;
            
            if (totalUsd <= 0)
                return "Pendiente";
            
            if (totalPagadoUsd >= totalUsd)
                return "Pagado";
            
            if (totalPagadoUsd > 0)
                return $"Parcial (${totalPagadoUsd:F2})";
            
            return "Pendiente";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error al determinar estado de pago en USD para pedido {OrderNumber}", order.OrderNumber);
            return "Pendiente";
        }
    }

    private decimal GetUsdExchangeRate(Order order)
    {
        // PRIORIDAD 1: Usar la tasa guardada al crear el pedido (más confiable)
        if (order.ExchangeRatesAtCreation?.Usd != null && 
            order.ExchangeRatesAtCreation.Usd.Rate > 0)
        {
            _logger.LogInformation("Usando tasa USD del día de creación del pedido {OrderNumber}: {Rate}", 
                order.OrderNumber, order.ExchangeRatesAtCreation.Usd.Rate);
            return order.ExchangeRatesAtCreation.Usd.Rate;
        }

        // PRIORIDAD 2: Intentar obtener de PaymentDetails del pedido principal
        if (order.PaymentDetails?.ExchangeRate.HasValue == true && 
            order.PaymentDetails.ExchangeRate > 0)
        {
            _logger.LogInformation("Usando tasa USD de PaymentDetails del pedido {OrderNumber}: {Rate}", 
                order.OrderNumber, order.PaymentDetails.ExchangeRate.Value);
            return order.PaymentDetails.ExchangeRate.Value;
        }

        // PRIORIDAD 3: Buscar en pagos parciales
        if (order.PartialPayments != null && order.PartialPayments.Count > 0)
        {
            var rate = order.PartialPayments
                .FirstOrDefault(p => p.PaymentDetails?.ExchangeRate.HasValue == true && 
                                    p.PaymentDetails.ExchangeRate > 0)
                ?.PaymentDetails?.ExchangeRate;
            if (rate.HasValue)
            {
                _logger.LogInformation("Usando tasa USD de un pago parcial del pedido {OrderNumber}: {Rate}", 
                    order.OrderNumber, rate.Value);
                return rate.Value;
            }
        }

        // PRIORIDAD 4: Buscar en pagos mixtos
        if (order.MixedPayments != null && order.MixedPayments.Count > 0)
        {
            var rate = order.MixedPayments
                .FirstOrDefault(p => p.PaymentDetails?.ExchangeRate.HasValue == true && 
                                    p.PaymentDetails.ExchangeRate > 0)
                ?.PaymentDetails?.ExchangeRate;
            if (rate.HasValue)
            {
                _logger.LogInformation("Usando tasa USD de un pago mixto del pedido {OrderNumber}: {Rate}", 
                    order.OrderNumber, rate.Value);
                return rate.Value;
            }
        }

        // Si no se encuentra ninguna tasa, lanzar excepción en lugar de usar un valor fijo
        _logger.LogError("No se encontró tasa de cambio USD para pedido {OrderNumber}. El pedido no tiene tasa guardada ni en pagos.", order.OrderNumber);
        throw new InvalidOperationException($"No se encontró tasa de cambio USD para el pedido {order.OrderNumber}. Es necesario que el pedido tenga una tasa de cambio registrada para generar el reporte en dólares.");
    }

    private decimal CalculateTotalPaid(Order order)
    {
        decimal totalPagado = 0;

        // Sumar pagos mixtos
        if (order.MixedPayments != null && order.MixedPayments.Count > 0)
        {
            foreach (var payment in order.MixedPayments)
            {
                var monto = payment.PaymentDetails?.OriginalAmount ?? 
                           payment.PaymentDetails?.CashReceived ?? 
                           payment.Amount;
                var moneda = payment.PaymentDetails?.OriginalCurrency ?? 
                            payment.PaymentDetails?.CashCurrency ?? 
                            "Bs";
                
                // Convertir a Bs si es necesario
                if (moneda != "Bs")
                {
                    monto = monto * (payment.PaymentDetails?.ExchangeRate ?? 1);
                }
                
                totalPagado += monto;
            }
        }

        // Sumar pagos parciales
        if (order.PartialPayments != null && order.PartialPayments.Count > 0)
        {
            foreach (var payment in order.PartialPayments)
            {
                var monto = payment.PaymentDetails?.OriginalAmount ?? 
                           payment.PaymentDetails?.CashReceived ?? 
                           payment.Amount;
                var moneda = payment.PaymentDetails?.OriginalCurrency ?? 
                            payment.PaymentDetails?.CashCurrency ?? 
                            "Bs";
                
                // Convertir a Bs si es necesario
                if (moneda != "Bs")
                {
                    monto = monto * (payment.PaymentDetails?.ExchangeRate ?? 1);
                }
                
                totalPagado += monto;
            }
        }

        // Si no hay pagos parciales ni mixtos, verificar pago principal
        if ((order.MixedPayments == null || order.MixedPayments.Count == 0) &&
            (order.PartialPayments == null || order.PartialPayments.Count == 0) &&
            !string.IsNullOrWhiteSpace(order.PaymentMethod))
        {
            var monto = order.PaymentDetails?.OriginalAmount ?? 
                       order.PaymentDetails?.CashReceived ?? 
                       order.Total;
            var moneda = order.PaymentDetails?.OriginalCurrency ?? 
                        order.PaymentDetails?.CashCurrency ?? 
                        "Bs";
            
            // Convertir a Bs si es necesario
            if (moneda != "Bs")
            {
                monto = monto * (order.PaymentDetails?.ExchangeRate ?? 1);
            }
            
            totalPagado += monto;
        }

        return totalPagado;
    }

    private class CommissionReportRow
    {
        public string Fecha { get; set; } = string.Empty;
        public string Cliente { get; set; } = string.Empty;
        public string Vendedor { get; set; } = string.Empty;
        public string Pedido { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public int CantidadArticulos { get; set; }
        public string TipoCompra { get; set; } = string.Empty;
        public decimal Comision { get; set; }
        public string? VendedorSecundario { get; set; }
        public decimal? ComisionSecundaria { get; set; }
        public decimal SueldoBase { get; set; }
        public decimal TasaComisionBase { get; set; }
        public decimal TasaAplicadaVendedor { get; set; }
        public decimal? TasaAplicadaReferido { get; set; }
        public bool EsVentaCompartida { get; set; }
        public bool EsVendedorExclusivo { get; set; }
    }

    private class DispatchReportRow
    {
        public string Fecha { get; set; } = string.Empty;
        public string NotaDespacho { get; set; } = string.Empty;
        public string Cliente { get; set; } = string.Empty;
        public string Telefono1 { get; set; } = string.Empty;
        public string Telefono2 { get; set; } = string.Empty;
        public int CantidadTotal { get; set; }
        public string Descripcion { get; set; } = string.Empty;
        public string Zona { get; set; } = string.Empty;
        public string Direccion { get; set; } = string.Empty;
        public string Observaciones { get; set; } = string.Empty;
        public string EstadoPago { get; set; } = string.Empty;
        public decimal ImporteTotal { get; set; }
    }
}



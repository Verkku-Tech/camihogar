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
using Ordina.Orders.Application.Commission;
using Ordina.Orders.Application;
using Ordina.Orders.Application.Dispatch;
using Ordina.Orders.Application.DTOs;
using Ordina.Orders.Application.Helpers;

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
        string? storeId = null);

    Task<Stream> GenerateCommissionsReportFromDataAsync(
        List<CommissionReportRowDto> reportData);

    Task<List<CommissionReportRowDto>> GetCommissionsReportDataAsync(
        DateTime startDate,
        DateTime endDate,
        string? vendorId = null,
        string? storeId = null);

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
        "por_fabricar",
        "fabricando",
        "almacen_no_fabricado"
    }, StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> FabricationLocationStatuses = new HashSet<string>(new[]
    {
        "mandar_a_fabricar",
        "fabricacion"
    }, StringComparer.OrdinalIgnoreCase);

    /// <summary>Mismos nombres que en la app (Mongo/UI). Pagos en divisas: el reporte no calcula equivalente en Bs.</summary>
    private static readonly HashSet<string> ForeignCurrencyOnlyPaymentMethods = new HashSet<string>(new[]
    {
        "AirTM",
        "Banesco Panamá",
        "Binance",
        "Facebank",
        "Mercantil Panamá",
        "Paypal",
        "Zelle",
    }, StringComparer.OrdinalIgnoreCase);

    /// <summary>Misma cadena que CASHEA_FINANCED_METHOD_LABEL en el front (order-payments.ts).</summary>
    private const string CasheaFinancedMethodLabel = "Cashea (financiación)";

    /// <summary>Mismo valor que NO_APLICA_CUENTA_FILTER en payments-report.tsx.</summary>
    private const string NoAplicaCuentaFilterValue = "__no_aplica__";

    private const string NoAplicaCuentaDisplay = "N/A";

    private readonly IOrderRepository _orderRepository;
    private readonly IProviderRepository _providerRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly ICommissionRepository _commissionRepository;
    private readonly IProductCommissionRepository _productCommissionRepository;
    private readonly ISaleTypeCommissionRuleRepository _saleTypeCommissionRuleRepository;
    private readonly IUserRepository _userRepository;
    private readonly IClientRepository _clientRepository;
    private readonly IAccountRepository _accountRepository;
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
        IAccountRepository accountRepository,
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
        _accountRepository = accountRepository;
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
            throw new ArgumentException("El estado debe ser: debe_fabricar, por_fabricar, fabricando o almacen_no_fabricado", nameof(status));
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
                ObservacionesVendedor = row.ObservacionesVendedor,
                ObservacionesFabricante = row.ObservacionesFabricante,
                NotasRefabricacion = row.NotasRefabricacion
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
            throw new ArgumentException("El estado debe ser: debe_fabricar, por_fabricar, fabricando o almacen_no_fabricado", nameof(status));
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
                sl.SetCellValue(1, 8, "Obs. Vendedor");
                sl.SetCellValue(1, 9, "Obs. Fabricante");
                sl.SetCellValue(1, 10, "Notas Refabricación");

                // Estilo de headers - solo negrita por ahora
                var headerStyle = sl.CreateStyle();
                headerStyle.Font.Bold = true;

                // Aplicar estilo a las celdas de headers
                for (int col = 1; col <= 10; col++)
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
                    sl.SetCellValue(row, 8, item.ObservacionesVendedor);
                    sl.SetCellValue(row, 9, item.ObservacionesFabricante);
                    sl.SetCellValue(row, 10, item.NotasRefabricacion);
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
                sl.SetColumnWidth(8, 35);  // Obs. Vendedor
                sl.SetColumnWidth(9, 35);  // Obs. Fabricante
                sl.SetColumnWidth(10, 35); // Notas Refabricación

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
            // Alinear con Inventario → Fabricación: no listar pedidos aún no validados
            if (string.Equals(order.Status, "Generado", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(order.Status, "Generada", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            // Alinear con Inventario → Fabricación: reservas no van al reporte hasta confirmarse como pedido
            if (OrderDocumentTypes.IsReservationType(order.Type)
                || OrderDocumentTypes.IsReservationOrderNumber(order.OrderNumber))
            {
                continue;
            }

            // Filtrar por número de pedido si se especifica
            if (!string.IsNullOrWhiteSpace(orderNumber) &&
                !(order.OrderNumber ?? "").Equals(orderNumber, StringComparison.OrdinalIgnoreCase))
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
                var matchesOrder = (order.OrderNumber ?? "").ToLowerInvariant().Contains(search);
                var matchesClient = (order.ClientName ?? "").ToLowerInvariant().Contains(search);
                orderMatchesSearchByOrderOrClient = matchesOrder || matchesClient;
            }

            if (order.Products == null) continue;

            foreach (var product in order.Products)
            {
                try
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
                        var matchesProductName = (product.Name ?? "").ToLowerInvariant().Contains(search);

                        if (!matchesProductName)
                        {
                            continue;
                        }
                    }

                    // Obtener etiqueta del estado
                    var estadoLabel = productStatus switch
                    {
                        "debe_fabricar" => "Debe fabricar",
                        "por_fabricar" => "Por fabricar",
                        "fabricando" => "Fabricando",
                        "almacen_no_fabricado" => "En almacén",
                        "fabricado" => "En almacén", // legacy
                        _ => productStatus
                    };

                    reportData.Add(new ManufacturingReportRow
                    {
                        Fecha = order.CreatedAt.ToString("yyyy-MM-dd"),
                        Pedido = order.OrderNumber ?? string.Empty,
                        Estado = estadoLabel,
                        Cliente = order.ClientName ?? string.Empty,
                        Fabricante = manufacturerName,
                        Cantidad = product.Quantity,
                        Descripcion = await FormatProductDescriptionAsync(product),
                        ObservacionesVendedor = product.Observations ?? string.Empty,
                        ObservacionesFabricante = product.ManufacturingNotes ?? string.Empty,
                        NotasRefabricacion = product.RefabricationReason ?? string.Empty
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error procesando producto en reporte. Orden: {OrderNumber}, Producto: {ProductName}",
                       order.OrderNumber ?? "Unknown", product.Name ?? "Unknown");
                    // Continuar con el siguiente producto
                    continue;
                }
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
        var parts = new List<string> { product.Name ?? "Producto sin nombre" };

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
        public string ObservacionesVendedor { get; set; } = string.Empty;
        public string ObservacionesFabricante { get; set; } = string.Empty;
        public string NotasRefabricacion { get; set; } = string.Empty;
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
                MontoUsd = row.MontoUsd,
                Cuenta = row.Cuenta,
                Referencia = row.Referencia,
                OrderId = row.OrderId,
                PaymentType = row.PaymentType,
                PaymentIndex = row.PaymentIndex,
                IsConciliated = row.IsConciliated
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
                sl.SetCellValue(1, 8, "Equiv. USD (tasa pedido)");
                sl.SetCellValue(1, 9, "Cuenta");
                sl.SetCellValue(1, 10, "Referencia/Remitente");
                sl.SetCellValue(1, 11, "Conciliado");

                // Estilo de headers
                var headerStyle = sl.CreateStyle();
                headerStyle.Font.Bold = true;

                // Aplicar estilo a las celdas de headers
                for (int col = 1; col <= 11; col++)
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
                    if (item.MontoBs.HasValue)
                        sl.SetCellValue(row, 7, (double)item.MontoBs.Value);
                    else
                        sl.SetCellValue(row, 7, "—");
                    if (item.MontoUsd.HasValue)
                        sl.SetCellValue(row, 8, (double)item.MontoUsd.Value);
                    sl.SetCellValue(row, 9, item.Cuenta);
                    sl.SetCellValue(row, 10, item.Referencia);
                    sl.SetCellValue(row, 11, item.IsConciliated ? "Sí" : "No");
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
                sl.SetColumnWidth(8, 18);  // Equiv. USD
                sl.SetColumnWidth(9, 30);  // Cuenta
                sl.SetColumnWidth(10, 30);  // Referencia/Remitente
                sl.SetColumnWidth(11, 12); // Conciliado

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

        Ordina.Database.Entities.Account.Account? filterAccount = null;
        if (!string.IsNullOrWhiteSpace(accountId) && !IsNoAplicaCuentaFilter(accountId))
        {
            filterAccount = await _accountRepository.GetByIdAsync(accountId);
        }

        var reportData = new List<PaymentReportRow>();

        foreach (var order in orders)
        {
            // Presupuestos y reservas no forman parte del reporte de pagos de pedidos
            if (string.Equals(order.Type, "Budget", StringComparison.OrdinalIgnoreCase)
                || OrderDocumentTypes.IsReservationType(order.Type))
                continue;

            // Un solo origen de abonos (misma regla que el detalle del pedido): partial si existe, si no mixed
            var (activePayments, activePaymentType) = GetActivePaymentsForReport(order);
            if (activePayments.Count > 0)
            {
                for (int i = 0; i < activePayments.Count; i++)
                {
                    var payment = activePayments[i];

                    if (IsCasheaFinancingStubForReport(payment))
                        continue;

                    // Filtrar por rango de fechas del pago (calendario VE)
                    var paymentCalendarDate = PaymentCalendarDate.ToCalendarDate(payment.Date);
                    if (startDate.HasValue &&
                        paymentCalendarDate < DateOnly.FromDateTime(startDate.Value.Date))
                    {
                        continue;
                    }

                    if (endDate.HasValue &&
                        paymentCalendarDate > DateOnly.FromDateTime(endDate.Value.Date))
                    {
                        continue;
                    }

                    // Filtrar por método de pago
                    if (!string.IsNullOrWhiteSpace(paymentMethod) && payment.Method != paymentMethod)
                    {
                        continue;
                    }

                    // Filtrar por cuenta concreta (no el filtro virtual de divisas sin cuenta)
                    if (!string.IsNullOrWhiteSpace(accountId) && !IsNoAplicaCuentaFilter(accountId))
                    {
                        if (!PaymentMatchesAccountFilter(
                                payment.PaymentDetails, accountId, filterAccount))
                        {
                            continue;
                        }
                    }

                    var row = await CreatePaymentReportRowAsync(
                        order, payment, payment.Date, activePaymentType, i);
                    if (IsNoAplicaCuentaFilter(accountId) && row.Cuenta != NoAplicaCuentaDisplay)
                    {
                        continue;
                    }
                    reportData.Add(row);
                }
            }
            // Si no hay abonos en listas activas, usar el pago principal (filtrado por la fecha de la orden)
            else if (!string.IsNullOrWhiteSpace(order.PaymentMethod))
            {
                // Filtrar por rango de fechas de la orden
                if (startDate.HasValue && order.CreatedAt < startDate.Value) continue;
                if (endDate.HasValue && order.CreatedAt > endDate.Value.AddDays(1).AddSeconds(-1)) continue;

                // Filtrar por método de pago
                if (!string.IsNullOrWhiteSpace(paymentMethod) && order.PaymentMethod != paymentMethod)
                {
                    continue;
                }

                // Filtrar por cuenta concreta (no el filtro virtual de divisas sin cuenta)
                if (!string.IsNullOrWhiteSpace(accountId) && !IsNoAplicaCuentaFilter(accountId))
                {
                    if (!PaymentMatchesAccountFilter(
                            order.PaymentDetails, accountId, filterAccount))
                    {
                        continue;
                    }
                }

                var referencia = GetPaymentReference(order.PaymentDetails, order.PaymentMethod);
                var cuentaRaw = await GetAccountDisplayAsync(order.PaymentDetails);

                // Usar originalAmount y originalCurrency si están disponibles
                // Si no hay originalAmount, intentar usar CashReceived y CashCurrency para efectivo
                var montoOriginal = order.PaymentDetails?.OriginalAmount ??
                                   order.PaymentDetails?.CashReceived ??
                                   order.Total;
                var monedaOriginal = order.PaymentDetails?.OriginalCurrency ??
                                    order.PaymentDetails?.CashCurrency ??
                                    "Bs";

                var montoBs = ComputeReportMontoBs(
                    order.PaymentMethod,
                    montoOriginal,
                    monedaOriginal,
                    order.PaymentDetails?.ExchangeRate);

                var cuenta = ResolveReportCuentaDisplay(monedaOriginal, cuentaRaw);
                if (IsNoAplicaCuentaFilter(accountId) && cuenta != NoAplicaCuentaDisplay)
                {
                    continue;
                }

                reportData.Add(new PaymentReportRow
                {
                    Fecha = order.CreatedAt.ToString("yyyy-MM-dd"),
                    Pedido = order.OrderNumber,
                    Cliente = order.ClientName,
                    MetodoPago = order.PaymentMethod,
                    MontoOriginal = montoOriginal,
                    MonedaOriginal = monedaOriginal,
                    MontoBs = montoBs,
                    MontoUsd = GetMontoUsdForBsPayment(order, monedaOriginal, montoBs),
                    Cuenta = cuenta,
                    Referencia = referencia,
                    OrderId = order.Id,
                    PaymentType = "main",
                    PaymentIndex = -1,
                    IsConciliated = order.PaymentDetails?.IsConciliated ?? false
                });
            }
        }

        return reportData;
    }

    private static bool IsNoAplicaCuentaFilter(string? accountId) =>
        string.Equals(accountId, NoAplicaCuentaFilterValue, StringComparison.Ordinal);

    /// <summary>
    /// Coincide por accountId o por nombre/código guardado en bank (TDD/TDC) u otros campos legacy.
    /// Alineado con payments-report.tsx: el reporte muestra label en columna Cuenta sin exigir accountId.
    /// </summary>
    private static bool PaymentMatchesAccountFilter(
        PaymentDetails? paymentDetails,
        string filterAccountId,
        Ordina.Database.Entities.Account.Account? filterAccount)
    {
        if (string.IsNullOrWhiteSpace(filterAccountId) || IsNoAplicaCuentaFilter(filterAccountId))
            return true;

        if (paymentDetails == null)
            return false;

        if (!string.IsNullOrWhiteSpace(paymentDetails.AccountId) &&
            string.Equals(paymentDetails.AccountId, filterAccountId, StringComparison.Ordinal))
            return true;

        if (filterAccount == null)
            return false;

        if (PaymentTextMatchesAccountField(paymentDetails.Bank, filterAccount.Label) ||
            PaymentTextMatchesAccountField(paymentDetails.Bank, filterAccount.Code))
            return true;

        if (PaymentTextMatchesAccountField(paymentDetails.PagomovilBank, filterAccount.Label) ||
            PaymentTextMatchesAccountField(paymentDetails.PagomovilBank, filterAccount.Code) ||
            PaymentTextMatchesAccountField(paymentDetails.TransferenciaBank, filterAccount.Label) ||
            PaymentTextMatchesAccountField(paymentDetails.TransferenciaBank, filterAccount.Code))
            return true;

        if (!string.IsNullOrWhiteSpace(filterAccount.Email) &&
            PaymentTextMatchesAccountField(paymentDetails.Email, filterAccount.Email))
            return true;

        return false;
    }

    private static bool PaymentTextMatchesAccountField(string? paymentValue, string? accountField)
    {
        if (string.IsNullOrWhiteSpace(paymentValue) || string.IsNullOrWhiteSpace(accountField))
            return false;
        return string.Equals(
            paymentValue.Trim(),
            accountField.Trim(),
            StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsForeignCurrencyForReport(string? monedaOriginal)
    {
        var m = (monedaOriginal ?? string.Empty).Trim().ToUpperInvariant();
        return m is "USD" or "EUR";
    }

    private static bool IsEmptyAccountDisplay(string? cuenta)
    {
        var c = (cuenta ?? string.Empty).Trim();
        return c.Length == 0 || c == "-";
    }

    private static bool IsNoAplicaAccountLabel(string? cuenta) =>
        string.Equals((cuenta ?? string.Empty).Trim(), "no aplica", StringComparison.OrdinalIgnoreCase);

    /// <summary>Alineado con resolveReportCuentaDisplay en payments-report.tsx.</summary>
    private static string ResolveReportCuentaDisplay(string monedaOriginal, string cuentaRaw)
    {
        if (IsForeignCurrencyForReport(monedaOriginal) &&
            (IsEmptyAccountDisplay(cuentaRaw) || IsNoAplicaAccountLabel(cuentaRaw)))
        {
            return NoAplicaCuentaDisplay;
        }

        return string.IsNullOrWhiteSpace(cuentaRaw) ? "-" : cuentaRaw;
    }

    /// <summary>
    /// Misma regla que el detalle del pedido (frontend): si hay partialPayments, solo esos; si no, mixedPayments.
    /// Evita duplicar filas cuando ambas listas contienen los mismos abonos.
    /// </summary>
    private static (List<PartialPayment> Payments, string PaymentType) GetActivePaymentsForReport(Order order)
    {
        if (order.PartialPayments != null && order.PartialPayments.Count > 0)
            return (order.PartialPayments, "partial");
        if (order.MixedPayments != null && order.MixedPayments.Count > 0)
            return (order.MixedPayments, "mixed");
        return (new List<PartialPayment>(), string.Empty);
    }

    /// <summary>Abono sintético Cashea por financiación: no debe aparecer en reporte de conciliación.</summary>
    private static bool IsCasheaFinancingStubForReport(PartialPayment payment) =>
        payment.PaymentDetails?.CasheaFinancedPortion == true ||
        string.Equals(payment.Method, CasheaFinancedMethodLabel, StringComparison.Ordinal);

    private static bool IsBolivaresCurrency(string? monedaOriginal) =>
        string.Equals(monedaOriginal?.Trim(), "Bs", StringComparison.OrdinalIgnoreCase);

    private static bool ShouldOmitBsEquivalent(string paymentMethod, string? monedaOriginal)
    {
        if (IsBolivaresCurrency(monedaOriginal))
            return false;
        return ForeignCurrencyOnlyPaymentMethods.Contains(paymentMethod ?? string.Empty);
    }

    /// <summary>Monto en Bs para el reporte, o null si no aplica conversión (divisas en métodos solo extranjeros).</summary>
    private static decimal? ComputeReportMontoBs(
        string paymentMethod,
        decimal montoOriginal,
        string monedaOriginal,
        decimal? exchangeRate)
    {
        if (IsBolivaresCurrency(monedaOriginal))
            return montoOriginal;
        if (ShouldOmitBsEquivalent(paymentMethod, monedaOriginal))
            return null;
        return montoOriginal * (exchangeRate ?? 1);
    }

    private async Task<PaymentReportRow> CreatePaymentReportRowAsync(
        Order order,
        PartialPayment payment,
        DateTime paymentDate,
        string paymentType,
        int paymentIndex)
    {
        var referencia = GetPaymentReference(payment.PaymentDetails, payment.Method);
        var cuentaRaw = await GetAccountDisplayAsync(payment.PaymentDetails);

        // Usar originalAmount y originalCurrency si están disponibles
        // Si no hay originalAmount, intentar usar CashReceived y CashCurrency para efectivo
        // Si no hay ninguno, usar Amount (que siempre está en Bs) como último recurso
        var montoOriginal = payment.PaymentDetails?.OriginalAmount ??
                           payment.PaymentDetails?.CashReceived ??
                           payment.Amount;
        var monedaOriginal = payment.PaymentDetails?.OriginalCurrency ??
                            payment.PaymentDetails?.CashCurrency ??
                            "Bs";

        var montoBs = ComputeReportMontoBs(
            payment.Method,
            montoOriginal,
            monedaOriginal,
            payment.PaymentDetails?.ExchangeRate);

        return new PaymentReportRow
        {
            Fecha = PaymentCalendarDate.ToReportString(paymentDate),
            Pedido = order.OrderNumber,
            Cliente = order.ClientName,
            MetodoPago = payment.Method,
            MontoOriginal = montoOriginal,
            MonedaOriginal = monedaOriginal,
            MontoBs = montoBs,
            MontoUsd = GetMontoUsdForBsPayment(order, monedaOriginal, montoBs),
            Cuenta = ResolveReportCuentaDisplay(monedaOriginal, cuentaRaw),
            Referencia = referencia,
            OrderId = order.Id,
            PaymentType = paymentType,
            PaymentIndex = paymentIndex,
            IsConciliated = payment.PaymentDetails?.IsConciliated ?? false
        };
    }

    /// <summary>Equivalente USD para filas en Bs usando la tasa del pedido (sin fallar si no hay tasa).</summary>
    private decimal? GetMontoUsdForBsPayment(Order order, string monedaOriginal, decimal? montoBs)
    {
        if (!string.Equals(monedaOriginal?.Trim(), "Bs", StringComparison.OrdinalIgnoreCase))
            return null;
        if (!montoBs.HasValue)
            return null;

        try
        {
            var rate = GetUsdExchangeRate(order);
            if (rate <= 0)
                return null;
            return Math.Round(montoBs.Value / rate, 2, MidpointRounding.AwayFromZero);
        }
        catch
        {
            return null;
        }
    }

    private string GetPaymentReference(PaymentDetails? paymentDetails, string paymentMethod)
    {
        if (paymentDetails == null) return string.Empty;

        if (string.Equals(paymentMethod, "Zelle", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrWhiteSpace(paymentDetails.Envia))
                return paymentDetails.Envia.Trim();
            if (!string.IsNullOrWhiteSpace(paymentDetails.TransferenciaReference))
                return paymentDetails.TransferenciaReference;
            return string.Empty;
        }

        if (string.Equals(paymentMethod, "Pago Móvil", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(paymentDetails.PagomovilReference))
        {
            return paymentDetails.PagomovilReference;
        }

        if (string.Equals(paymentMethod, "Transferencia", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(paymentDetails.TransferenciaReference))
        {
            return paymentDetails.TransferenciaReference;
        }

        return string.Empty;
    }

    private async Task<string> GetAccountDisplayAsync(PaymentDetails? paymentDetails)
    {
        if (paymentDetails == null) return "-";

        if (!string.IsNullOrWhiteSpace(paymentDetails.Email))
        {
            return paymentDetails.Email;
        }

        if (!string.IsNullOrWhiteSpace(paymentDetails.AccountNumber) &&
            !string.IsNullOrWhiteSpace(paymentDetails.Bank))
        {
            var maskedNumber = MaskAccountNumber(paymentDetails.AccountNumber);
            return $"{maskedNumber} - {paymentDetails.Bank}";
        }

        if (!string.IsNullOrWhiteSpace(paymentDetails.AccountId))
        {
            var acc = await _accountRepository.GetByIdAsync(paymentDetails.AccountId);
            if (acc != null)
            {
                if (string.Equals(acc.AccountType, "Cuentas Digitales", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(acc.Email))
                {
                    return acc.Email;
                }
                if (!string.IsNullOrWhiteSpace(acc.Label)) return acc.Label;
                if (!string.IsNullOrWhiteSpace(acc.Code)) return acc.Code;
            }
        }

        // Tarjeta de débito/crédito y similares: el front solo persiste `bank` (sin accountNumber ni accountId).
        if (!string.IsNullOrWhiteSpace(paymentDetails.Bank))
            return paymentDetails.Bank.Trim();

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
        string? storeId = null)
    {
        try
        {
            _logger.LogInformation("Iniciando generación de reporte de comisiones");

            var reportData = await GetFilteredCommissionsDataAsync(
                startDate,
                endDate,
                vendorId,
                storeId);

            // Convertir de CommissionReportRow (clase interna) a CommissionReportRowDto
            var dtoData = reportData.Select(row => new CommissionReportRowDto
            {
                Fecha = row.Fecha,
                Cliente = row.Cliente,
                Vendedor = row.Vendedor,
                Pedido = row.Pedido,
                Descripcion = row.Descripcion,
                CantidadArticulos = row.CantidadArticulos,
                TipoVenta = row.TipoVenta,
                ComisionFamiliaUsdPorUnidad = row.TasaComisionBase,
                Comision = row.Comision,
                VendedorSecundario = row.VendedorSecundario,
                ComisionSecundaria = row.ComisionSecundaria,
                VendedorPostventa = row.VendedorPostventa,
                ComisionPostventa = row.ComisionPostventa,
                SueldoBase = row.SueldoBase,
                TasaComisionBase = row.TasaComisionBase,
                TasaAplicadaVendedor = row.TasaAplicadaVendedor,
                TasaAplicadaReferido = row.TasaAplicadaReferido,
                TasaAplicadaPostventa = row.TasaAplicadaPostventa,
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
                sl.SetCellValue(1, 3, "Pedido");
                sl.SetCellValue(1, 4, "Vendedor");
                sl.SetCellValue(1, 5, "Descripción");
                sl.SetCellValue(1, 6, "Cant. Artículos");
                sl.SetCellValue(1, 7, "Tipo de venta");
                sl.SetCellValue(1, 8, "Comisión familia USD/u");
                sl.SetCellValue(1, 9, "Comisión Vendedor");
                sl.SetCellValue(1, 10, "Total Comisión + Sueldo");
                sl.SetCellValue(1, 11, "Comisión Post venta");
                sl.SetCellValue(1, 12, "Comisión Referido");

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
                foreach (var item in sortedData)
                {
                    sl.SetCellValue(row, 1, item.Fecha);
                    sl.SetCellValue(row, 2, item.Cliente);
                    sl.SetCellValue(row, 3, item.Pedido);
                    sl.SetCellValue(row, 4, item.Vendedor);
                    sl.SetCellValue(row, 5, item.Descripcion);
                    sl.SetCellValue(row, 6, item.CantidadArticulos);
                    sl.SetCellValue(row, 7, item.TipoVenta);
                    sl.SetCellValue(row, 8, (double)(item.ComisionFamiliaUsdPorUnidad != 0m
                        ? item.ComisionFamiliaUsdPorUnidad
                        : item.TasaComisionBase));
                    sl.SetCellValue(row, 9, (double)item.Comision);
                    sl.SetCellValue(row, 10, (double)item.TotalComisionMasSueldo);
                    sl.SetCellValue(row, 11, item.ComisionPostventa.HasValue ? (double)item.ComisionPostventa.Value : 0);
                    sl.SetCellValue(row, 12, item.ComisionSecundaria.HasValue ? (double)item.ComisionSecundaria.Value : 0);
                    row++;
                }

                // Ajustar ancho de columnas
                sl.SetColumnWidth(1, 20);  // Fecha
                sl.SetColumnWidth(2, 30);  // Cliente
                sl.SetColumnWidth(3, 15);  // Pedido
                sl.SetColumnWidth(4, 30);  // Vendedor
                sl.SetColumnWidth(5, 60);  // Descripción
                sl.SetColumnWidth(6, 15);  // Cant. Artículos
                sl.SetColumnWidth(7, 28);  // Tipo de venta
                sl.SetColumnWidth(8, 16);  // USD/u familia
                sl.SetColumnWidth(9, 18);  // Comisión Vendedor
                sl.SetColumnWidth(10, 22); // Total Comisión + Sueldo
                sl.SetColumnWidth(11, 18); // Post venta
                sl.SetColumnWidth(12, 18); // Referido

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
        string? storeId = null)
    {
        try
        {
            _logger.LogInformation("Obteniendo datos del reporte de comisiones");

            var reportData = await GetFilteredCommissionsDataAsync(
                startDate,
                endDate,
                vendorId,
                storeId);

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
                TipoVenta = row.TipoVenta,
                ComisionFamiliaUsdPorUnidad = row.TasaComisionBase,
                Comision = row.Comision,
                VendedorSecundario = row.VendedorSecundario,
                ComisionSecundaria = row.ComisionSecundaria,
                VendedorPostventa = row.VendedorPostventa,
                ComisionPostventa = row.ComisionPostventa,
                SueldoBase = row.SueldoBase,
                TasaComisionBase = row.TasaComisionBase,
                TasaAplicadaVendedor = row.TasaAplicadaVendedor,
                TasaAplicadaReferido = row.TasaAplicadaReferido,
                TasaAplicadaPostventa = row.TasaAplicadaPostventa,
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
        string? storeId = null)
    {
        var rangeStart = NormalizeCommissionReportStartDate(startDate);
        var rangeEnd = NormalizeCommissionReportEndDate(endDate);

        var orders = await _orderRepository.GetByCreatedAtRangeAsync(rangeStart, rangeEnd);
        var productCommissions = await _productCommissionRepository.GetAllAsync();
        var saleTypeRules = await _saleTypeCommissionRuleRepository.GetAllAsync();
        var users = (await _userRepository.GetAllAsync()).ToList();
        var reportData = new List<CommissionReportRow>();

        foreach (var order in orders)
        {
            if (OrderDocumentTypes.IsReservationType(order.Type)
                || OrderDocumentTypes.IsReservationOrderNumber(order.OrderNumber))
                continue;

            var tipoVentaLabel = GetCommissionSaleTypeLabel(order, saleTypeRules);

            foreach (var product in order.Products)
            {
                var lineCtx = ResolveLineCommissionContext(product, order);
                var postventaId = order.PostventaId?.Trim();

                if (!RowMatchesVendorFilter(
                        vendorId,
                        lineCtx.EffectiveVendorId,
                        lineCtx.EffectiveReferrerId,
                        postventaId))
                    continue;

                if (!RowMatchesStoreFilter(
                        storeId,
                        users,
                        lineCtx.EffectiveVendorId,
                        lineCtx.EffectiveReferrerId,
                        postventaId))
                    continue;

                var mainVendor = users.FirstOrDefault(u => u.Id == lineCtx.EffectiveVendorId);
                mainVendor?.NormalizeCommissionExclusivity();
                var exclusivityMode = mainVendor?.CommissionExclusivityMode ?? CommissionExclusivityModes.Shared;
                var isExclusiveVendor = CommissionExclusivityModes.IsExclusive(exclusivityMode);
                var vendorBaseSalary = mainVendor?.BaseSalary ?? 0m;
                var hasReferrer = !string.IsNullOrWhiteSpace(lineCtx.EffectiveReferrerId);
                var isSharedSale = exclusivityMode == CommissionExclusivityModes.Shared
                    || lineCtx.IsSharedSale;

                var (vendorCommission, referrerCommission, postventaCommission, baseRate, appliedVendorRate, appliedReferrerRate, appliedPostventaRate) =
                    CalculateProductCommission(
                        product, order, productCommissions, saleTypeRules, exclusivityMode, isSharedSale, hasReferrer);

                if (vendorCommission == 0m && referrerCommission == 0m && postventaCommission == 0m)
                    continue;

                var isDistributedSale = referrerCommission > 0m || postventaCommission > 0m;

                if (isDistributedSale)
                {
                    var postventaLabel = string.IsNullOrWhiteSpace(order.PostventaName)
                        ? "Post venta"
                        : order.PostventaName.Trim();
                    reportData.Add(new CommissionReportRow
                    {
                        Fecha = order.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                        Cliente = order.ClientName,
                        Vendedor = lineCtx.EffectiveVendorName,
                        Pedido = order.OrderNumber,
                        Descripcion = await FormatProductDescriptionAsync(product),
                        CantidadArticulos = product.Quantity,
                        TipoVenta = tipoVentaLabel,
                        Comision = vendorCommission,
                        VendedorSecundario = lineCtx.EffectiveReferrerName,
                        ComisionSecundaria = referrerCommission,
                        VendedorPostventa = postventaCommission > 0m ? postventaLabel : null,
                        ComisionPostventa = postventaCommission > 0m ? postventaCommission : null,
                        SueldoBase = vendorBaseSalary,
                        TasaComisionBase = baseRate,
                        TasaAplicadaVendedor = appliedVendorRate,
                        TasaAplicadaReferido = appliedReferrerRate,
                        TasaAplicadaPostventa = appliedPostventaRate,
                        EsVentaCompartida = true,
                        EsVendedorExclusivo = isExclusiveVendor
                    });
                }
                else
                {
                    reportData.Add(new CommissionReportRow
                    {
                        Fecha = order.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                        Cliente = order.ClientName,
                        Vendedor = lineCtx.EffectiveVendorName,
                        Pedido = order.OrderNumber,
                        Descripcion = await FormatProductDescriptionAsync(product),
                        CantidadArticulos = product.Quantity,
                        TipoVenta = tipoVentaLabel,
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

    private static DateTime NormalizeCommissionReportStartDate(DateTime startDate) =>
        startDate.Date;

    private static DateTime NormalizeCommissionReportEndDate(DateTime endDate) =>
        endDate.Date.AddDays(1).AddTicks(-1);

    private static bool RowMatchesVendorFilter(
        string? vendorId,
        string effectiveVendorId,
        string? effectiveReferrerId,
        string? postventaId)
    {
        if (string.IsNullOrWhiteSpace(vendorId))
            return true;

        var filter = vendorId.Trim();
        return string.Equals(effectiveVendorId, filter, StringComparison.Ordinal)
            || (!string.IsNullOrWhiteSpace(effectiveReferrerId)
                && string.Equals(effectiveReferrerId.Trim(), filter, StringComparison.Ordinal))
            || (!string.IsNullOrWhiteSpace(postventaId)
                && string.Equals(postventaId, filter, StringComparison.Ordinal));
    }

    private static bool RowMatchesStoreFilter(
        string? storeFilter,
        IReadOnlyList<User> users,
        string effectiveVendorId,
        string? effectiveReferrerId,
        string? postventaId)
    {
        if (string.IsNullOrWhiteSpace(storeFilter))
            return true;

        var participantIds = new[]
            {
                effectiveVendorId,
                effectiveReferrerId?.Trim(),
                postventaId,
            }
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id!)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (participantIds.Count == 0)
            return false;

        if (storeFilter.Equals("unassigned", StringComparison.OrdinalIgnoreCase))
        {
            return participantIds.Any(pid =>
            {
                var user = users.FirstOrDefault(u => u.Id == pid);
                return user != null
                    && string.Equals(user.Role, "Store Seller", StringComparison.Ordinal)
                    && string.IsNullOrWhiteSpace(user.StoreId);
            });
        }

        return participantIds.Any(pid =>
        {
            var user = users.FirstOrDefault(u => u.Id == pid);
            return user != null
                && string.Equals(user.StoreId, storeFilter.Trim(), StringComparison.Ordinal);
        });
    }

    private sealed record LineCommissionContext(
        bool IsSharedSale,
        string EffectiveVendorId,
        string EffectiveVendorName,
        string? EffectiveReferrerId,
        string? EffectiveReferrerName);

    private static LineCommissionContext ResolveLineCommissionContext(OrderProduct product, Order order)
    {
        var source = product.CommissionLineSource;

        if (string.IsNullOrWhiteSpace(source))
        {
            var legacyShared = !string.IsNullOrWhiteSpace(order.ReferrerId);
            return new LineCommissionContext(
                legacyShared,
                order.VendorId,
                order.VendorName,
                order.ReferrerId,
                order.ReferrerName);
        }

        switch (source)
        {
            case CommissionLineSources.ReservationUnchanged:
                return new LineCommissionContext(
                    false,
                    order.SourceReservationVendorId ?? order.VendorId,
                    order.SourceReservationVendorName ?? order.VendorName,
                    null,
                    null);

            case CommissionLineSources.StoreAdded:
                return new LineCommissionContext(
                    false,
                    order.VendorId,
                    order.VendorName,
                    null,
                    null);

            case CommissionLineSources.StoreModified:
            case CommissionLineSources.StoreSubstitution:
                return new LineCommissionContext(
                    true,
                    order.VendorId,
                    order.VendorName,
                    order.ReferrerId ?? order.SourceReservationVendorId,
                    order.ReferrerName ?? order.SourceReservationVendorName);

            default:
                var fallbackShared = !string.IsNullOrWhiteSpace(order.ReferrerId);
                return new LineCommissionContext(
                    fallbackShared,
                    order.VendorId,
                    order.VendorName,
                    order.ReferrerId,
                    order.ReferrerName);
        }
    }

    /// <summary>
    /// Comisión por línea: USD por unidad (commissionValue) × cantidad.
    /// Venta compartida: vendorRate/referrerRate/postventaRate son USD por unidad según regla de tipo de venta + tier.
    /// </summary>
    private (decimal vendorCommission, decimal referrerCommission, decimal postventaCommission, decimal baseRate, decimal appliedVendorRate, decimal appliedReferrerRate, decimal appliedPostventaRate)
        CalculateProductCommission(
            OrderProduct product,
            Order order,
            IEnumerable<ProductCommission> productCommissions,
            IEnumerable<SaleTypeCommissionRule> saleTypeRules,
            string exclusivityMode,
            bool isSharedSale,
            bool hasReferrer)
    {
        // 1. Obtener comisión base de la categoría del producto
        var categoryCommission = productCommissions.FirstOrDefault(c =>
            c.CategoryName.Equals(product.Category, StringComparison.OrdinalIgnoreCase) ||
            c.CategoryId == product.Category);

        var baseCommissionRate = categoryCommission?.CommissionValue ?? 0m;

        if (baseCommissionRate == 0)
        {
            return (0m, 0m, 0m, 0m, 0m, 0m, 0m);
        }

        var qty = Math.Max(product.Quantity, 1);
        var familyCommission = baseCommissionRate * qty;
        var saleType = DetermineSaleType(order);
        var rule = SaleTypeCommissionTierResolver.PickRule(saleTypeRules, saleType, baseCommissionRate, _logger);

        if (isSharedSale && exclusivityMode == CommissionExclusivityModes.Shared && rule == null)
        {
            _logger.LogWarning(
                "No se encontró regla de distribución para el tipo de venta '{SaleType}'. Dividiendo 50/50.",
                saleType);
        }

        var split = CommissionExclusivityCalculator.Calculate(
            exclusivityMode,
            isSharedSale,
            hasReferrer,
            baseCommissionRate,
            qty,
            familyCommission,
            rule);

        return (
            split.VendorCommission,
            split.ReferrerCommission,
            split.PostventaCommission,
            baseCommissionRate,
            split.AppliedVendorRate,
            split.AppliedReferrerRate,
            split.AppliedPostventaRate);
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

    /// <summary>Etiqueta del tipo de venta que determina la regla de distribución (saleType → deliveryType).</summary>
    private string GetCommissionSaleTypeLabel(Order order, IEnumerable<SaleTypeCommissionRule> rules)
    {
        var code = DetermineSaleType(order);
        var rule = rules
            .Where(r => r.SaleType.Equals(code, StringComparison.OrdinalIgnoreCase))
            .OrderBy(r => r.FamilyCommissionUsdPerUnit)
            .FirstOrDefault();
        if (rule != null && !string.IsNullOrWhiteSpace(rule.SaleTypeLabel))
            return rule.SaleTypeLabel.Trim();

        return code switch
        {
            "delivery_express" => "Delivery express",
            "encargo" => "Encargo",
            "encargo_entrega" => "Encargo con entrega",
            "entrega" => "Entrega",
            "retiro_almacen" => "Retiro por almacén",
            "retiro_tienda" => "Retiro por tienda",
            "sistema_apartado" => "Sistema apartado",
            "entrega_programada" => "Entrega programada",
            _ => code
        };
    }

    private class PaymentReportRow
    {
        public string Fecha { get; set; } = string.Empty;
        public string Pedido { get; set; } = string.Empty;
        public string Cliente { get; set; } = string.Empty;
        public string MetodoPago { get; set; } = string.Empty;
        public decimal MontoOriginal { get; set; }
        public string MonedaOriginal { get; set; } = string.Empty;
        public decimal? MontoBs { get; set; }
        public decimal? MontoUsd { get; set; }
        public string Cuenta { get; set; } = string.Empty;
        public string Referencia { get; set; } = string.Empty;
        public string OrderId { get; set; } = string.Empty;
        public string PaymentType { get; set; } = string.Empty;
        public int PaymentIndex { get; set; } = -1;
        public bool IsConciliated { get; set; }
    }

    // ================================================================
    // DISPATCH REPORT METHODS
    // ================================================================

    private static readonly Dictionary<string, string> DeliveryZoneLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["caracas"] = "Caracas",
        ["g_g"] = "G&G",
        ["san_antonio_los_teques"] = "San Antonio-Los Teques",
        ["caucagua_higuerote"] = "Caucagua-Higuerote",
        ["la_guaira"] = "La Guaira",
        ["charallave_cua"] = "Charallave-Cua",
        ["interior_pais"] = "Interior del País",
    };

    private static readonly Dictionary<string, string> DeliveryTypeLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["entrega_programada"] = "Entrega programada",
        ["delivery_express"] = "Delivery Express",
        ["retiro_tienda"] = "Retiro por Tienda",
        ["retiro_almacen"] = "Retiro por almacén",
    };

    private static string FormatDeliveryZoneLabel(string? zone)
    {
        if (string.IsNullOrWhiteSpace(zone)) return "";
        return DeliveryZoneLabels.TryGetValue(zone.Trim(), out var label) ? label : zone.Trim();
    }

    private static string FormatDeliveryTypeLabel(string? deliveryType)
    {
        if (string.IsNullOrWhiteSpace(deliveryType)) return "";
        return DeliveryTypeLabels.TryGetValue(deliveryType.Trim(), out var label) ? label : deliveryType.Trim();
    }

    private static string BuildInformacionDespacho(Order order)
    {
        var parts = new List<string>();
        var zona = FormatDeliveryZoneLabel(order.DeliveryZone);
        if (!string.IsNullOrWhiteSpace(zona))
            parts.Add($"Zona: {zona}");
        var tipo = FormatDeliveryTypeLabel(order.DeliveryType);
        if (!string.IsNullOrWhiteSpace(tipo))
            parts.Add($"Tipo: {tipo}");
        return parts.Count > 0 ? string.Join(" | ", parts) : "";
    }

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

            // Orden ya aplicado en GetFilteredDispatchDataAsync (zona, fecha, nota)

            // Generar Excel con SpreadsheetLight
            var stream = new MemoryStream();

            using (var sl = new SLDocument())
            {
                // Headers en la fila 1 (vista transportistas)
                sl.SetCellValue(1, 1, "Pedido");
                sl.SetCellValue(1, 2, "Cliente");
                sl.SetCellValue(1, 3, "Telefono1");
                sl.SetCellValue(1, 4, "Telefono2");
                sl.SetCellValue(1, 5, "Direccion");
                sl.SetCellValue(1, 6, "Cantidad");
                sl.SetCellValue(1, 7, "Descripcion");
                sl.SetCellValue(1, 8, "Estado de Pago");
                sl.SetCellValue(1, 9, "Importe Total");
                sl.SetCellValue(1, 10, "Saldo Pendiente por Cobrar (USD)");
                sl.SetCellValue(1, 11, "Información de despacho");
                sl.SetCellValue(1, 12, "Observaciones de despacho");
                sl.SetCellValue(1, 13, "Firma");

                // Estilo de headers
                var headerStyle = sl.CreateStyle();
                headerStyle.Font.Bold = true;

                var usdMoneyStyle = sl.CreateStyle();
                usdMoneyStyle.FormatCode = "\"$\"#,##0.00";

                // Aplicar estilo a las celdas de headers
                for (int col = 1; col <= 13; col++)
                {
                    sl.SetCellStyle(1, col, headerStyle);
                }

                // Llenar datos desde la fila 2
                int row = 2;
                foreach (var item in reportData)
                {
                    sl.SetCellValue(row, 1, item.NotaDespacho);
                    sl.SetCellValue(row, 2, item.Cliente);
                    sl.SetCellValue(row, 3, item.Telefono1);
                    sl.SetCellValue(row, 4, item.Telefono2);
                    sl.SetCellValue(row, 5, item.Direccion);
                    sl.SetCellValue(row, 6, item.CantidadTotal);
                    sl.SetCellValue(row, 7, item.Descripcion);
                    sl.SetCellValue(row, 8, item.EstadoPago);
                    sl.SetCellValue(row, 9, item.ImporteTotal);
                    sl.SetCellValue(row, 10, item.SaldoPendiente);
                    sl.SetCellStyle(row, 9, usdMoneyStyle);
                    sl.SetCellStyle(row, 10, usdMoneyStyle);
                    sl.SetCellValue(row, 11, item.InformacionDespacho);
                    sl.SetCellValue(row, 12, item.DispatchObservations);
                    sl.SetCellValue(row, 13, " ");
                    row++;
                }

                // Ajustar ancho de columnas
                sl.SetColumnWidth(1, 16);  // Pedido
                sl.SetColumnWidth(2, 25);  // Cliente
                sl.SetColumnWidth(3, 15);  // Telefono1
                sl.SetColumnWidth(4, 15);  // Telefono2
                sl.SetColumnWidth(5, 40);  // Direccion
                sl.SetColumnWidth(6, 10);  // Cantidad
                sl.SetColumnWidth(7, 60);  // Descripcion
                sl.SetColumnWidth(8, 22);  // Estado de Pago
                sl.SetColumnWidth(9, 15);  // Importe Total
                sl.SetColumnWidth(10, 28); // Saldo Pendiente
                sl.SetColumnWidth(11, 32); // Información de despacho (zona/tipo)
                sl.SetColumnWidth(12, 42); // Observaciones de despacho
                sl.SetColumnWidth(13, 22); // Firma (espacio para firmar)

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

            return reportData.Select(row => new DispatchReportRowDto
            {
                NotaDespacho = row.NotaDespacho,
                Cliente = row.Cliente,
                Telefono1 = row.Telefono1,
                Telefono2 = row.Telefono2,
                CantidadTotal = row.CantidadTotal,
                Descripcion = row.Descripcion,
                Direccion = row.Direccion,
                EstadoPago = row.EstadoPago,
                ImporteTotal = row.ImporteTotal,
                SaldoPendiente = row.SaldoPendiente,
                DispatchObservations = row.DispatchObservations,
                InformacionDespacho = row.InformacionDespacho
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

        var matchingOrders = orders
            .Where(order =>
            {
                if (!DispatchReportFilters.IsOrderEligibleForDispatchReport(order))
                    return false;
                if (!string.IsNullOrWhiteSpace(deliveryZone) &&
                    order.DeliveryZone != deliveryZone)
                    return false;
                if (startDate.HasValue && order.CreatedAt < startDate.Value)
                    return false;
                if (endDate.HasValue && order.CreatedAt > endDate.Value.AddDays(1).AddSeconds(-1))
                    return false;
                return true;
            })
            .OrderBy(o => string.IsNullOrWhiteSpace(o.DeliveryZone) ? "ZZZ" : o.DeliveryZone)
            .ThenBy(o => o.CreatedAt)
            .ThenBy(o => o.OrderNumber)
            .ToList();

        var reportData = new List<DispatchReportRow>();

        foreach (var order in matchingOrders)
        {
            var enRutaProducts = DispatchReportFilters.GetProductsEnRuta(order);
            if (enRutaProducts.Count == 0)
                continue;

            var client = clients.FirstOrDefault(c => c.Id == order.ClientId);

            var productDescriptions = new List<string>();
            foreach (var product in enRutaProducts)
            {
                try
                {
                    var productDesc = await FormatProductDescriptionAsync(product);
                    productDescriptions.Add(productDesc);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error al formatear descripción del producto {ProductName} en pedido {OrderNumber}",
                        product?.Name ?? "desconocido", order.OrderNumber);
                    productDescriptions.Add(product?.Name ?? "Producto desconocido");
                }
            }

            var descripcionCompleta = productDescriptions.Count > 0
                ? string.Join(" | ", productDescriptions)
                : "Sin productos";

            var cantidadTotal = enRutaProducts.Sum(p => p.Quantity);

            decimal usdRate;
            decimal importeTotalUsd;
            string estadoPago;
            decimal saldoPendiente;

            try
            {
                usdRate = GetUsdExchangeRate(order);
                importeTotalUsd = OrderCommercialCurrency.GetOrderTotalUsd(order, usdRate);
                var totalPagadoUsd = OrderCommercialCurrency.SumPaymentsToUsd(order);
                saldoPendiente = OrderCommercialCurrency.GetOrderPendingUsd(order, usdRate);
                importeTotalUsd = decimal.Round(importeTotalUsd, 2, MidpointRounding.AwayFromZero);
                totalPagadoUsd = decimal.Round(totalPagadoUsd, 2, MidpointRounding.AwayFromZero);
                saldoPendiente = decimal.Round(saldoPendiente, 2, MidpointRounding.AwayFromZero);
                estadoPago = OrderCommercialCurrency.DeterminePaymentStatusInUsd(
                    importeTotalUsd,
                    importeTotalUsd - saldoPendiente);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning("Omitiendo pedido {OrderNumber} del reporte de despacho: {Error}",
                    order.OrderNumber, ex.Message);
                continue;
            }

            var direccionEntrega = (order.DeliveryAddress ?? string.Empty).Trim();
            var direccionReporte = !string.IsNullOrWhiteSpace(direccionEntrega)
                ? direccionEntrega
                : (client?.Direccion ?? string.Empty).Trim();

            reportData.Add(new DispatchReportRow
            {
                NotaDespacho = order.OrderNumber,
                Cliente = order.ClientName,
                Telefono1 = client?.Telefono ?? "",
                Telefono2 = client?.Telefono2 ?? "",
                CantidadTotal = cantidadTotal,
                Descripcion = descripcionCompleta,
                Direccion = direccionReporte,
                EstadoPago = estadoPago,
                ImporteTotal = importeTotalUsd,
                SaldoPendiente = saldoPendiente,
                DispatchObservations = order.DispatchObservations ?? "",
                InformacionDespacho = BuildInformacionDespacho(order)
            });
        }

        return reportData;
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

        // PRIORIDAD 3: Buscar en abonos (lista activa: partial si existe, si no mixed)
        var (activeForRate, _) = GetActivePaymentsForReport(order);
        if (activeForRate.Count > 0)
        {
            var rate = activeForRate
                .FirstOrDefault(p => p.PaymentDetails?.ExchangeRate.HasValue == true &&
                                    p.PaymentDetails.ExchangeRate > 0)
                ?.PaymentDetails?.ExchangeRate;
            if (rate.HasValue)
            {
                _logger.LogInformation("Usando tasa USD de un abono del pedido {OrderNumber}: {Rate}",
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

        var (activePayments, _) = GetActivePaymentsForReport(order);
        if (activePayments.Count > 0)
        {
            foreach (var payment in activePayments)
            {
                var monto = payment.PaymentDetails?.OriginalAmount ??
                           payment.PaymentDetails?.CashReceived ??
                           payment.Amount;
                var moneda = payment.PaymentDetails?.OriginalCurrency ??
                            payment.PaymentDetails?.CashCurrency ??
                            "Bs";

                if (moneda != "Bs")
                {
                    monto = monto * (payment.PaymentDetails?.ExchangeRate ?? 1);
                }

                totalPagado += monto;
            }

            return totalPagado;
        }

        if (!string.IsNullOrWhiteSpace(order.PaymentMethod))
        {
            var monto = order.PaymentDetails?.OriginalAmount ??
                       order.PaymentDetails?.CashReceived ??
                       order.Total;
            var moneda = order.PaymentDetails?.OriginalCurrency ??
                        order.PaymentDetails?.CashCurrency ??
                        "Bs";

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
        public string TipoVenta { get; set; } = string.Empty;
        public decimal Comision { get; set; }
        public string? VendedorSecundario { get; set; }
        public decimal? ComisionSecundaria { get; set; }
        public string? VendedorPostventa { get; set; }
        public decimal? ComisionPostventa { get; set; }
        public decimal SueldoBase { get; set; }
        public decimal TasaComisionBase { get; set; }
        public decimal TasaAplicadaVendedor { get; set; }
        public decimal? TasaAplicadaReferido { get; set; }
        public decimal? TasaAplicadaPostventa { get; set; }
        public bool EsVentaCompartida { get; set; }
        public bool EsVendedorExclusivo { get; set; }
    }

    private class DispatchReportRow
    {
        public string NotaDespacho { get; set; } = string.Empty;
        public string Cliente { get; set; } = string.Empty;
        public string Telefono1 { get; set; } = string.Empty;
        public string Telefono2 { get; set; } = string.Empty;
        public int CantidadTotal { get; set; }
        public string Descripcion { get; set; } = string.Empty;
        public string Direccion { get; set; } = string.Empty;
        public string EstadoPago { get; set; } = string.Empty;
        public decimal ImporteTotal { get; set; }
        public decimal SaldoPendiente { get; set; }
        public string DispatchObservations { get; set; } = string.Empty;
        public string InformacionDespacho { get; set; } = string.Empty;
    }
}



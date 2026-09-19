using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Ordina.Application.Common;
using Ordina.Domain.Catalog;
using Ordina.Domain.Orders;

namespace Ordina.Application.Reports;

public interface IReportService
{
    Task<DashboardMetricsDto> GetDashboardMetricsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CommissionReportRowDto>> GetCommissionReportAsync(DateTime? from = null, DateTime? to = null, string? vendorId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentsDetailedReportRowDto>> GetPaymentsDetailedReportAsync(DateTime? from = null, DateTime? to = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateCommissionsReportExcelAsync(DateTime? from = null, DateTime? to = null, string? vendorId = null, CancellationToken cancellationToken = default);
    Task<byte[]> GeneratePaymentsReportExcelAsync(DateTime? from = null, DateTime? to = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateDispatchReportExcelAsync(DateTime? from = null, DateTime? to = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateManufacturingReportExcelAsync(DateTime? from = null, DateTime? to = null, string? status = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateExpiredLayawaysReportExcelAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ManufacturingReportPreviewDto>> GetManufacturingPreviewAsync(DateTime? from = null, DateTime? to = null, string? status = null, string? manufacturerId = null, string? orderNumber = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DispatchReportPreviewDto>> GetDispatchPreviewAsync(DateTime? from = null, DateTime? to = null, string? deliveryZone = null, string? location = null, CancellationToken cancellationToken = default);
}

public class ReportService : IReportService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IClientRepository _clientRepository;
    private readonly IProductRepository _productRepository;

    public ReportService(
        IOrderRepository orderRepository,
        IClientRepository clientRepository,
        IProductRepository productRepository)
    {
        _orderRepository = orderRepository;
        _clientRepository = clientRepository;
        _productRepository = productRepository;
    }

    public async Task<DashboardMetricsDto> GetDashboardMetricsAsync(CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(o => o.TypeString == "Order", cancellationToken);
        var clients = await _clientRepository.GetAllAsync(cancellationToken);
        var products = await _productRepository.GetAllAsync(cancellationToken);

        var totalOrders = orders.Count;
        var pendingOrders = orders.Count(o => o.StatusString == "Pendiente");
        var completedOrders = orders.Count(o => o.StatusString == "Completado");
        var totalSales = orders.Where(o => o.StatusString != "Cancelado").Sum(o => o.Total);
        var totalStock = products.Sum(p => p.Stock);

        int mfgPending = 0;
        int dispatchPending = 0;

        foreach (var o in orders.Where(o => o.StatusString != "Cancelado"))
        {
            foreach (var p in o.Products)
            {
                if (p.ManufacturingStatusString is "debe_fabricar" or "por_fabricar" or "fabricando")
                    mfgPending++;
                if (p.LocationStatusString is "EN TIENDA" or "ALMACEN" && p.LogisticStatusString != "Completado")
                    dispatchPending++;
            }
        }

        return new DashboardMetricsDto(
            totalOrders,
            pendingOrders,
            completedOrders,
            totalSales,
            clients.Count,
            totalStock,
            mfgPending,
            dispatchPending);
    }

    public async Task<IReadOnlyList<CommissionReportRowDto>> GetCommissionReportAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? vendorId = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();
        if (!string.IsNullOrWhiteSpace(vendorId)) orders = orders.Where(o => o.VendorId == vendorId).ToList();

        var rows = new List<CommissionReportRowDto>();
        foreach (var order in orders)
        {
            rows.Add(new CommissionReportRowDto(
                order.OrderNumber,
                order.CreatedAt,
                order.VendorName,
                order.ClientName,
                order.Total,
                Math.Round(order.Total * 0.03m, 2),
                "Standard"));
        }

        return rows;
    }

    public async Task<IReadOnlyList<PaymentsDetailedReportRowDto>> GetPaymentsDetailedReportAsync(
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();

        var rows = new List<PaymentsDetailedReportRowDto>();

        foreach (var order in orders)
        {
            if (order.PartialPayments != null)
            {
                foreach (var p in order.PartialPayments)
                {
                    rows.Add(new PaymentsDetailedReportRowDto(
                        order.OrderNumber,
                        p.Date,
                        order.ClientName,
                        p.Amount,
                        p.Method,
                        p.PaymentDetails?.Bank,
                        p.PaymentDetails?.TransferenciaReference ?? p.PaymentDetails?.PagomovilReference,
                        p.PaymentDetails?.IsConciliated ?? false));
                }
            }
        }

        return rows;
    }

    public async Task<byte[]> GenerateCommissionsReportExcelAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? vendorId = null,
        CancellationToken cancellationToken = default)
    {
        var data = await GetCommissionReportAsync(from, to, vendorId, cancellationToken);
        var columns = new (string Header, Func<CommissionReportRowDto, object?> Selector)[]
        {
            ("Pedido", r => r.OrderNumber),
            ("Fecha", r => r.Date),
            ("Vendedor", r => r.SellerName),
            ("Cliente", r => r.ClientName),
            ("Total Venta ($)", r => r.OrderTotal),
            ("Comisión ($)", r => r.CommissionAmount),
            ("Tipo Comisión", r => r.CommissionMode)
        };

        return ExcelReportBuilder.CreateTable("Comisiones", data, columns);
    }

    public async Task<byte[]> GeneratePaymentsReportExcelAsync(
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var data = await GetPaymentsDetailedReportAsync(from, to, cancellationToken);
        var columns = new (string Header, Func<PaymentsDetailedReportRowDto, object?> Selector)[]
        {
            ("Pedido", r => r.OrderNumber),
            ("Fecha", r => r.Date),
            ("Cliente", r => r.ClientName),
            ("Monto", r => r.Amount),
            ("Método de Pago", r => r.Method),
            ("Banco", r => r.Bank),
            ("Referencia", r => r.Reference),
            ("Conciliado", r => r.IsConciliated)
        };

        return ExcelReportBuilder.CreateTable("Pagos", data, columns);
    }

    public async Task<byte[]> GenerateDispatchReportExcelAsync(
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();

        var columns = new (string Header, Func<Order, object?> Selector)[]
        {
            ("Pedido", o => o.OrderNumber),
            ("Fecha Creación", o => o.CreatedAt),
            ("Cliente", o => o.ClientName),
            ("Dirección Despacho", o => o.DeliveryAddress),
            ("Tiene Despacho", o => o.HasDelivery),
            ("Total ($)", o => o.Total),
            ("Estado Pedido", o => o.StatusString)
        };

        return ExcelReportBuilder.CreateTable("Despachos", orders, columns);
    }

    public async Task<byte[]> GenerateManufacturingReportExcelAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();

        var rows = new List<ManufacturingReportExportRow>();
        foreach (var order in orders)
        {
            foreach (var p in order.Products)
            {
                if (!string.IsNullOrWhiteSpace(status) && status != "all" && p.ManufacturingStatusString != status)
                    continue;

                rows.Add(new ManufacturingReportExportRow(
                    order.OrderNumber,
                    order.CreatedAt,
                    order.ClientName,
                    p.Name,
                    p.Quantity,
                    p.ManufacturingStatusString,
                    p.ManufacturingProviderName,
                    p.Observations));
            }
        }

        var columns = new (string Header, Func<ManufacturingReportExportRow, object?> Selector)[]
        {
            ("Pedido", r => r.OrderNumber),
            ("Fecha", r => r.CreatedAt),
            ("Cliente", r => r.ClientName),
            ("Producto", r => r.ProductName),
            ("Cantidad", r => r.Quantity),
            ("Estado Fabricación", r => r.ManufacturingStatus),
            ("Proveedor", r => r.ProviderName),
            ("Observaciones", r => r.Observations)
        };

        return ExcelReportBuilder.CreateTable("Fabricación", rows, columns);
    }

    public async Task<byte[]> GenerateExpiredLayawaysReportExcelAsync(CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.SaleTypeString == "sistema_apartado" && o.StatusString != "Cancelado",
            cancellationToken);

        var now = DateTime.UtcNow;
        var expiredList = new List<ExpiredLayawayExportRow>();

        foreach (var o in orders)
        {
            var diffDays = (int)(now - o.CreatedAt).TotalDays;
            if (diffDays > 90)
            {
                var paid = o.PartialPayments?.Sum(p => p.Amount) ?? 0m;
                var pending = Math.Max(0m, o.Total - paid);
                if (pending > 0.01m)
                {
                    expiredList.Add(new ExpiredLayawayExportRow(
                        o.OrderNumber,
                        o.CreatedAt,
                        o.ClientName,
                        o.Total,
                        paid,
                        pending,
                        diffDays - 90));
                }
            }
        }

        var columns = new (string Header, Func<ExpiredLayawayExportRow, object?> Selector)[]
        {
            ("Pedido", r => r.OrderNumber),
            ("Fecha", r => r.CreatedAt),
            ("Cliente", r => r.ClientName),
            ("Total ($)", r => r.Total),
            ("Monto Pagado ($)", r => r.PaidAmount),
            ("Monto Pendiente ($)", r => r.PendingAmount),
            ("Días Vencido", r => r.DaysExpired)
        };

        return ExcelReportBuilder.CreateTable("SA Vencidos", expiredList, columns);
    }

    public async Task<IReadOnlyList<ManufacturingReportPreviewDto>> GetManufacturingPreviewAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? status = null,
        string? manufacturerId = null,
        string? orderNumber = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();
        if (!string.IsNullOrWhiteSpace(orderNumber)) orders = orders.Where(o => o.OrderNumber.Contains(orderNumber, StringComparison.OrdinalIgnoreCase)).ToList();

        var rows = new List<ManufacturingReportPreviewDto>();
        foreach (var order in orders)
        {
            foreach (var p in order.Products)
            {
                if (!string.IsNullOrWhiteSpace(status) && status != "all" && p.ManufacturingStatusString != status)
                    continue;

                if (!string.IsNullOrWhiteSpace(manufacturerId) && manufacturerId != "all" && p.ManufacturingProviderId != manufacturerId)
                    continue;

                rows.Add(new ManufacturingReportPreviewDto(
                    order.OrderNumber,
                    order.CreatedAt,
                    order.ClientName,
                    p.ManufacturingProviderName ?? "",
                    p.Name,
                    p.Quantity,
                    p.ManufacturingStatusString ?? "Por Fabricar",
                    order.Observations ?? "",
                    p.ManufacturingNotes ?? "",
                    p.RefabricationReason ?? ""));
            }
        }

        return rows;
    }

    public async Task<IReadOnlyList<DispatchReportPreviewDto>> GetDispatchPreviewAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? deliveryZone = null,
        string? location = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();
        if (!string.IsNullOrWhiteSpace(deliveryZone) && deliveryZone != "all")
            orders = orders.Where(o => o.DeliveryZone != null && o.DeliveryZone.Contains(deliveryZone, StringComparison.OrdinalIgnoreCase)).ToList();

        var clients = await _clientRepository.GetAllAsync(cancellationToken);
        var clientMap = clients.ToDictionary(c => c.Id, c => c);

        var rows = new List<DispatchReportPreviewDto>();
        foreach (var order in orders)
        {
            clientMap.TryGetValue(order.ClientId, out var client);
            var phone1 = client?.Telefono ?? "";
            var phone2 = client?.Telefono2 ?? "";
            var paid = order.PartialPayments?.Sum(p => p.Amount) ?? 0m;
            var saldoPendiente = Math.Max(0m, order.Total - paid);
            var desc = string.Join(", ", order.Products?.Select(p => $"{p.Quantity}x {p.Name}") ?? Array.Empty<string>());
            var ubicacion = order.Products?.FirstOrDefault()?.LocationStatusString ?? "EN TIENDA";

            if (!string.IsNullOrWhiteSpace(location) && location != "all")
            {
                if (!ubicacion.Contains(location, StringComparison.OrdinalIgnoreCase))
                    continue;
            }

            rows.Add(new DispatchReportPreviewDto(
                order.OrderNumber,
                order.ClientName,
                phone1,
                phone2,
                order.Products?.Sum(p => p.Quantity) ?? 0,
                desc,
                order.DeliveryAddress ?? "",
                order.PaymentTypeString,
                order.Total,
                saldoPendiente,
                order.Observations ?? "",
                order.DispatchObservations ?? "",
                ubicacion));
        }

        return rows;
    }
}

public record ManufacturingReportExportRow(
    string OrderNumber,
    DateTime CreatedAt,
    string ClientName,
    string ProductName,
    int Quantity,
    string ManufacturingStatus,
    string? ProviderName,
    string? Observations);

public record ExpiredLayawayExportRow(
    string OrderNumber,
    DateTime CreatedAt,
    string ClientName,
    decimal Total,
    decimal PaidAmount,
    decimal PendingAmount,
    int DaysExpired);

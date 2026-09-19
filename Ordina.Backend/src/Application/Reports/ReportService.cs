using Ordina.Application.Common;
using Ordina.Domain.Catalog;
using Ordina.Domain.Orders;

namespace Ordina.Application.Reports;

public interface IReportService
{
    Task<DashboardMetricsDto> GetDashboardMetricsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CommissionReportRowDto>> GetCommissionReportAsync(DateTime? from = null, DateTime? to = null, string? vendorId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentsDetailedReportRowDto>> GetPaymentsDetailedReportAsync(DateTime? from = null, DateTime? to = null, CancellationToken cancellationToken = default);
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
                Math.Round(order.Total * 0.03m, 2), // Ponytail base commission
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
}

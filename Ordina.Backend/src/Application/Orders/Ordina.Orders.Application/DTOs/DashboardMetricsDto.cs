namespace Ordina.Orders.Application.DTOs;

public class MetricChangeDto
{
    public decimal Current { get; set; }
    public decimal Previous { get; set; }
    public decimal Value { get; set; }
    public bool HasBase { get; set; }
    public string Direction { get; set; } = "higher_is_better";
}

public class DashboardMetricsDto
{
    public int CompletedOrders { get; set; }
    public MetricChangeDto? CompletedOrdersChange { get; set; }

    public int TotalSalesCount { get; set; }

    public decimal TotalInvoiced { get; set; }
    public MetricChangeDto? TotalInvoicedChange { get; set; }

    public decimal TotalCollected { get; set; }
    public MetricChangeDto? TotalCollectedChange { get; set; }

    public decimal AverageOrderValue { get; set; }
    public MetricChangeDto? AverageOrderValueChange { get; set; }

    public decimal PendingPayments { get; set; }
    public MetricChangeDto? PendingPaymentsChange { get; set; }

    public int ExpiredLayawaysCount { get; set; }
    public decimal ExpiredLayawaysAmount { get; set; }

    public int ProductsToManufacture { get; set; }
    public MetricChangeDto? ProductsToManufactureChange { get; set; }
}

namespace Ordina.Database.Repositories;

public class DashboardMetricsRawData
{
    public int CurrentOrdersCount { get; set; }
    public decimal CurrentInvoicedUsd { get; set; }
    public decimal CurrentCollectedUsd { get; set; }

    public int PreviousOrdersCount { get; set; }
    public decimal PreviousInvoicedUsd { get; set; }
    public decimal PreviousCollectedUsd { get; set; }

    public decimal PendingPaymentsUsd { get; set; }
    public int ExpiredLayawaysCount { get; set; }
    public decimal ExpiredLayawaysAmountUsd { get; set; }

    public int ProductsToManufactureCount { get; set; }
}

using Ordina.Database.Entities.Order;

namespace Ordina.Orders.Application;

/// <summary>
/// Moneda comercial del pedido y conversión a USD para reportes (espejo de order-line-pricing / order-payments en el front).
/// </summary>
public static class OrderCommercialCurrency
{
    private const string CasheaFinancedMethodLabel = "Cashea (financiación)";
    private const decimal LegacyUsdTotalThreshold = 100_000m;

    public static bool IsUsdBaseOrder(Order order)
    {
        if (order == null) return false;

        if (string.Equals(order.BaseCurrency?.Trim(), "USD", StringComparison.OrdinalIgnoreCase))
            return true;

        if (!string.IsNullOrWhiteSpace(order.BaseCurrency))
            return false;

        var lines = order.Products ?? new List<OrderProduct>();
        if (lines.Count > 0)
        {
            var currencies = lines
                .Select(l => (l.PriceCurrency ?? "Bs").Trim())
                .ToList();
            if (currencies.All(c => string.Equals(c, "USD", StringComparison.OrdinalIgnoreCase)))
                return true;
            if (currencies.Any(c => string.Equals(c, "USD", StringComparison.OrdinalIgnoreCase))
                && !currencies.Any(c => string.Equals(c, "Bs", StringComparison.OrdinalIgnoreCase)))
                return true;
        }

        if (order.ExchangeRatesAtCreation?.Usd?.Rate > 0
            && order.Total > 0
            && order.Total <= LegacyUsdTotalThreshold)
        {
            return true;
        }

        return false;
    }

    public static decimal GetOrderTotalUsd(Order order, decimal usdRate)
    {
        if (usdRate <= 0)
            throw new ArgumentOutOfRangeException(nameof(usdRate), "La tasa USD debe ser mayor que cero.");

        if (IsUsdBaseOrder(order))
            return order.Total;

        return order.Total / usdRate;
    }

    public static decimal SumPaymentsToUsd(Order order)
    {
        var (activePayments, _) = GetActivePaymentsForReport(order);
        if (activePayments.Count > 0)
        {
            return activePayments
                .Where(p => !IsCasheaFinancingStub(p))
                .Sum(p => PaymentToUsd(p, order));
        }

        if (string.IsNullOrWhiteSpace(order.PaymentMethod))
            return 0m;

        return PaymentToUsdFromDetails(
            order.PaymentDetails,
            order.PaymentDetails?.OriginalAmount
                ?? order.PaymentDetails?.CashReceived
                ?? order.Total,
            order);
    }

    private static decimal PaymentToUsd(PartialPayment payment, Order order)
    {
        var det = payment.PaymentDetails;
        var originalCurrency = (det?.OriginalCurrency ?? det?.CashCurrency ?? "Bs").Trim();
        var originalAmount = det?.OriginalAmount
            ?? det?.CashReceived
            ?? payment.Amount;

        return PaymentToUsdFromDetails(det, originalAmount, order, originalCurrency);
    }

    private static decimal PaymentToUsdFromDetails(
        PaymentDetails? det,
        decimal? originalAmount,
        Order order,
        string? originalCurrencyOverride = null)
    {
        var currency = (originalCurrencyOverride ?? det?.OriginalCurrency ?? det?.CashCurrency ?? "Bs").Trim();

        if (string.Equals(currency, "USD", StringComparison.OrdinalIgnoreCase))
            return originalAmount ?? 0m;

        if (string.Equals(currency, "Bs", StringComparison.OrdinalIgnoreCase))
        {
            var amountBs = originalAmount ?? 0m;
            var rate = ResolveBsToUsdRate(det, order);
            if (rate > 0)
                return amountBs / rate;
            return 0m;
        }

        if (string.Equals(currency, "EUR", StringComparison.OrdinalIgnoreCase))
        {
            var eurRate = order.ExchangeRatesAtCreation?.Eur?.Rate;
            var usdRate = order.ExchangeRatesAtCreation?.Usd?.Rate;
            var amount = originalAmount ?? 0m;
            if (eurRate is > 0 && usdRate is > 0)
                return amount * eurRate.Value / usdRate.Value;
            return 0m;
        }

        return 0m;
    }

    private static decimal ResolveBsToUsdRate(PaymentDetails? det, Order order)
    {
        if (det?.ExchangeRate is > 0)
            return det.ExchangeRate.Value;
        if (order.ExchangeRatesAtCreation?.Usd?.Rate is > 0)
            return order.ExchangeRatesAtCreation.Usd.Rate;
        if (order.PaymentDetails?.ExchangeRate is > 0)
            return order.PaymentDetails.ExchangeRate.Value;
        return 0m;
    }

    private static (List<PartialPayment> Payments, string PaymentType) GetActivePaymentsForReport(Order order)
    {
        if (order.PartialPayments != null && order.PartialPayments.Count > 0)
            return (order.PartialPayments, "partial");
        if (order.MixedPayments != null && order.MixedPayments.Count > 0)
            return (order.MixedPayments, "mixed");
        return (new List<PartialPayment>(), string.Empty);
    }

    private static bool IsCasheaFinancingStub(PartialPayment payment) =>
        payment.PaymentDetails?.CasheaFinancedPortion == true
        || string.Equals(payment.Method, CasheaFinancedMethodLabel, StringComparison.Ordinal);

    public static string DeterminePaymentStatusInUsd(decimal totalUsd, decimal paidUsd)
    {
        if (totalUsd <= 0)
            return "Pendiente";

        if (paidUsd >= totalUsd)
            return "Pagado";

        if (paidUsd > 0)
            return $"Parcial (${paidUsd:F2})";

        return "Pendiente";
    }
}

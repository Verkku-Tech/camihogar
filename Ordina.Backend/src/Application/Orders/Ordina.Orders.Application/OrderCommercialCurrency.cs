using Ordina.Database.Entities.Order;
using Ordina.Orders.Application.Helpers;

namespace Ordina.Orders.Application;

/// <summary>
/// Moneda comercial del pedido y conversión a USD para reportes (espejo de order-line-pricing / order-payments en el front).
/// </summary>
public static class OrderCommercialCurrency
{
    private const string CasheaFinancedMethodLabel = "Cashea (financiación)";
    private const decimal LegacyUsdTotalThreshold = 100_000m;
    private const decimal PaymentBalanceEpsilonUsd = 0.01m;
    private const decimal PaymentBalanceEpsilonBs = 0.1m;
    /// <summary>Redondeo Bs↔USD al cerrar Cashea comercialmente (p. ej. reserva convertida).</summary>
    private const decimal CasheaCommercialSettlementEpsilonUsd = 0.5m;

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

    public static bool IsCasheaFinancingStub(PartialPayment payment) =>
        payment.PaymentDetails?.CasheaFinancedPortion == true
        || string.Equals(payment.Method, CasheaFinancedMethodLabel, StringComparison.Ordinal);

    /// <summary>
    /// Stubs Cashea de financiación recreados con otro Id (p. ej. al guardar edición) son el mismo pago para auditoría.
    /// </summary>
    public static bool AreCasheaFinancingStubsEquivalent(PartialPayment a, PartialPayment b)
    {
        if (!IsCasheaFinancingStub(a) || !IsCasheaFinancingStub(b))
            return false;

        if (!string.Equals(a.Method?.Trim(), b.Method?.Trim(), StringComparison.OrdinalIgnoreCase))
            return false;

        var (amtA, curA) = AuditLabelFormatter.GetOriginalPaymentDisplay(a);
        var (amtB, curB) = AuditLabelFormatter.GetOriginalPaymentDisplay(b);

        if (!string.Equals(curA, curB, StringComparison.OrdinalIgnoreCase))
            return false;

        return Math.Abs(amtA - amtB) <= 0.02m;
    }

    public static bool IsCasheaOrder(Order order)
    {
        if (string.Equals(order.PaymentCondition?.Trim(), "cashea", StringComparison.OrdinalIgnoreCase))
            return true;

        return string.Equals(order.PaymentMethod?.Trim(), "cashea", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsCasheaCommerciallySettled(Order order, decimal usdRate)
    {
        if (!IsCasheaOrder(order))
            return false;

        var (payments, _) = GetActivePaymentsForReport(order);
        var inStore = payments.Where(p => !IsCasheaFinancingStub(p)).ToList();
        var financed = payments.Where(IsCasheaFinancingStub).ToList();

        if (inStore.Count == 0 || financed.Count == 0)
            return false;

        if (IsUsdBaseOrder(order))
        {
            var totalDue = order.Total;
            var inStoreUsd = inStore.Sum(p => PaymentToUsd(p, order));
            var financedUsd = financed.Sum(p => PaymentToUsd(p, order));
            return inStoreUsd + financedUsd >= totalDue - CasheaCommercialSettlementEpsilonUsd;
        }

        var totalDueBs = order.Total;
        var inStoreBs = inStore.Sum(p => p.Amount);
        var financedBs = financed.Sum(p => p.Amount);
        return inStoreBs + financedBs >= totalDueBs - PaymentBalanceEpsilonBs;
    }

    /// <summary>
    /// Cashea exige cobro inicial parcial; si el total queda cubierto en tienda, debe usarse Todo Pago.
    /// </summary>
    public static void ValidateCasheaRequiresPartialInStorePayment(Order order)
    {
        if (!string.Equals(order.PaymentCondition?.Trim(), "cashea", StringComparison.OrdinalIgnoreCase))
            return;

        var (payments, _) = GetActivePaymentsForReport(order);
        var inStore = payments.Where(p => !IsCasheaFinancingStub(p)).ToList();
        if (inStore.Count == 0)
        {
            throw new ArgumentException(
                "Cashea requiere al menos un pago inicial en tienda.",
                nameof(order.PaymentCondition));
        }

        if (IsUsdBaseOrder(order))
        {
            var totalDue = order.Total;
            var inStoreUsd = inStore.Sum(p => PaymentToUsd(p, order));
            if (inStoreUsd <= 0)
            {
                throw new ArgumentException(
                    "Cashea: el pago inicial en tienda debe ser mayor a 0.",
                    nameof(order.PaymentCondition));
            }

            if (inStoreUsd >= totalDue - PaymentBalanceEpsilonUsd)
            {
                throw new ArgumentException(
                    "Cashea requiere un pago inicial parcial. Si el cliente pagó el total, use Todo Pago.",
                    nameof(order.PaymentCondition));
            }

            return;
        }

        var totalDueBs = order.Total;
        var inStoreBs = inStore.Sum(p => p.Amount);
        if (inStoreBs <= 0)
        {
            throw new ArgumentException(
                "Cashea: el pago inicial en tienda debe ser mayor a 0.",
                nameof(order.PaymentCondition));
        }

        if (inStoreBs >= totalDueBs - PaymentBalanceEpsilonBs)
        {
            throw new ArgumentException(
                "Cashea requiere un pago inicial parcial. Si el cliente pagó el total, use Todo Pago.",
                nameof(order.PaymentCondition));
        }
    }

    /// <summary>
    /// Saldo pendiente comercial en USD para visualización y reportes.
    /// Cashea cubierto (inicial + financiación) se reporta como 0 sin alterar SumPaymentsToUsd.
    /// </summary>
    public static decimal GetOrderPendingUsd(Order order, decimal usdRate)
    {
        if (IsCasheaCommerciallySettled(order, usdRate))
            return 0m;

        var casheaPending = GetCasheaPendingAfterFinancing(order);
        if (casheaPending.HasValue)
            return casheaPending.Value;

        var totalUsd = GetOrderTotalUsd(order, usdRate);
        var paidUsd = SumPaymentsToUsd(order);
        return Math.Max(0m, totalUsd - paidUsd);
    }

    private static decimal? GetCasheaPendingAfterFinancing(Order order)
    {
        if (!IsCasheaOrder(order))
            return null;

        var (payments, _) = GetActivePaymentsForReport(order);
        var financed = payments.Where(IsCasheaFinancingStub).ToList();
        if (financed.Count == 0)
            return null;

        var inStore = payments.Where(p => !IsCasheaFinancingStub(p)).ToList();

        if (IsUsdBaseOrder(order))
        {
            var totalDue = order.Total;
            var inStoreUsd = inStore.Sum(p => PaymentToUsd(p, order));
            var financedUsd = financed.Sum(p => PaymentToUsd(p, order));
            return Math.Max(0m, totalDue - inStoreUsd - financedUsd);
        }

        var totalDueBs = order.Total;
        var inStoreBs = inStore.Sum(p => p.Amount);
        var financedBs = financed.Sum(p => p.Amount);
        return Math.Max(0m, totalDueBs - inStoreBs - financedBs);
    }

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

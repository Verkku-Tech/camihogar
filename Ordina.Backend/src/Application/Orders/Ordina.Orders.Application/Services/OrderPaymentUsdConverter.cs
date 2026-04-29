using Ordina.Database.Entities.Order;
using System.Linq;

namespace Ordina.Orders.Application.Services;

/// <summary>
/// Convierte montos de abonos y total del pedido a USD usando las tasas del pedido (Bs/USD, Bs/EUR).
/// </summary>
public static class OrderPaymentUsdConverter
{
    public static IReadOnlyList<PartialPayment> GetActivePayments(Order order)
    {
        if (order.PartialPayments is { Count: > 0 })
            return order.PartialPayments;
        if (order.MixedPayments is { Count: > 0 })
            return order.MixedPayments;
        return Array.Empty<PartialPayment>();
    }

    public static decimal GetBsPerUsd(Order order)
    {
        var r = order.ExchangeRatesAtCreation?.Usd?.Rate ?? 0;
        if (r <= 0)
            throw new InvalidOperationException("El pedido no tiene tasa USD (exchangeRatesAtCreation.usd.rate).");
        return r;
    }

    public static decimal PaymentLineToUsd(PartialPayment payment, Order order)
    {
        var det = payment.PaymentDetails;
        var monto = det?.OriginalAmount ?? det?.CashReceived ?? payment.Amount;
        var mon = det?.OriginalCurrency ?? det?.CashCurrency ?? "Bs";
        return ConvertAmountToUsd(monto, mon, det?.ExchangeRate, order);
    }

    public static decimal MainPaymentToUsd(Order order)
    {
        var det = order.PaymentDetails;
        var monto = det?.OriginalAmount ?? det?.CashReceived ?? order.Total;
        var mon = det?.OriginalCurrency ?? det?.CashCurrency ?? "Bs";
        return ConvertAmountToUsd(monto, mon, det?.ExchangeRate, order);
    }

    public static decimal OrderTotalToUsd(Order order)
    {
        return order.Total / GetBsPerUsd(order);
    }

    /// <summary>Suma abonos activos en USD; si no hay listas, usa el pago principal.</summary>
    public static decimal SumPaymentsUsd(Order order)
    {
        var list = GetActivePayments(order);
        if (list.Count > 0)
            return list.Sum(p => PaymentLineToUsd(p, order));
        if (!string.IsNullOrWhiteSpace(order.PaymentMethod))
            return MainPaymentToUsd(order);
        return 0;
    }

    public static decimal ComputeOverpaymentUsd(Order order)
    {
        var totalUsd = OrderTotalToUsd(order);
        var paidUsd = SumPaymentsUsd(order);
        var excess = paidUsd - totalUsd;
        return excess > 0 ? Math.Round(excess, 2, MidpointRounding.AwayFromZero) : 0;
    }

    private static decimal ConvertAmountToUsd(
        decimal amount,
        string? currency,
        decimal? paymentBsPerUsdOrNull,
        Order order)
    {
        var cur = (currency ?? "Bs").Trim();
        if (string.Equals(cur, "USD", StringComparison.OrdinalIgnoreCase))
            return amount;

        var bsPerUsd = GetBsPerUsd(order);

        if (string.Equals(cur, "EUR", StringComparison.OrdinalIgnoreCase))
        {
            var bsPerEur = order.ExchangeRatesAtCreation?.Eur?.Rate ?? 0;
            if (bsPerEur <= 0)
                throw new InvalidOperationException("El pedido no tiene tasa EUR para convertir el pago.");
            var bs = amount * bsPerEur;
            return bs / bsPerUsd;
        }

        var rate = paymentBsPerUsdOrNull is > 0 ? paymentBsPerUsdOrNull.Value : bsPerUsd;
        return amount / rate;
    }
}

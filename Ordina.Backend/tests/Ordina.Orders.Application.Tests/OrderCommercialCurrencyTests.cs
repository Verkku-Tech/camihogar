using Ordina.Database.Entities.Order;
using Ordina.Orders.Application;

namespace Ordina.Orders.Application.Tests;

public class OrderCommercialCurrencyTests
{
    private static Order UsdOrder(decimal total) => new()
    {
        BaseCurrency = "USD",
        Total = total,
        ExchangeRatesAtCreation = new ExchangeRatesAtCreation
        {
            Usd = new ExchangeRateInfo { Rate = 676m },
        },
    };

    private static Order LegacyBsOrder(decimal totalBs) => new()
    {
        Total = totalBs,
        ExchangeRatesAtCreation = new ExchangeRatesAtCreation
        {
            Usd = new ExchangeRateInfo { Rate = 676m },
        },
    };

    [Fact]
    public void GetOrderTotalUsd_WhenBaseCurrencyUsd_ReturnsTotalWithoutDividingByRate()
    {
        var order = UsdOrder(243.60m);

        var result = OrderCommercialCurrency.GetOrderTotalUsd(order, 676m);

        Assert.Equal(243.60m, result);
    }

    [Fact]
    public void GetOrderTotalUsd_WhenLegacyBsOrder_ConvertsUsingRate()
    {
        var order = LegacyBsOrder(141_942.36m);

        var result = decimal.Round(
            OrderCommercialCurrency.GetOrderTotalUsd(order, 676m),
            2,
            MidpointRounding.AwayFromZero);

        Assert.Equal(209.97m, result);
    }

    [Fact]
    public void GetOrderTotalUsd_DoesNotReproduceBugDividingUsdTotalByRate()
    {
        var order = UsdOrder(243.60m);

        var wrong = order.Total / 676m;
        var correct = OrderCommercialCurrency.GetOrderTotalUsd(order, 676m);

        Assert.NotEqual(wrong, correct);
        Assert.Equal(243.60m, correct);
        Assert.True(wrong < 1m);
    }

    [Fact]
    public void SumPaymentsToUsd_WhenUsdPaymentOnUsdOrder_ReturnsPaymentAmount()
    {
        var order = UsdOrder(210m);
        order.PartialPayments = new List<PartialPayment>
        {
            new()
            {
                Amount = 210m,
                Method = "Efectivo",
                PaymentDetails = new PaymentDetails
                {
                    OriginalAmount = 210m,
                    OriginalCurrency = "USD",
                },
            },
        };

        var paid = OrderCommercialCurrency.SumPaymentsToUsd(order);

        Assert.Equal(210m, paid);
    }

    [Fact]
    public void SumPaymentsToUsd_WhenPartialUsdPayment_ReturnsRemainingBalanceInUsd()
    {
        var order = UsdOrder(243.60m);
        order.PartialPayments = new List<PartialPayment>
        {
            new()
            {
                Amount = 113.60m,
                Method = "Tarjeta de débito",
                PaymentDetails = new PaymentDetails
                {
                    OriginalAmount = 113.60m,
                    OriginalCurrency = "USD",
                },
            },
        };

        var totalUsd = OrderCommercialCurrency.GetOrderTotalUsd(order, 676m);
        var paidUsd = OrderCommercialCurrency.SumPaymentsToUsd(order);
        var saldo = totalUsd - paidUsd;

        Assert.Equal(243.60m, totalUsd);
        Assert.Equal(113.60m, paidUsd);
        Assert.Equal(130.00m, saldo);
    }

    [Fact]
    public void DeterminePaymentStatusInUsd_ReturnsPagadoWhenFullyPaid()
    {
        var status = OrderCommercialCurrency.DeterminePaymentStatusInUsd(210m, 210m);
        Assert.Equal("Pagado", status);
    }

    [Fact]
    public void IsUsdBaseOrder_InfersUsdWhenAllLinePricesAreUsd()
    {
        var order = new Order
        {
            Products = new List<OrderProduct>
            {
                new() { PriceCurrency = "USD" },
            },
            Total = 500m,
        };

        Assert.True(OrderCommercialCurrency.IsUsdBaseOrder(order));
    }

    [Fact]
    public void GetOrderPendingUsd_WhenCasheaUsdFullySettled_ReturnsZero()
    {
        const decimal usdRate = 676m;
        var order = UsdOrder(243.60m);
        order.PaymentCondition = "cashea";
        order.PartialPayments = new List<PartialPayment>
        {
            new()
            {
                Amount = 130m,
                Method = "Efectivo",
                PaymentDetails = new PaymentDetails
                {
                    OriginalAmount = 130m,
                    OriginalCurrency = "USD",
                },
            },
            new()
            {
                Amount = 113.60m * usdRate,
                Method = "Cashea (financiación)",
                PaymentDetails = new PaymentDetails
                {
                    CasheaFinancedPortion = true,
                    OriginalAmount = 113.60m * usdRate,
                    OriginalCurrency = "Bs",
                },
            },
        };

        Assert.True(OrderCommercialCurrency.IsCasheaCommerciallySettled(order, usdRate));
        Assert.Equal(0m, OrderCommercialCurrency.GetOrderPendingUsd(order, usdRate));
        Assert.Equal(130m, OrderCommercialCurrency.SumPaymentsToUsd(order));
        Assert.Equal(
            "Pagado",
            OrderCommercialCurrency.DeterminePaymentStatusInUsd(
                243.60m,
                243.60m - OrderCommercialCurrency.GetOrderPendingUsd(order, usdRate)));
    }

    [Fact]
    public void GetOrderPendingUsd_WhenCasheaWithoutFinancingStub_ReturnsRemainingBalance()
    {
        const decimal usdRate = 676m;
        var order = UsdOrder(243.60m);
        order.PaymentCondition = "cashea";
        order.PartialPayments = new List<PartialPayment>
        {
            new()
            {
                Amount = 130m,
                Method = "Efectivo",
                PaymentDetails = new PaymentDetails
                {
                    OriginalAmount = 130m,
                    OriginalCurrency = "USD",
                },
            },
        };

        Assert.False(OrderCommercialCurrency.IsCasheaCommerciallySettled(order, usdRate));
        Assert.Equal(113.60m, OrderCommercialCurrency.GetOrderPendingUsd(order, usdRate));
    }

    [Fact]
    public void IsCasheaOrder_WhenLegacyPaymentMethodOnly_ReturnsTrue()
    {
        var order = UsdOrder(200m);
        order.PaymentMethod = "Cashea";

        Assert.True(OrderCommercialCurrency.IsCasheaOrder(order));
    }
}

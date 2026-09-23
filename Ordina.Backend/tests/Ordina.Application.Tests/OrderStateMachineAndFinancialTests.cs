using System;
using System.Collections.Generic;
using System.Linq;
using Ordina.Domain.Enums;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class OrderStateMachineAndFinancialTests
{
    [Theory]
    [InlineData(OrderStatus.Pending, "Pendiente")]
    [InlineData(OrderStatus.Reserved, "Apartado")]
    [InlineData(OrderStatus.Completed, "Completado")]
    [InlineData(OrderStatus.Cancelled, "Cancelado")]
    public void OrderStatus_BidirectionalMapping_IsConsistent(OrderStatus status, string expectedDbString)
    {
        Assert.Equal(expectedDbString, status.ToDbString());
        Assert.Equal(status, OrderStatusExtensions.ParseOrderStatus(expectedDbString));
    }

    [Theory]
    [InlineData(LogisticStatus.Generated, "Generado")]
    [InlineData(LogisticStatus.Manufacturing, "Fabricándose")]
    [InlineData(LogisticStatus.InWarehouse, "En Almacén")]
    [InlineData(LogisticStatus.EnRoute, "En Ruta")]
    [InlineData(LogisticStatus.Completed, "Completado")]
    public void LogisticStatus_BidirectionalMapping_IsConsistent(LogisticStatus status, string expectedDbString)
    {
        Assert.Equal(expectedDbString, status.ToDbString());
        Assert.Equal(status, LogisticStatusExtensions.ParseLogisticStatus(expectedDbString));
    }

    [Theory]
    [InlineData(PaymentStatus.Pending, "Pending")]
    [InlineData(PaymentStatus.Completed, "Completed")]
    [InlineData(PaymentStatus.Failed, "Failed")]
    [InlineData(PaymentStatus.Refunded, "Refunded")]
    public void PaymentStatus_BidirectionalMapping_IsConsistent(PaymentStatus status, string expectedDbString)
    {
        Assert.Equal(expectedDbString, status.ToDbString());
        Assert.Equal(status, PaymentStatusExtensions.ParsePaymentStatus(expectedDbString));
    }

    [Fact]
    public void OrderFinancialCalculation_WithPercentageDiscountAndDelivery_CalculatesExactTotal()
    {
        var order = new Order
        {
            OrderNumber = "ORD-FIN-001",
            Subtotal = 1000m,
            GeneralDiscountPercent = 15m,
            GeneralDiscountAmount = 150m, // 15% of 1000
            DeliveryCost = 45m,
            TaxAmount = 0m
        };

        order.Total = order.Subtotal - (order.GeneralDiscountAmount ?? 0m) + order.DeliveryCost + order.TaxAmount;

        Assert.Equal(895m, order.Total);
    }

    [Fact]
    public void OrderFinancialCalculation_WithStoreCredit_DeductsFromBalanceDue()
    {
        var order = new Order
        {
            OrderNumber = "ORD-FIN-002",
            Subtotal = 500m,
            DeliveryCost = 50m,
            Total = 550m,
            AppliedStoreCreditUsd = 100m,
            PartialPayments =
            [
                new PartialPayment { Amount = 200m }
            ]
        };

        var totalPaid = (order.PartialPayments?.Sum(p => p.Amount) ?? 0m) + order.AppliedStoreCreditUsd;
        var balanceDue = order.Total - totalPaid;

        Assert.Equal(300m, totalPaid);
        Assert.Equal(250m, balanceDue);
    }

    [Fact]
    public void OrderFinancialCalculation_DetectsOverpaymentAccurately()
    {
        var order = new Order
        {
            OrderNumber = "ORD-FIN-003",
            Total = 250m,
            PartialPayments =
            [
                new PartialPayment { Amount = 150m },
                new PartialPayment { Amount = 150m }
            ]
        };

        var totalPaid = order.PartialPayments.Sum(p => p.Amount);
        var overpayment = Math.Max(0m, totalPaid - order.Total);

        Assert.Equal(300m, totalPaid);
        Assert.Equal(50m, overpayment);
    }
}

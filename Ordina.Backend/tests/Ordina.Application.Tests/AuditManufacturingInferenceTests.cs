using Ordina.Application.Orders.Helpers;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class AuditManufacturingInferenceTests
{
    private static readonly AuditChange PaymentAdded = new()
    {
        Field = "partialPayments[+]",
        OldValue = null,
        NewValue = "Id=66f1a2b3c4d5e6f7a8b9c0d1; Monto=125.50; Moneda=USD; Método=Efectivo $; Fecha=2026-08-12T10:00:00.0000000Z; Detalle: Conciliado=False; "
    };

    [Fact]
    public void BuildSemanticSummary_WithCreatedActionAndPayment_AnnotatesPaymentAddedDuringCreation()
    {
        var summary = AuditManufacturingInference.BuildSemanticSummary(
            "ORD-1297",
            [PaymentAdded],
            [],
            action: "created");

        Assert.Contains("Agregó pago durante la creación del pedido", summary);
        Assert.Contains("Efectivo $", summary);
    }

    [Fact]
    public void BuildSemanticSummary_WithUpdatedActionAndPayment_KeepsGenericText()
    {
        var summary = AuditManufacturingInference.BuildSemanticSummary(
            "ORD-1297",
            [PaymentAdded],
            [],
            action: "updated");

        Assert.Contains("Agregó pago:", summary);
        Assert.DoesNotContain("durante la creación", summary);
    }

    [Fact]
    public void OrderNumberNormalizer_FormatsRawNumbersCorrectly()
    {
        Assert.Equal("ORD-042", OrderNumberNormalizer.Normalize("42"));
        Assert.Equal("ORD-100", OrderNumberNormalizer.Normalize("ord-100"));
        Assert.Equal("RES-005", OrderNumberNormalizer.Normalize("res-5"));
        Assert.Equal("PRE-012", OrderNumberNormalizer.Normalize("pre-012"));
    }
}

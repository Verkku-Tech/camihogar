using Ordina.Database.Entities.Audit;
using Ordina.Orders.Application.Helpers;

namespace Ordina.Orders.Application.Tests;

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
            new[] { PaymentAdded },
            Array.Empty<ManufacturingAuditEvent>(),
            action: "created");

        Assert.Contains("Agregó pago durante la creación del pedido", summary);
        Assert.Contains("Efectivo $", summary);
    }

    [Fact]
    public void BuildSemanticSummary_WithUpdatedActionAndPayment_KeepsGenericText()
    {
        var summary = AuditManufacturingInference.BuildSemanticSummary(
            "ORD-1297",
            new[] { PaymentAdded },
            Array.Empty<ManufacturingAuditEvent>(),
            action: "updated");

        Assert.Contains("Agregó pago:", summary);
        Assert.DoesNotContain("durante la creación", summary);
    }
}

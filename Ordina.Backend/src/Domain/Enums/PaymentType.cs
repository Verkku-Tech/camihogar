namespace Ordina.Domain.Enums;

public enum PaymentType
{
    Direct,
    Layaway,
    Mixed
}

public static class PaymentTypeExtensions
{
    public static string ToDbString(this PaymentType type) => type switch
    {
        PaymentType.Direct => "directo",
        PaymentType.Layaway => "apartado",
        PaymentType.Mixed => "mixto",
        _ => "directo"
    };

    public static PaymentType ParsePaymentType(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "apartado" or "layaway" => PaymentType.Layaway,
        "mixto" or "mixed" => PaymentType.Mixed,
        _ => PaymentType.Direct
    };
}

namespace Ordina.Domain.Enums;

public enum PaymentStatus
{
    Pending,
    Completed,
    Failed,
    Refunded
}

public static class PaymentStatusExtensions
{
    public static string ToDbString(this PaymentStatus status) => status switch
    {
        PaymentStatus.Pending => "Pending",
        PaymentStatus.Completed => "Completed",
        PaymentStatus.Failed => "Failed",
        PaymentStatus.Refunded => "Refunded",
        _ => "Pending"
    };

    public static PaymentStatus ParsePaymentStatus(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "completed" or "completado" => PaymentStatus.Completed,
        "failed" or "fallido" => PaymentStatus.Failed,
        "refunded" or "reembolsado" => PaymentStatus.Refunded,
        _ => PaymentStatus.Pending
    };
}

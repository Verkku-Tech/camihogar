namespace Ordina.Domain.Enums;

public enum AvailabilityStatus
{
    Available,    // disponible
    NotAvailable  // no_disponible
}

public static class AvailabilityStatusExtensions
{
    public static string ToDbString(this AvailabilityStatus status) => status switch
    {
        AvailabilityStatus.Available => "disponible",
        AvailabilityStatus.NotAvailable => "no_disponible",
        _ => "disponible"
    };

    public static AvailabilityStatus ParseAvailabilityStatus(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "no_disponible" or "notavailable" => AvailabilityStatus.NotAvailable,
        _ => AvailabilityStatus.Available
    };
}

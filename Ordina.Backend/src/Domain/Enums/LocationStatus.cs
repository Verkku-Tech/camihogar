namespace Ordina.Domain.Enums;

public enum LocationStatus
{
    None,
    InStore,       // EN TIENDA
    Manufacturing, // FABRICACION
    InDispatch,    // EN DESPACHO
    Dispatched     // DESPACHADO
}

public static class LocationStatusExtensions
{
    public static string ToDbString(this LocationStatus status) => status switch
    {
        LocationStatus.InStore => "EN TIENDA",
        LocationStatus.Manufacturing => "FABRICACION",
        LocationStatus.InDispatch => "EN DESPACHO",
        LocationStatus.Dispatched => "DESPACHADO",
        _ => string.Empty
    };

    public static LocationStatus ParseLocationStatus(string? value) => (value?.Trim().ToUpperInvariant()) switch
    {
        "EN TIENDA" or "INSTORE" => LocationStatus.InStore,
        "FABRICACION" or "MANUFACTURING" => LocationStatus.Manufacturing,
        "EN DESPACHO" or "INDISPATCH" => LocationStatus.InDispatch,
        "DESPACHADO" or "DISPATCHED" => LocationStatus.Dispatched,
        _ => LocationStatus.None
    };
}

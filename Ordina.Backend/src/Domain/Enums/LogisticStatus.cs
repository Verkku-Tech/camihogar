namespace Ordina.Domain.Enums;

public enum LogisticStatus
{
    Generated,      // Generado
    Manufacturing,  // Fabricándose
    InWarehouse,    // En Almacén
    EnRoute,        // En Ruta
    Completed       // Completado
}

public static class LogisticStatusExtensions
{
    public static string ToDbString(this LogisticStatus status) => status switch
    {
        LogisticStatus.Generated => "Generado",
        LogisticStatus.Manufacturing => "Fabricándose",
        LogisticStatus.InWarehouse => "En Almacén",
        LogisticStatus.EnRoute => "En Ruta",
        LogisticStatus.Completed => "Completado",
        _ => "Generado"
    };

    public static LogisticStatus ParseLogisticStatus(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "fabricándose" or "fabricandose" or "manufacturing" => LogisticStatus.Manufacturing,
        "en almacén" or "en almacen" or "inwarehouse" => LogisticStatus.InWarehouse,
        "en ruta" or "enroute" => LogisticStatus.EnRoute,
        "completado" or "completed" => LogisticStatus.Completed,
        _ => LogisticStatus.Generated
    };
}

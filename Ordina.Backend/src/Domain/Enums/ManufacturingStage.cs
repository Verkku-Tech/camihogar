namespace Ordina.Domain.Enums;

public enum ManufacturingStage
{
    MustManufacture,       // debe_fabricar
    ToManufacture,         // por_fabricar
    Manufacturing,         // fabricando
    WarehouseUnmanufactured // almacen_no_fabricado
}

public static class ManufacturingStageExtensions
{
    public static string ToDbString(this ManufacturingStage stage) => stage switch
    {
        ManufacturingStage.MustManufacture => "debe_fabricar",
        ManufacturingStage.ToManufacture => "por_fabricar",
        ManufacturingStage.Manufacturing => "fabricando",
        ManufacturingStage.WarehouseUnmanufactured => "almacen_no_fabricado",
        _ => "debe_fabricar"
    };

    public static ManufacturingStage ParseManufacturingStage(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "por_fabricar" => ManufacturingStage.ToManufacture,
        "fabricando" or "manufacturing" => ManufacturingStage.Manufacturing,
        "almacen_no_fabricado" => ManufacturingStage.WarehouseUnmanufactured,
        _ => ManufacturingStage.MustManufacture
    };
}

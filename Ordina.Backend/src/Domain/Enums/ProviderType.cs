namespace Ordina.Domain.Enums;

public enum ProviderType
{
    RawMaterial,   // materia-prima
    Services,      // servicios
    FinishedGoods  // productos-terminados
}

public static class ProviderTypeExtensions
{
    public static string ToDbString(this ProviderType type) => type switch
    {
        ProviderType.RawMaterial => "materia-prima",
        ProviderType.Services => "servicios",
        ProviderType.FinishedGoods => "productos-terminados",
        _ => "materia-prima"
    };

    public static ProviderType ParseProviderType(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "servicios" or "services" => ProviderType.Services,
        "productos-terminados" or "finishedgoods" => ProviderType.FinishedGoods,
        _ => ProviderType.RawMaterial
    };
}

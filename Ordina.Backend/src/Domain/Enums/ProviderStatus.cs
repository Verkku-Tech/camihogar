namespace Ordina.Domain.Enums;

public enum ProviderStatus
{
    Active,
    Inactive
}

public static class ProviderStatusExtensions
{
    public static string ToDbString(this ProviderStatus status) => status == ProviderStatus.Active ? "activo" : "inactivo";

    public static ProviderStatus ParseProviderStatus(string? value) =>
        string.Equals(value?.Trim(), "inactivo", StringComparison.OrdinalIgnoreCase)
            ? ProviderStatus.Inactive
            : ProviderStatus.Active;
}

namespace Ordina.Domain.Enums;

public enum ClientStatus
{
    Active,
    Inactive
}

public static class ClientStatusExtensions
{
    public static string ToDbString(this ClientStatus status) => status == ClientStatus.Active ? "activo" : "inactivo";

    public static ClientStatus ParseClientStatus(string? value) =>
        string.Equals(value?.Trim(), "inactivo", StringComparison.OrdinalIgnoreCase)
            ? ClientStatus.Inactive
            : ClientStatus.Active;
}

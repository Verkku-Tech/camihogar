namespace Ordina.Domain.Enums;

public enum ClientType
{
    Individual, // particular
    Company     // empresa
}

public static class ClientTypeExtensions
{
    public static string ToDbString(this ClientType type) => type == ClientType.Company ? "empresa" : "particular";

    public static ClientType ParseClientType(string? value) =>
        string.Equals(value?.Trim(), "empresa", StringComparison.OrdinalIgnoreCase)
            ? ClientType.Company
            : ClientType.Individual;
}

namespace Ordina.Database.Entities.User;

/// <summary>
/// Modos de exclusividad de comisión para vendedores.
/// </summary>
public static class CommissionExclusivityModes
{
    public const string Shared = "shared";
    public const string Exclusive = "exclusive";
    public const string ExclusiveWithReferrer = "exclusive_with_referrer";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Shared,
        Exclusive,
        ExclusiveWithReferrer,
    };

    public static bool IsValid(string? mode) =>
        !string.IsNullOrWhiteSpace(mode) && All.Contains(mode.Trim());

    public static string Normalize(string? mode, bool legacyExclusiveCommission = false)
    {
        if (IsValid(mode) && !string.Equals(mode, Shared, StringComparison.Ordinal))
            return mode!.Trim();

        if (legacyExclusiveCommission)
            return Exclusive;

        return IsValid(mode) ? mode!.Trim() : Shared;
    }

    public static bool IsExclusive(string? mode) =>
        Normalize(mode) != Shared;
}

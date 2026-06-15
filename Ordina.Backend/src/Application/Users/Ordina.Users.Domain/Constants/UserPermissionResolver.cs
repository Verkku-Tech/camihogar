namespace Ordina.Users.Domain.Constants;

/// <summary>
/// Combina permisos del rol con permisos exclusivos del usuario (solo suma, sin duplicados).
/// </summary>
public static class UserPermissionResolver
{
    public static List<string> Merge(
        IEnumerable<string>? rolePermissions,
        IEnumerable<string>? extraPermissions)
    {
        var merged = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var permission in rolePermissions ?? [])
        {
            if (string.IsNullOrWhiteSpace(permission)) continue;
            var trimmed = permission.Trim();
            if (seen.Add(trimmed))
                merged.Add(trimmed);
        }

        foreach (var permission in extraPermissions ?? [])
        {
            if (string.IsNullOrWhiteSpace(permission)) continue;
            var trimmed = permission.Trim();
            if (seen.Add(trimmed))
                merged.Add(trimmed);
        }

        return merged;
    }
}

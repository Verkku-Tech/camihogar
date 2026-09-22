using System.Collections.Frozen;

namespace Ordina.Domain.Users;

/// <summary>
/// Permisos que un administrador puede asignar individualmente a un usuario (además del rol).
/// </summary>
public static class AssignableUserPermissions
{
    public sealed record AssignablePermission(string Id, string Label);

    private static readonly AssignablePermission[] All =
    [
        new(Permissions.Dispatch.SendToRoute, "Pasar pedido a ruta"),
        new(Permissions.Dispatch.ConfirmDelivery, "Confirmar entrega (Entregar)"),
        new(Permissions.Manufacturing.Manage, "Gestionar fabricación"),
    ];

    private static readonly FrozenDictionary<string, string> AssignableMap =
        All.ToFrozenDictionary(p => p.Id, p => p.Label, StringComparer.Ordinal);

    public static IReadOnlyList<AssignablePermission> GetAll() => All;

    public static bool IsAssignable(string permission)
    {
        if (string.IsNullOrWhiteSpace(permission)) return false;
        return AssignableMap.ContainsKey(permission.Trim());
    }

    public static string? GetLabel(string permission)
    {
        if (string.IsNullOrWhiteSpace(permission)) return null;
        return AssignableMap.GetValueOrDefault(permission.Trim());
    }

    public static List<string> Normalize(IEnumerable<string>? permissions)
    {
        if (permissions == null) return [];

        var result = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var raw in permissions)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var trimmed = raw.Trim();
            if (!IsAssignable(trimmed))
            {
                throw new ArgumentException(
                    $"Permiso exclusivo no permitido: '{trimmed}'. Solo se pueden asignar permisos de la lista blanca.");
            }

            if (seen.Add(trimmed))
                result.Add(trimmed);
        }

        return result;
    }

    public static List<string> SubtractRolePermissions(
        IEnumerable<string> extraPermissions,
        IEnumerable<string> rolePermissions)
    {
        var roleSet = new HashSet<string>(rolePermissions ?? [], StringComparer.Ordinal);
        return (extraPermissions ?? [])
            .Where(p => !string.IsNullOrWhiteSpace(p) && !roleSet.Contains(p.Trim()))
            .Select(p => p.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }
}

using System.Text.RegularExpressions;

namespace Ordina.Application.Clients;

public static partial class RutValidator
{
    private static readonly Regex RutRegex = new(@"^[VEJPGvejpg]-?[0-9]{5,10}$", RegexOptions.Compiled);

    public static bool IsValid(string? rut)
    {
        if (string.IsNullOrWhiteSpace(rut)) return false;
        return RutRegex.IsMatch(rut.Trim());
    }

    public static string Normalize(string rut)
    {
        if (string.IsNullOrWhiteSpace(rut)) return string.Empty;
        var clean = rut.Trim().ToUpperInvariant().Replace(" ", "");
        if (clean.Length > 1 && clean[1] != '-')
        {
            clean = $"{clean[0]}-{clean[1..]}";
        }
        return clean;
    }
}

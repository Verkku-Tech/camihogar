using System.Globalization;
using System.Text.RegularExpressions;

namespace Ordina.Application.Orders.Helpers;

/// <summary>
/// Normaliza números de documento ORD-/PRE-/RES-/PCF- y sufijos numéricos (mismo criterio que auditoría y front).
/// </summary>
public static partial class OrderNumberNormalizer
{
    [GeneratedRegex(@"^(?i)(ord|pre|res|pcf)\s*-\s*0*(\d+)$")]
    private static partial Regex OrderNumberPrefixRegex();

    [GeneratedRegex(@"^\d+$")]
    private static partial Regex DigitsOnlyRegex();

    public static string Normalize(string orderNumber)
    {
        var s = orderNumber.Trim();
        if (s.Length == 0)
        {
            return s;
        }

        var m = OrderNumberPrefixRegex().Match(s);
        if (m.Success && int.TryParse(m.Groups[2].Value, out var n) && n >= 0)
        {
            return m.Groups[1].Value.ToUpperInvariant() switch
            {
                "ORD" => $"ORD-{Pad3(n)}",
                "PRE" => $"PRE-{Pad3(n)}",
                "RES" => $"RES-{Pad3(n)}",
                "PCF" => $"RES-{Pad3(n)}",
                _ => s
            };
        }

        if (DigitsOnlyRegex().IsMatch(s) && int.TryParse(s, out var only) && only >= 0)
        {
            return $"ORD-{Pad3(only)}";
        }

        return s;
    }

    private static string Pad3(int n) => n.ToString("D3", CultureInfo.InvariantCulture);
}

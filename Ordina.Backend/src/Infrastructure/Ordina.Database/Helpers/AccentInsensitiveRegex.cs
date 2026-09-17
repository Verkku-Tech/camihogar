using System.Text;
using System.Text.RegularExpressions;
using MongoDB.Bson;

namespace Ordina.Database.Helpers;

/// <summary>
/// Convierte términos de búsqueda en regex que ignoran tildes (p. ej. "Genesis" matchea "Génesis").
/// </summary>
public static class AccentInsensitiveRegex
{
    public static string ToPattern(string input)
    {
        if (string.IsNullOrEmpty(input))
            return string.Empty;

        var sb = new StringBuilder();
        foreach (var c in input)
        {
            switch (char.ToLowerInvariant(c))
            {
                case 'a':
                    sb.Append("[aáàäâãAÁÀÄÂÃ]");
                    break;
                case 'e':
                    sb.Append("[eéèëêEÉÈËÊ]");
                    break;
                case 'i':
                    sb.Append("[iíìïîIÍÌÏÎ]");
                    break;
                case 'o':
                    sb.Append("[oóòöôõOÓÒÖÔÕ]");
                    break;
                case 'u':
                    sb.Append("[uúùüûUÚÙÜÛ]");
                    break;
                case 'n':
                    sb.Append("[nñNÑ]");
                    break;
                case 'c':
                    sb.Append("[cçCÇ]");
                    break;
                default:
                    sb.Append(Regex.Escape(c.ToString()));
                    break;
            }
        }

        return sb.ToString();
    }

    public static BsonRegularExpression ToBsonRegex(string input) =>
        new(ToPattern(input), "i");

    public static string[] Tokenize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return Array.Empty<string>();

        return input.Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
    }

    public static IEnumerable<BsonRegularExpression> ToBsonRegexTokens(string? input)
    {
        var tokens = Tokenize(input);
        foreach (var token in tokens)
        {
            yield return ToBsonRegex(token);
        }
    }
}

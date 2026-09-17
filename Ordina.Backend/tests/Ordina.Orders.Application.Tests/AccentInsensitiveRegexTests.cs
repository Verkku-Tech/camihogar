using Ordina.Database.Helpers;
using Xunit;

namespace Ordina.Orders.Application.Tests;

public class AccentInsensitiveRegexTests
{
    [Fact]
    public void Tokenize_SplitsByWhitespaceAndRemovesEmpty()
    {
        var tokens = AccentInsensitiveRegex.Tokenize("  Juan   Muñoz  ");
        Assert.Equal(new[] { "Juan", "Muñoz" }, tokens);
    }

    [Fact]
    public void ToBsonRegexTokens_ReturnsRegexForEachToken()
    {
        var regexes = AccentInsensitiveRegex.ToBsonRegexTokens("Juan Muñoz").ToList();
        Assert.Equal(2, regexes.Count);
        Assert.Contains("J", regexes[0].Pattern);
        Assert.Contains("M", regexes[1].Pattern);
    }
}

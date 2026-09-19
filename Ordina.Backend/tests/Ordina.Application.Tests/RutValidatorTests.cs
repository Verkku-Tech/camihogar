using Ordina.Application.Clients;
using Xunit;

namespace Ordina.Application.Tests;

public class RutValidatorTests
{
    [Theory]
    [InlineData("V12345678", true)]
    [InlineData("V-12345678", true)]
    [InlineData("J-123456789", true)]
    [InlineData("E-87654321", true)]
    [InlineData("G-200012345", true)]
    [InlineData("P-1234567", true)]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData("invalid", false)]
    [InlineData("12345678", false)]
    [InlineData("X-12345678", false)]
    public void IsValid_ValidatesRutCorrectly(string rut, bool expected)
    {
        var actual = RutValidator.IsValid(rut);
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData("v12345678", "V-12345678")]
    [InlineData("J-123456789", "J-123456789")]
    [InlineData("  e-87654321  ", "E-87654321")]
    public void Normalize_FormatsRutWithPrefixDash(string input, string expected)
    {
        var actual = RutValidator.Normalize(input);
        Assert.Equal(expected, actual);
    }
}

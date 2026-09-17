using Ordina.Database.Repositories;
using Xunit;

namespace Ordina.Orders.Application.Tests;

public class ClientSearchFilterPatternTests
{
    [Theory]
    [InlineData("208", false, false)]
    [InlineData("690", false, false)]
    [InlineData("2073", false, false)]
    [InlineData("1894", false, false)]
    [InlineData("ORD-2073", false, false)]
    [InlineData("Juan Muñoz", false, false)]
    [InlineData("04141234567", true, false)]
    [InlineData("0424-9207311", true, false)]
    [InlineData("04125551234", true, false)]
    [InlineData("04161112233", true, false)]
    [InlineData("04269998877", true, false)]
    [InlineData("04221234567", true, false)]
    [InlineData("02129876543", true, false)]
    [InlineData("20738192", false, true)]
    [InlineData("V-20738192", false, true)]
    [InlineData("V20738192", false, true)]
    [InlineData("J-12345678-0", false, true)]
    [InlineData("E-81234567", false, true)]
    public void VerifyPatternDetection(string input, bool expectedPhone, bool expectedCedula)
    {
        var digits = new string(input.Where(char.IsDigit).ToArray());
        
        bool isPhone = IsVenezuelanPhonePattern(input, digits);
        bool isCedula = IsCedulaOrRifPattern(input, digits);

        Assert.Equal(expectedPhone, isPhone);
        Assert.Equal(expectedCedula, isCedula);
    }

    private static bool IsVenezuelanPhonePattern(string token, string digits)
    {
        if (string.IsNullOrEmpty(digits)) return false;

        if (digits.StartsWith("58") && digits.Length >= 6) return true;

        string[] mobilePrefixesWithZero = { "0414", "0424", "0412", "0422", "0416", "0426" };
        string[] mobilePrefixesWithoutZero = { "414", "424", "412", "422", "416", "426" };

        foreach (var p in mobilePrefixesWithZero)
        {
            if (digits.StartsWith(p)) return true;
        }

        if (digits.Length >= 6)
        {
            foreach (var p in mobilePrefixesWithoutZero)
            {
                if (digits.StartsWith(p)) return true;
            }
        }

        if (digits.StartsWith("02") && digits.Length >= 4) return true;

        if (digits.Length >= 10 && digits.Length <= 12) return true;

        return false;
    }

    private static bool IsCedulaOrRifPattern(string token, string digits)
    {
        if (string.IsNullOrEmpty(digits)) return false;

        var trimmed = token.Trim();
        if (System.Text.RegularExpressions.Regex.IsMatch(trimmed, @"^[vVeEjJgGpP][\-\s]?\d+"))
        {
            return true;
        }

        if (digits.Length >= 6 && digits.Length <= 9 && !IsVenezuelanPhonePattern(token, digits))
        {
            return true;
        }

        return false;
    }
}

using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Tests;

public class OrderListFilterTests
{
    [Fact]
    public void HasActiveFilters_ReturnsFalse_WhenAllNull()
    {
        var filter = new OrderListFilterDto();
        Assert.False(filter.HasActiveFilters);
    }

    [Fact]
    public void HasActiveFilters_ReturnsTrue_WhenExcludeStatusesSet()
    {
        var filter = new OrderListFilterDto { ExcludeStatuses = "Declinado,Generado" };
        Assert.True(filter.HasActiveFilters);
    }

    [Fact]
    public void HasActiveFilters_ReturnsTrue_WhenProductFilterPresetSet()
    {
        var filter = new OrderListFilterDto { ProductFilterPreset = "por_despachar" };
        Assert.True(filter.HasActiveFilters);
    }

    [Fact]
    public void HasActiveFilters_ReturnsFalse_WhenExcludeStatusesWhitespace()
    {
        var filter = new OrderListFilterDto { ExcludeStatuses = "   " };
        Assert.False(filter.HasActiveFilters);
    }

    [Fact]
    public void HasActiveFilters_ReturnsFalse_WhenProductFilterPresetWhitespace()
    {
        var filter = new OrderListFilterDto { ProductFilterPreset = "   " };
        Assert.False(filter.HasActiveFilters);
    }

    [Theory]
    [InlineData("search")]
    [InlineData("clientSearch")]
    [InlineData("vendor")]
    [InlineData("status")]
    [InlineData("saleType")]
    public void HasActiveFilters_ReturnsTrue_ForEachExistingFilter(string property)
    {
        var filter = new OrderListFilterDto();
        switch (property)
        {
            case "search": filter.Search = "test"; break;
            case "clientSearch": filter.ClientSearch = "test"; break;
            case "vendor": filter.Vendor = "test"; break;
            case "status": filter.Status = "test"; break;
            case "saleType": filter.SaleType = "test"; break;
        }
        Assert.True(filter.HasActiveFilters);
    }
}

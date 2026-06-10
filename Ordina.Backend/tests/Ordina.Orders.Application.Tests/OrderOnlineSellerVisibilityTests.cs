using Ordina.Database.Entities.Order;
using Ordina.Orders.Application.OnlineSeller;

namespace Ordina.Orders.Application.Tests;

public class OrderOnlineSellerVisibilityTests
{
    private static Order Order(
        string vendorId,
        string? referrerId = null,
        string? sourceReservationVendorId = null) =>
        new()
        {
            VendorId = vendorId,
            ReferrerId = referrerId,
            SourceReservationVendorId = sourceReservationVendorId,
        };

    [Fact]
    public void IsVisibleToTeam_WhenVendorIsOnlineSeller_ReturnsTrue()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-a", "online-b" };
        var order = Order("online-a");

        Assert.True(OrderOnlineSellerVisibility.IsVisibleToTeam(order, team));
    }

    [Fact]
    public void IsVisibleToTeam_WhenReferrerIsOnlineSeller_ReturnsTrue()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-a", "online-b" };
        var order = Order("store-1", referrerId: "online-b");

        Assert.True(OrderOnlineSellerVisibility.IsVisibleToTeam(order, team));
    }

    [Fact]
    public void IsVisibleToTeam_WhenSourceReservationVendorIsOnlineSeller_ReturnsTrue()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-a" };
        var order = Order("store-1", sourceReservationVendorId: "online-a");

        Assert.True(OrderOnlineSellerVisibility.IsVisibleToTeam(order, team));
    }

    [Fact]
    public void IsVisibleToTeam_StoreOnlyOrder_ReturnsFalse()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-a" };
        var order = Order("store-1");

        Assert.False(OrderOnlineSellerVisibility.IsVisibleToTeam(order, team));
    }

    [Fact]
    public void IsOwnedBySeller_WhenVendorMatches_ReturnsTrue()
    {
        var order = Order("online-a");
        Assert.True(OrderOnlineSellerVisibility.IsOwnedBySeller(order, "online-a"));
    }

    [Fact]
    public void IsOwnedBySeller_WhenReferrerMatches_ReturnsTrue()
    {
        var order = Order("store-1", referrerId: "online-a");
        Assert.True(OrderOnlineSellerVisibility.IsOwnedBySeller(order, "online-a"));
    }

    [Fact]
    public void IsOwnedBySeller_OtherOnlineSeller_ReturnsFalse()
    {
        var order = Order("online-a");
        Assert.False(OrderOnlineSellerVisibility.IsOwnedBySeller(order, "online-b"));
    }

    [Fact]
    public void IsOwnedBySeller_SourceReservationOnly_ReturnsFalse()
    {
        var order = Order("store-1", sourceReservationVendorId: "online-a");
        Assert.False(OrderOnlineSellerVisibility.IsOwnedBySeller(order, "online-a"));
    }

    [Theory]
    [InlineData("Online Seller", true)]
    [InlineData("Vendedor Online", true)]
    [InlineData("Store Seller", false)]
    public void IsOnlineSellerRole_DetectsRole(string role, bool expected)
    {
        Assert.Equal(expected, OrderOnlineSellerVisibility.IsOnlineSellerRole(role));
    }
}

using Ordina.Database.Entities.Order;
using Ordina.Orders.Application.Commission;

namespace Ordina.Orders.Application.Tests;

public class CommissionLineClassifierTests
{
    private static OrderProduct Line(string id, int qty = 1, Dictionary<string, object>? attrs = null) =>
        new()
        {
            Id = id,
            Name = "Product",
            Quantity = qty,
            Attributes = attrs
        };

    [Fact]
    public void ClassifyLines_AllUnchanged_WhenIdentical()
    {
        var baseline = new List<OrderProduct> { Line("cat1-1000-abc", 2) };
        var final = new List<OrderProduct> { Line("cat1-2000-xyz", 2) };

        CommissionLineClassifier.ClassifyLines(baseline, final);

        Assert.Equal(CommissionLineSources.ReservationUnchanged, final[0].CommissionLineSource);
        Assert.Equal("cat1", final[0].CatalogProductId);
    }

    [Fact]
    public void ClassifyLines_StoreModified_WhenQtyChanges()
    {
        var baseline = new List<OrderProduct> { Line("cat1-1000-abc", 1) };
        var final = new List<OrderProduct> { Line("cat1-2000-xyz", 3) };

        CommissionLineClassifier.ClassifyLines(baseline, final);

        Assert.Equal(CommissionLineSources.StoreModified, final[0].CommissionLineSource);
    }

    [Fact]
    public void ClassifyLines_StoreAdded_WhenNewSkuWithoutRemoval()
    {
        var baseline = new List<OrderProduct> { Line("cat1-1000-abc") };
        var final = new List<OrderProduct>
        {
            Line("cat1-2000-xyz"),
            Line("cat2-2001-aaa")
        };

        CommissionLineClassifier.ClassifyLines(baseline, final);

        Assert.Equal(CommissionLineSources.ReservationUnchanged, final[0].CommissionLineSource);
        Assert.Equal(CommissionLineSources.StoreAdded, final[1].CommissionLineSource);
    }

    [Fact]
    public void ClassifyLines_StoreSubstitution_WhenRemovedAndReplaced()
    {
        var baseline = new List<OrderProduct> { Line("cat1-1000-abc") };
        var final = new List<OrderProduct> { Line("cat2-2000-xyz") };

        CommissionLineClassifier.ClassifyLines(baseline, final);

        Assert.Equal(CommissionLineSources.StoreSubstitution, final[0].CommissionLineSource);
    }

    [Fact]
    public void ClassifyLines_SubstitutionThenAdded_WhenOneRemovalTwoNew()
    {
        var baseline = new List<OrderProduct> { Line("cat1-1000-abc") };
        var final = new List<OrderProduct>
        {
            Line("cat2-2000-aaa"),
            Line("cat3-2001-bbb")
        };

        CommissionLineClassifier.ClassifyLines(baseline, final);

        Assert.Equal(CommissionLineSources.StoreSubstitution, final[0].CommissionLineSource);
        Assert.Equal(CommissionLineSources.StoreAdded, final[1].CommissionLineSource);
    }

    [Fact]
    public void GetCatalogProductId_LegacyId_ReturnsFullId()
    {
        Assert.Equal("507f1f77bcf86cd799439011", CommissionLineClassifier.GetCatalogProductId("507f1f77bcf86cd799439011"));
    }
}

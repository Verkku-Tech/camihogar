using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using Ordina.Domain.Inventory;
using Xunit;

namespace Ordina.Application.Tests;

public class StockTransferEntityTests
{
    [Fact]
    public void StockTransfer_ShouldSerializeToBson_WithoutDuplicateElementNames()
    {
        var transfer = new StockTransfer
        {
            Id = "60c72b2f9b1d8b2badbee123",
            TransferNumber = "TRF-00001",
            StockId = "stk-1",
            ProductId = "prod-1",
            ProductName = "Test",
            Sku = "SKU-1",
            VariantKey = "vk-1",
            OriginLocationId = "loc-1",
            OriginLocationName = "Tienda 1",
            DestinationLocationId = "loc-2",
            DestinationLocationName = "Tienda 2",
            Quantity = 2,
            Reason = "Test reason"
        };

        var doc = transfer.ToBsonDocument();
        Assert.NotNull(doc);
        Assert.True(doc.Contains("createdAt"));
        Assert.True(doc.Contains("transferNumber"));
    }
}

using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Domain.Orders;

public class RefabricationRecord
{
    [BsonElement("reason")]
    public string Reason { get; set; } = string.Empty;

    [BsonElement("date")]
    public DateTime Date { get; set; } = DateTime.UtcNow;

    [BsonElement("previousProviderId")]
    public string? PreviousProviderId { get; set; }

    [BsonElement("previousProviderName")]
    public string? PreviousProviderName { get; set; }

    [BsonElement("newProviderId")]
    public string? NewProviderId { get; set; }

    [BsonElement("newProviderName")]
    public string? NewProviderName { get; set; }
}

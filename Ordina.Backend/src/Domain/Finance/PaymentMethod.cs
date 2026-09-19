using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Finance;

public class PaymentMethod : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("type")]
    public string Type { get; set; } = string.Empty;

    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;
}

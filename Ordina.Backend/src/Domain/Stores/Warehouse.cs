using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Stores;

public class Warehouse : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("address")]
    public string Address { get; set; } = string.Empty;

    [BsonElement("phone")]
    public string Phone { get; set; } = string.Empty;

    [BsonElement("maxCapacity")]
    public int MaxCapacity { get; set; } = 100;

    [BsonElement("isCentral")]
    public bool IsCentral { get; set; } = false;

    [BsonElement("status")]
    public string Status { get; set; } = "active";
}

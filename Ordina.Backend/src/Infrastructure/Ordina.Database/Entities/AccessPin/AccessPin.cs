using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.AccessPin;

public class AccessPin
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("pin")]
    public string Pin { get; set; } = string.Empty;

    [BsonElement("generatedByUserId")]
    public string GeneratedByUserId { get; set; } = string.Empty;

    [BsonElement("generatedByUserName")]
    public string GeneratedByUserName { get; set; } = string.Empty;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("usedByUserId")]
    public string? UsedByUserId { get; set; }

    [BsonElement("usedAt")]
    public DateTime? UsedAt { get; set; }

    [BsonElement("sessionExpiresAt")]
    public DateTime? SessionExpiresAt { get; set; }

    [BsonElement("orderId")]
    public string? OrderId { get; set; }

    /// <summary>active | used | expired</summary>
    [BsonElement("status")]
    public string Status { get; set; } = "active";
}

public static class AccessPinStatus
{
    public const string Active = "active";
    public const string Used = "used";
    public const string Expired = "expired";
}

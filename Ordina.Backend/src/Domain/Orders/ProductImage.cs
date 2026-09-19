using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Domain.Orders;

public class ProductImage
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("base64")]
    public string Base64 { get; set; } = string.Empty;

    [BsonElement("filename")]
    public string Filename { get; set; } = string.Empty;

    [BsonElement("type")]
    public string Type { get; set; } = string.Empty;

    [BsonElement("uploadedAt")]
    public string UploadedAt { get; set; } = string.Empty;

    [BsonElement("size")]
    public long? Size { get; set; }
}

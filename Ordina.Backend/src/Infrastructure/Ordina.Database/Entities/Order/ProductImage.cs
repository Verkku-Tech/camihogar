using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Order;

public class ProductImage
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("base64")]
    public string Base64 { get; set; } = string.Empty; // Imagen en base64 (data:image/jpeg;base64,...)

    [BsonElement("filename")]
    public string Filename { get; set; } = string.Empty; // Nombre original del archivo

    [BsonElement("type")]
    public string Type { get; set; } = string.Empty; // "model" | "reference" | "other"

    [BsonElement("uploadedAt")]
    public string UploadedAt { get; set; } = string.Empty; // Fecha de carga (ISO string)

    [BsonElement("size")]
    public long? Size { get; set; } // Tamaño del archivo en bytes (opcional)
}


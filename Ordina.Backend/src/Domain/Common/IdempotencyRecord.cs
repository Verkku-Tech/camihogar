using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Domain.Common;

public class IdempotencyRecord
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("mutationId")]
    public string MutationId { get; set; } = string.Empty;

    [BsonElement("httpMethod")]
    public string HttpMethod { get; set; } = string.Empty;

    [BsonElement("endpoint")]
    public string Endpoint { get; set; } = string.Empty;

    [BsonElement("responseStatusCode")]
    public int ResponseStatusCode { get; set; }

    [BsonElement("responseBody")]
    public string? ResponseBody { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

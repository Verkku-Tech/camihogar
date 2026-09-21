using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Notifications;

public class Notification : BaseEntity
{
    public Notification()
    {
        Id = ObjectId.GenerateNewId().ToString();
    }

    [BsonElement("type")]
    public string Type { get; set; } = string.Empty;

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("message")]
    public string Message { get; set; } = string.Empty;

    [BsonElement("severity")]
    public string Severity { get; set; } = "info"; // "info" | "warning" | "error" | "success"

    [BsonElement("link")]
    public string? Link { get; set; }

    [BsonElement("targetUserId")]
    public string? TargetUserId { get; set; }

    [BsonElement("targetRoles")]
    public List<string> TargetRoles { get; set; } = new();

    [BsonElement("readByUserIds")]
    public List<string> ReadByUserIds { get; set; } = new();

    [BsonElement("metadata")]
    public Dictionary<string, object>? Metadata { get; set; }
}

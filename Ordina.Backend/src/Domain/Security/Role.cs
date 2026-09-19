using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Security;

public class Role : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("permissions")]
    public List<string> Permissions { get; set; } = new();

    [BsonElement("isSystem")]
    public bool IsSystem { get; set; } = false;

    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;
}

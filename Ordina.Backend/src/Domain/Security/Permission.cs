using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Security;

public class Permission : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("module")]
    public string? Module { get; set; }

    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;
}

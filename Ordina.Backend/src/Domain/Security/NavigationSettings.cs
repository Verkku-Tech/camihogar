using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Security;

public class NavigationItemSetting
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("active")]
    public bool Active { get; set; } = true;

    [BsonElement("superAdminOnly")]
    public bool SuperAdminOnly { get; set; } = false;

    [BsonElement("allowedRoles")]
    public List<string> AllowedRoles { get; set; } = new();
}

public class NavigationSettings : BaseEntity
{
    [BsonElement("items")]
    public List<NavigationItemSetting> Items { get; set; } = new();
}

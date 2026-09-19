using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Security;

public class RefreshToken : BaseEntity
{
    [BsonElement("token")]
    public string Token { get; set; } = string.Empty;

    [BsonElement("userId")]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("isRevoked")]
    public bool IsRevoked { get; set; } = false;

    [BsonElement("replacedByToken")]
    public string? ReplacedByToken { get; set; }
}

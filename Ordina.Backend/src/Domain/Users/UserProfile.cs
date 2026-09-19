using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Users;

public class UserProfile : BaseEntity
{
    [BsonElement("userId")]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("bio")]
    public string? Bio { get; set; }

    [BsonElement("phoneNumber")]
    public string? PhoneNumber { get; set; }

    [BsonElement("address")]
    public string? Address { get; set; }

    [BsonElement("dateOfBirth")]
    public DateTime? DateOfBirth { get; set; }
}

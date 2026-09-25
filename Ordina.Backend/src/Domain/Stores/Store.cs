using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Stores;

public class Store : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("address")]
    public string Address { get; set; } = string.Empty;

    [BsonElement("phone")]
    public string Phone { get; set; } = string.Empty;

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("rif")]
    public string Rif { get; set; } = string.Empty;

    [BsonElement("status")]
    public string Status { get; set; } = "active";

    [BsonElement("maxCapacity")]
    public int MaxCapacity { get; set; } = 25;

    [BsonElement("productDisplayLimits")]
    public Dictionary<string, int> ProductDisplayLimits { get; set; } = new();
}

public class Account : BaseEntity
{
    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("label")]
    public string Label { get; set; } = string.Empty;

    [BsonElement("storeId")]
    public string StoreId { get; set; } = string.Empty;

    [BsonElement("isForeign")]
    public bool IsForeign { get; set; }

    [BsonElement("accountType")]
    public string AccountType { get; set; } = string.Empty;

    [BsonElement("email")]
    public string? Email { get; set; }

    [BsonElement("wallet")]
    public string? Wallet { get; set; }

    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;
}

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Finance;

public class Commission : BaseEntity
{
    [BsonElement("commissionType")]
    public string CommissionType { get; set; } = string.Empty; // "role" | "user"

    [BsonElement("role")]
    public string? Role { get; set; }

    [BsonElement("userId")]
    public string? UserId { get; set; }

    [BsonElement("userName")]
    public string? UserName { get; set; }

    [BsonElement("commissionKind")]
    public string CommissionKind { get; set; } = string.Empty; // "percentage" | "net"

    [BsonElement("value")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Value { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";
}

public class ProductCommission : BaseEntity
{
    [BsonElement("categoryId")]
    public string CategoryId { get; set; } = string.Empty;

    [BsonElement("categoryName")]
    public string CategoryName { get; set; } = string.Empty;

    [BsonElement("commissionValue")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal CommissionValue { get; set; }
}

public class SaleTypeCommissionRule : BaseEntity
{
    [BsonElement("saleType")]
    public string SaleType { get; set; } = string.Empty; // "entrega", "encargo", "sistema_apartado"

    [BsonElement("saleTypeLabel")]
    public string SaleTypeLabel { get; set; } = string.Empty;

    [BsonElement("familyCommissionUsdPerUnit")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal FamilyCommissionUsdPerUnit { get; set; }

    [BsonElement("vendorRate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal VendorRate { get; set; }

    [BsonElement("referrerRate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal ReferrerRate { get; set; }

    [BsonElement("postventaRate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal PostventaRate { get; set; }
}

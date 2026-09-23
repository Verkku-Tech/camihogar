using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Orders;

public class OrderAuditLog : BaseEntity
{
    [BsonElement("orderId")]
    public string OrderId { get; set; } = string.Empty;

    [BsonElement("orderNumber")]
    public string OrderNumber { get; set; } = string.Empty;

    /// <summary>created, updated, deleted, payment_conciliated, item_validated, order_declined, etc.</summary>
    [BsonElement("action")]
    public string Action { get; set; } = string.Empty;

    [BsonElement("userId")]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("userName")]
    public string UserName { get; set; } = string.Empty;

    [BsonElement("summary")]
    public string Summary { get; set; } = string.Empty;

    [BsonElement("changes")]
    public List<AuditChange> Changes { get; set; } = [];

    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class AuditChange
{
    [BsonElement("field")]
    public string Field { get; set; } = string.Empty;

    [BsonElement("oldValue")]
    public string? OldValue { get; set; }

    [BsonElement("newValue")]
    public string? NewValue { get; set; }
}

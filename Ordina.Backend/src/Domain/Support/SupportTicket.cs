using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Support;

public class SupportTicket : BaseEntity
{
    public SupportTicket()
    {
        Id = ObjectId.GenerateNewId().ToString();
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    [BsonElement("ticketCode")]
    public string TicketCode { get; set; } = string.Empty;

    [BsonElement("userId")]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("userName")]
    public string UserName { get; set; } = string.Empty;

    [BsonElement("userEmail")]
    public string UserEmail { get; set; } = string.Empty;

    [BsonElement("userRole")]
    public string UserRole { get; set; } = string.Empty;

    [BsonElement("storeId")]
    public string? StoreId { get; set; }

    [BsonElement("storeName")]
    public string? StoreName { get; set; }

    [BsonElement("category")]
    public string Category { get; set; } = "system_error"; // system_error, performance, data, question, other

    [BsonElement("priority")]
    public string Priority { get; set; } = "medium"; // low, medium, high, critical

    [BsonElement("subject")]
    public string Subject { get; set; } = string.Empty;

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("currentUrl")]
    public string CurrentUrl { get; set; } = string.Empty;

    [BsonElement("clientInfo")]
    public string? ClientInfo { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "Open";

    [BsonElement("emailSent")]
    public bool EmailSent { get; set; }

    [BsonElement("emailSentAt")]
    public DateTime? EmailSentAt { get; set; }

    [BsonElement("emailError")]
    public string? EmailError { get; set; }
}

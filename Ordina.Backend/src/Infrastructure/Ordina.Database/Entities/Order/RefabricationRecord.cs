using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Order;

/// <summary>
/// Registro de una refabricación de producto.
/// Se utiliza para mantener historial de las veces que un producto
/// ha sido enviado nuevamente a fabricación desde el almacén.
/// </summary>
public class RefabricationRecord
{
    [BsonElement("reason")]
    public string Reason { get; set; } = string.Empty;

    [BsonElement("date")]
    public DateTime Date { get; set; }

    [BsonElement("previousProviderId")]
    public string? PreviousProviderId { get; set; }

    [BsonElement("previousProviderName")]
    public string? PreviousProviderName { get; set; }

    [BsonElement("newProviderId")]
    public string? NewProviderId { get; set; }

    [BsonElement("newProviderName")]
    public string? NewProviderName { get; set; }
}

using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace Ordina.Domain.Orders;

/// <summary>
/// Copia profunda del documento pedido para comparaciones de auditoría.
/// </summary>
public static class OrderDeepClone
{
    public static Order Clone(Order source)
    {
        var doc = source.ToBsonDocument();
        return BsonSerializer.Deserialize<Order>(doc);
    }
}

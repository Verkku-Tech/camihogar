using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace Ordina.Domain.Common;

public class FlexibleObjectIdOrStringSerializer : SerializerBase<string>
{
    public override string Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
    {
        var type = context.Reader.CurrentBsonType;
        switch (type)
        {
            case BsonType.ObjectId:
                return context.Reader.ReadObjectId().ToString();
            case BsonType.String:
                return context.Reader.ReadString();
            case BsonType.Null:
                context.Reader.ReadNull();
                return string.Empty;
            default:
                return context.Reader.ReadString();
        }
    }

    public override void Serialize(BsonSerializationContext context, BsonSerializationArgs args, string value)
    {
        if (!string.IsNullOrWhiteSpace(value) && ObjectId.TryParse(value, out var oid))
        {
            context.Writer.WriteObjectId(oid);
        }
        else
        {
            context.Writer.WriteString(value ?? string.Empty);
        }
    }
}

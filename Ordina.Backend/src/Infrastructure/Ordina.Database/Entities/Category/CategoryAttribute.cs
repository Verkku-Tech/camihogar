using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Category;

public class CategoryAttribute
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("valueType")]
    public string ValueType { get; set; } = string.Empty; // "Single select", "Multiple select", "Text", etc.

    [BsonElement("values")]
    public List<AttributeValue> Values { get; set; } = new();

    [BsonElement("maxSelections")]
    public int? MaxSelections { get; set; } // For "Multiple select" type

    [BsonElement("minValue")]
    public decimal? MinValue { get; set; } // For "Number" type

    [BsonElement("maxValue")]
    public decimal? MaxValue { get; set; } // For "Number" type (REQUIRED when ValueType is "Number")

    [BsonElement("required")]
    public bool? Required { get; set; } // Indica si el atributo es obligatorio (por defecto true)
}

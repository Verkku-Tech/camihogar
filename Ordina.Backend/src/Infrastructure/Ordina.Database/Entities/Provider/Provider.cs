using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Provider;

public class Provider
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("razonSocial")]
    public string RazonSocial { get; set; } = string.Empty;

    [BsonElement("rif")]
    public string Rif { get; set; } = string.Empty;

    [BsonElement("direccion")]
    public string Direccion { get; set; } = string.Empty;

    [BsonElement("telefono")]
    public string Telefono { get; set; } = string.Empty;

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("contacto")]
    public string Contacto { get; set; } = string.Empty;

    [BsonElement("tipo")]
    public string Tipo { get; set; } = string.Empty; // "materia-prima" | "servicios" | "productos-terminados"

    [BsonElement("estado")]
    public string Estado { get; set; } = "activo"; // "activo" | "inactivo"

    [BsonElement("fechaCreacion")]
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
}

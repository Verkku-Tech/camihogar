using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Provider;

public class Provider
{
    //[BsonId]
    //[BsonRepresentation(BsonType.ObjectId)]
    //public Guid Id { get; set; }
    
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }
    

    [BsonElement("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [BsonElement("razonSocial")]
    public string? RazonSocial { get; set; }

    [BsonElement("rif")]
    public string? Rif { get; set; }

    [BsonElement("direccion")]
    public string? Direccion { get; set; }

    [BsonElement("telefono")]
    public string Telefono { get; set; } = string.Empty;

    [BsonElement("email")]
    public string? Email { get; set; }

    [BsonElement("contacto")]
    public string? Contacto { get; set; }

    [BsonElement("tipo")]
    public string? Tipo { get; set; } // "materia-prima" | "servicios" | "productos-terminados"

    [BsonElement("estado")]
    public string Estado { get; set; } = "activo"; // "activo" | "inactivo"

    [BsonElement("fechaCreacion")]
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    [BsonElement("fechaActualizacion")]
    public DateTime? FechaActualizacion { get; set; } = DateTime.UtcNow;
}

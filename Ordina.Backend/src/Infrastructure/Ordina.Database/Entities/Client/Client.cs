using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Client;

public class Client
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("nombreRazonSocial")]
    public string NombreRazonSocial { get; set; } = string.Empty;

    [BsonElement("rutId")]
    public string RutId { get; set; } = string.Empty;

    [BsonElement("direccion")]
    public string Direccion { get; set; } = string.Empty;

    [BsonElement("telefono")]
    public string Telefono { get; set; } = string.Empty;

    [BsonElement("email")]
    public string? Email { get; set; }

    [BsonElement("tipoCliente")]
    public string TipoCliente { get; set; } = string.Empty; // "empresa" | "particular"

    [BsonElement("estado")]
    public string Estado { get; set; } = "activo"; // "activo" | "inactivo"

    [BsonElement("fechaCreacion")]
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    [BsonElement("tieneNotasDespacho")]
    public bool TieneNotasDespacho { get; set; } = false;
}

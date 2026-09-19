using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;
using Ordina.Domain.Enums;

namespace Ordina.Domain.Users;

public class Client : BaseEntity
{
    [BsonElement("nombreRazonSocial")]
    public string NombreRazonSocial { get; set; } = string.Empty;

    [BsonElement("apodo")]
    public string? Apodo { get; set; }

    [BsonElement("rutId")]
    public string RutId { get; set; } = string.Empty;

    [BsonElement("direccion")]
    public string Direccion { get; set; } = string.Empty;

    [BsonElement("telefono")]
    public string Telefono { get; set; } = string.Empty;

    [BsonElement("telefono2")]
    public string? Telefono2 { get; set; }

    [BsonElement("email")]
    public string? Email { get; set; }

    [BsonElement("tipoCliente")]
    public string TipoClienteString { get; set; } = "particular";

    [BsonIgnore]
    public ClientType TipoCliente
    {
        get => ClientTypeExtensions.ParseClientType(TipoClienteString);
        set => TipoClienteString = value.ToDbString();
    }

    [BsonElement("estado")]
    public string EstadoString { get; set; } = "activo";

    [BsonIgnore]
    public ClientStatus Estado
    {
        get => ClientStatusExtensions.ParseClientStatus(EstadoString);
        set => EstadoString = value.ToDbString();
    }

    [BsonElement("tieneNotasDespacho")]
    public bool TieneNotasDespacho { get; set; } = false;
}

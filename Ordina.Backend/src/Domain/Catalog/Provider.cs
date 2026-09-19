using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;
using Ordina.Domain.Enums;

namespace Ordina.Domain.Catalog;

public class Provider : BaseEntity
{
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
    public string? TipoString { get; set; }

    [BsonIgnore]
    public ProviderType? Tipo
    {
        get => TipoString != null ? ProviderTypeExtensions.ParseProviderType(TipoString) : null;
        set => TipoString = value?.ToDbString();
    }

    [BsonElement("estado")]
    public string EstadoString { get; set; } = "activo";

    [BsonIgnore]
    public ProviderStatus Estado
    {
        get => ProviderStatusExtensions.ParseProviderStatus(EstadoString);
        set => EstadoString = value.ToDbString();
    }
}

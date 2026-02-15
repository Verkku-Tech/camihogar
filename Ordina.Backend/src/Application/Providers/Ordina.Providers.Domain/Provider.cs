using MongoDB.Bson;

namespace Ordina.Providers.Domain;

public class Provider
{
    public ObjectId Id { get; set; }
    public string? Rif { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Telefono { get; set; } = string.Empty;
    public string? Direccion { get; set; }
    public string? RazonSocial { get; set; }
    public string? Contacto { get; set; }
    public string? Tipo { get; set; }
    public string Estado { get; set; } = "Activo";
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
} 
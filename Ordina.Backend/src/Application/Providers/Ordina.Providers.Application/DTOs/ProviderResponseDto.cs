namespace Ordina.Providers.Application.DTOs;

public class ProviderResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string RazonSocial { get; set; } = string.Empty;
    public string? Rif { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Telefono { get; set; }
    public string? Direccion { get; set; }
    public string? Contacto { get; set; }
    public string? Tipo { get; set; }
    public string? Estado { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int ProductsCount { get; set; }
}

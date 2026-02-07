namespace Ordina.Orders.Application.DTOs;

public class ProductImageDto
{
    public string Id { get; set; } = string.Empty;
    public string Base64 { get; set; } = string.Empty; // Imagen en base64 (data:image/jpeg;base64,...)
    public string Filename { get; set; } = string.Empty; // Nombre original del archivo
    public string Type { get; set; } = string.Empty; // "model" | "reference" | "other"
    public string UploadedAt { get; set; } = string.Empty; // Fecha de carga (ISO string)
    public long? Size { get; set; } // Tamaño del archivo en bytes (opcional)
}


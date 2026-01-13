using MongoDB.Bson;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ordina.Providers.Application.DTOs
{
    public class ProviderResponseDto
    {
        public ObjectId Id { get; set; }
        public string RazonSocial { get; set; } = string.Empty;
        public string Rif { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string? Direccion { get; set; }
        public string Contacto { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public string? Estado { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public int ProductsCount { get; set; }
    }
}

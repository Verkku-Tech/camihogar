using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ordina.Users.Application.DTOs
{
    public class ClientResponseDto
    {
        public string Id { get; set; } = string.Empty;

        public string NombreRazonSocial { get; set; } = string.Empty;

        public string? Apodo { get; set; }

        public string RutId { get; set; } = string.Empty;

        public string Direccion { get; set; } = string.Empty;

        public string Telefono { get; set; } = string.Empty;

        public string? Telefono2 { get; set; }

        public string? Email { get; set; }

        public string TipoCliente { get; set; } = string.Empty;

        public string Estado { get; set; } = "activo";

        /// <summary>
        /// Fecha de creación del cliente en formato de cadena (ISO 8601) para el frontend.
        /// </summary>
        public string FechaCreacion { get; set; } = string.Empty;

        public bool TieneNotasDespacho { get; set; }
    }


}

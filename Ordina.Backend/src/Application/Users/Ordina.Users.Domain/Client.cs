using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ordina.Users.Domain
{
    public class Client
    {
        public string Id { get; set; } = string.Empty;
        public string NombreRazonSocial { get; set; } = string.Empty;
        public string? Apodo { get; set; }
        public string RutId { get; set; } = string.Empty;
        public string Direccion { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
        public string? Telefono2 { get; set; }
        public string? Email { get; set; }

        /// <summary>
        /// Tipo de cliente: \"empresa\" | \"particular\"
        /// </summary>
        public string TipoCliente { get; set; } = string.Empty;

        /// <summary>
        /// Estado del cliente: \"activo\" | \"inactivo\"
        /// </summary>
        public string Estado { get; set; } = "activo";

        public DateTime FechaCreacion { get; set; }

        public bool TieneNotasDespacho { get; set; }
    }


}

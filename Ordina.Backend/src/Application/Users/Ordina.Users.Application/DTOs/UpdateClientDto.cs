using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ordina.Users.Application.DTOs
{
    public class UpdateClientDto
    {
        [StringLength(200)]
        public string? NombreRazonSocial { get; set; }

        [StringLength(100)]
        public string? Apodo { get; set; }

        [StringLength(20)]
        public string? RutId { get; set; }

        [StringLength(500)]
        public string? Direccion { get; set; }

        [StringLength(20)]
        public string? Telefono { get; set; }

        [StringLength(20)]
        public string? Telefono2 { get; set; }

        [EmailAddress]
        [StringLength(100)]
        public string? Email { get; set; }

        /// <summary>
        /// Tipo de cliente: "empresa" | "particular"
        /// </summary>
        [StringLength(20)]
        public string? TipoCliente { get; set; }

        /// <summary>
        /// Estado del cliente: "activo" | "inactivo"
        /// </summary>
        [StringLength(20)]
        public string? Estado { get; set; }

        public bool? TieneNotasDespacho { get; set; }
    }


}

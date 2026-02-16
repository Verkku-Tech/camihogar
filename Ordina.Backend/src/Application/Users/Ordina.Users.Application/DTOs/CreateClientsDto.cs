using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ordina.Users.Application.DTOs
{
    public class CreateClientDto
    {
        [Required]
        [StringLength(200)]
        public string NombreRazonSocial { get; set; } = string.Empty;

        [StringLength(100)]
        public string? Apodo { get; set; }

        [Required]
        [StringLength(20)]
        public string RutId { get; set; } = string.Empty;

        [Required]
        [StringLength(500)]
        public string Direccion { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string Telefono { get; set; } = string.Empty;

        [StringLength(20)]
        public string? Telefono2 { get; set; }

        [EmailAddress]
        [StringLength(100)]
        public string? Email { get; set; }

        /// <summary>
        /// Tipo de cliente: "empresa" | "particular"
        /// </summary>
        [Required]
        [StringLength(20)]
        public string TipoCliente { get; set; } = string.Empty;

        /// <summary>
        /// Estado del cliente: "activo" | "inactivo"
        /// </summary>
        [Required]
        [StringLength(20)]
        public string Estado { get; set; } = "activo";

        public bool TieneNotasDespacho { get; set; }
    }


}

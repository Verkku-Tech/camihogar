using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ordina.Providers.Application.DTOs
{
    public class CreateProviderDto
    {
        [StringLength(20)]
        public string? Rif { get; set; }

        [Required]
        [StringLength(200)]
        public string Nombre { get; set; } = string.Empty;

        public string? RazonSocial { get; set; }

        [EmailAddress]
        [StringLength(100)]
        public string? Email { get; set; }

        [Required]
        [StringLength(20)]
        public string Telefono { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Direccion { get; set; }

        public string? Contacto { get; set; }

        public string? Tipo { get; set; }

        public string Estado { get; set; } = "Activo";

    }
}

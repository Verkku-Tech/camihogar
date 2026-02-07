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
        [Required]
        [StringLength(20)]
        public string Rif { get; set; } = string.Empty;

        [Required]
        [StringLength(200)]
        public string Nombre { get; set; } = string.Empty;

        [Required]
        public string RazonSocial { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(100)]
        public string Email { get; set; } = string.Empty;

        [StringLength(20)]
        [Required]
        public string Telefono { get; set; } = string.Empty;

        [StringLength(500)]
        [Required]
        public string Direccion { get; set; } = string.Empty;

        [Required]
        public string Contacto { get; set; } = string.Empty;

        [Required]
        public string Tipo { get; set; } = string.Empty;

        public string Estado { get; set; } = "Activo";

    }
}

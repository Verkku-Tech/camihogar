using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ordina.Providers.Application.DTOs
{
    public class UpdateProviderDto
    {
        
        [StringLength(20)]
        public string? Rif { get; set; }

        
        [StringLength(200)]
        public string? Nombre { get; set; }

        
        [EmailAddress]
        [StringLength(100)]
        public string? Email { get; set; }

        [StringLength(20)]
        public string? Telefono { get; set; }

        [StringLength(500)]
        public string? Direccion { get; set; }

        public string? Estado { get; set; }
        public string? RazonSocial { get; set; }
        public string? Contacto { get; set; }
        public string? Tipo { get; set; }
    }
}

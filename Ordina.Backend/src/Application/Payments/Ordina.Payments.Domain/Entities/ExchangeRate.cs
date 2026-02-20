using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Ordina.Payments.Domain.Entities
{
    [Table("ExchangeRates")]
    public class ExchangeRate
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(3)]
        public string FromCurrency { get; set; } = "Bs";

        [Required]
        [MaxLength(3)]
        public string ToCurrency { get; set; } // USD, EUR

        [Required]
        [Column(TypeName = "decimal(18,4)")]
        public decimal Rate { get; set; }

        public DateTime EffectiveDate { get; set; }

        public bool IsActive { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

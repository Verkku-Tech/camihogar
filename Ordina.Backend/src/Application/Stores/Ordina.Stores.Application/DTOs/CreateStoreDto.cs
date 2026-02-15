using System.ComponentModel.DataAnnotations;

namespace Ordina.Stores.Application.DTOs;

public class CreateStoreDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = null!;
    
    [Required]
    [StringLength(100)]
    public string Code { get; set; } = null!;
    
    [Required]
    [StringLength(500)]
    public string Address { get; set; } = null!;
    
    [Required]
    [StringLength(20)]
    public string Phone { get; set; } = null!;
    
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;
    
    [Required]
    [StringLength(20)]
    public string Rif { get; set; } = null!;
    
    public string Status { get; set; } = "active";
}
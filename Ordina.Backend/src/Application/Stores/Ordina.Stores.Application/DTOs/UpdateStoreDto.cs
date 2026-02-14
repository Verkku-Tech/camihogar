using System.ComponentModel.DataAnnotations;

namespace Ordina.Stores.Application.DTOs;

public class UpdateStoreDto
{
    [StringLength(200)]
    public string? Name { get; set; }
    
    [StringLength(100)]
    public string? Code { get; set; }
    
    [StringLength(500)]
    public string? Address { get; set; }
    
    [StringLength(20)]
    public string? Phone { get; set; }
    
    [EmailAddress]
    public string? Email { get; set; }
    
    [StringLength(20)]
    public string? Rif { get; set; }
    
    public string? Status { get; set; }
}
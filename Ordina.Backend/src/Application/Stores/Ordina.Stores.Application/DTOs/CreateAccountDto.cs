using System.ComponentModel.DataAnnotations;

namespace Ordina.Stores.Application.DTOs;

public class CreateAccountDto
{
    [Required]
    [StringLength(100)]
    public string Code { get; set; } = null!;
    
    [Required]
    [StringLength(200)]
    public string Label { get; set; } = null!;
    
    [Required]
    public string StoreId { get; set; } = null!;
    
    public bool IsForeign { get; set; }
    
    [Required]
    public string AccountType { get; set; } = null!;
    
    [EmailAddress]
    public string? Email { get; set; }
    
    public string? Wallet { get; set; }
    
    public bool IsActive { get; set; } = true;
}
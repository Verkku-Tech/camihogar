using System.ComponentModel.DataAnnotations;

namespace Ordina.Stores.Application.DTOs;

public class UpdateAccountDto
{
    [StringLength(100)]
    public string? Code { get; set; }
    
    [StringLength(200)]
    public string? Label { get; set; }
    
    public string? StoreId { get; set; }
    
    public bool? IsForeign { get; set; }
    
    public string? AccountType { get; set; }
    
    [EmailAddress]
    public string? Email { get; set; }
    
    public string? Wallet { get; set; }
    
    public bool? IsActive { get; set; }
}
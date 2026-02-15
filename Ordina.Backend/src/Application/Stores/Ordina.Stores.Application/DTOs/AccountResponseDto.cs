namespace Ordina.Stores.Application.DTOs;

public class AccountResponseDto
{
    public string Id { get; set; } = null!;
    public string Code { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string StoreId { get; set; } = null!;
    public bool IsForeign { get; set; }
    public string AccountType { get; set; } = null!;
    public string? Email { get; set; }
    public string? Wallet { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
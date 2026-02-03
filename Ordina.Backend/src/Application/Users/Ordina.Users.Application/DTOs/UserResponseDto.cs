namespace Ordina.Users.Application.DTOs;

public class UserResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? CreatedAt { get; set; }
    
    // Campos para comisiones
    public bool ExclusiveCommission { get; set; } = false;
    public decimal BaseSalary { get; set; } = 0;
    public string BaseSalaryCurrency { get; set; } = "USD";
}


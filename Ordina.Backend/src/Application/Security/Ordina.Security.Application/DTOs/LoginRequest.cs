namespace Ordina.Security.Application.DTOs;

public class LoginRequest
{
    public string Username { get; set; } = string.Empty; // Puede ser username o email
    public string Password { get; set; } = string.Empty;
    public bool RememberMe { get; set; } = false;
}


using System.ComponentModel.DataAnnotations;

namespace Ordina.Users.Application.DTOs;

public class UpdateUserDto
{
    [StringLength(100, MinimumLength = 3, ErrorMessage = "El nombre de usuario debe tener entre 3 y 100 caracteres")]
    public string? Username { get; set; }

    [EmailAddress(ErrorMessage = "El email no es válido")]
    [StringLength(255, ErrorMessage = "El email no puede exceder 255 caracteres")]
    public string? Email { get; set; }

    [StringLength(200, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 200 caracteres")]
    public string? Name { get; set; }

    [StringLength(50, ErrorMessage = "El rol no puede exceder 50 caracteres")]
    public string? Role { get; set; }

    [StringLength(20, ErrorMessage = "El estado no puede exceder 20 caracteres")]
    public string? Status { get; set; }

    [StringLength(500, ErrorMessage = "La contraseña no puede exceder 500 caracteres")]
    public string? Password { get; set; }
}


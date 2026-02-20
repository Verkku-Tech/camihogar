using System.ComponentModel.DataAnnotations;

namespace Ordina.Users.Application.DTOs;

public class CreateRoleDto
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Name { get; set; } = string.Empty;

    public List<string> Permissions { get; set; } = new();
}

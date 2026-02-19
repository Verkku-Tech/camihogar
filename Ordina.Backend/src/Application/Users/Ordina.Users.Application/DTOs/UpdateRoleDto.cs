using System.ComponentModel.DataAnnotations;

namespace Ordina.Users.Application.DTOs;

public class UpdateRoleDto
{
    [StringLength(50, MinimumLength = 3)]
    public string? Name { get; set; }

    public List<string>? Permissions { get; set; }
}

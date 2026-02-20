using Ordina.Users.Application.DTOs;

namespace Ordina.Users.Application.Services;

public interface IRoleService
{
    Task<IEnumerable<RoleResponseDto>> GetAllRolesAsync();
    Task<RoleResponseDto?> GetRoleByIdAsync(string id);
    Task<RoleResponseDto?> GetRoleByNameAsync(string name);
    Task<RoleResponseDto> CreateRoleAsync(CreateRoleDto createDto);
    Task<RoleResponseDto> UpdateRoleAsync(string id, UpdateRoleDto updateDto);
    Task<bool> DeleteRoleAsync(string id);
    Task<bool> RoleExistsAsync(string id);
}

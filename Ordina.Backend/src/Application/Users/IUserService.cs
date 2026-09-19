using Ordina.Application.Common;
using Ordina.Domain.Users;

namespace Ordina.Application.Users;

public interface IUserService
{
    Task<IReadOnlyList<UserResponseDto>> GetAllUsersAsync(string? status = null, CancellationToken cancellationToken = default);
    Task<PagedResult<UserResponseDto>> GetPagedUsersAsync(PagedRequest request, CancellationToken cancellationToken = default);
    Task<UserResponseDto?> GetUserByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<UserResponseDto?> GetUserByUsernameAsync(string username, CancellationToken cancellationToken = default);
    Task<UserResponseDto?> GetUserByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<UserResponseDto> CreateUserAsync(CreateUserDto createDto, CancellationToken cancellationToken = default);
    Task<UserResponseDto> UpdateUserAsync(string id, UpdateUserDto updateDto, CancellationToken cancellationToken = default);
    Task<RegeneratePasswordResponseDto> RegeneratePasswordAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> DeleteUserAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> UserExistsAsync(string id, CancellationToken cancellationToken = default);
    IReadOnlyList<AssignableUserPermissions.AssignablePermission> GetAssignablePermissions();
}

public interface IRoleService
{
    Task<IReadOnlyList<RoleResponseDto>> GetAllRolesAsync(CancellationToken cancellationToken = default);
    Task<RoleResponseDto?> GetRoleByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<RoleResponseDto?> GetRoleByNameAsync(string name, CancellationToken cancellationToken = default);
    Task<RoleResponseDto> CreateRoleAsync(CreateRoleDto createDto, CancellationToken cancellationToken = default);
    Task<RoleResponseDto> UpdateRoleAsync(string id, UpdateRoleDto updateDto, CancellationToken cancellationToken = default);
    Task<bool> DeleteRoleAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> RoleExistsAsync(string id, CancellationToken cancellationToken = default);
}

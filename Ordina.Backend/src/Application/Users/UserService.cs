using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Application.Security;
using Ordina.Domain.Enums;
using Ordina.Domain.Security;
using Ordina.Domain.Users;

namespace Ordina.Application.Users;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IRepository<Role> _roleRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<UserService> _logger;

    public UserService(
        IUserRepository userRepository,
        IRepository<Role> roleRepository,
        IPasswordHasher passwordHasher,
        ILogger<UserService> logger)
    {
        _userRepository = userRepository;
        _roleRepository = roleRepository;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    public async Task<IReadOnlyList<UserResponseDto>> GetAllUsersAsync(string? status = null, CancellationToken cancellationToken = default)
    {
        var users = await _userRepository.GetAllAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(status))
        {
            users = users.Where(u => string.Equals(u.StatusString, status, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return users.Select(MapToResponse).ToList();
    }

    public async Task<PagedResult<UserResponseDto>> GetPagedUsersAsync(PagedRequest request, CancellationToken cancellationToken = default)
    {
        var result = await _userRepository.GetPagedAsync(
            request.Page,
            request.PageSize,
            string.IsNullOrWhiteSpace(request.SearchTerm) ? null : u => u.Name.Contains(request.SearchTerm) || u.Username.Contains(request.SearchTerm) || u.Email.Contains(request.SearchTerm),
            cancellationToken);

        return new PagedResult<UserResponseDto>(
            result.Items.Select(MapToResponse).ToList(),
            result.TotalCount,
            result.Page,
            result.PageSize);
    }

    public async Task<UserResponseDto?> GetUserByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        return user != null ? MapToResponse(user) : null;
    }

    public async Task<UserResponseDto?> GetUserByUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByUsernameAsync(username, cancellationToken);
        return user != null ? MapToResponse(user) : null;
    }

    public async Task<UserResponseDto?> GetUserByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByEmailAsync(email, cancellationToken);
        return user != null ? MapToResponse(user) : null;
    }

    public async Task<UserResponseDto> CreateUserAsync(CreateUserDto createDto, CancellationToken cancellationToken = default)
    {
        var existingUser = await _userRepository.GetByUsernameAsync(createDto.Username, cancellationToken);
        if (existingUser != null)
        {
            throw new InvalidOperationException($"El nombre de usuario '{createDto.Username}' ya está en uso");
        }

        var existingEmail = await _userRepository.GetByEmailAsync(createDto.Email, cancellationToken);
        if (existingEmail != null)
        {
            throw new InvalidOperationException($"El correo electrónico '{createDto.Email}' ya está registrado");
        }

        var password = string.IsNullOrWhiteSpace(createDto.Password) ? "Temporal123!" : createDto.Password;
        var normalizedPermissions = AssignableUserPermissions.Normalize(createDto.ExtraPermissions);

        var user = new User
        {
            Username = createDto.Username.Trim(),
            Email = createDto.Email.Trim().ToLowerInvariant(),
            Name = createDto.Name.Trim(),
            RoleString = createDto.Role,
            StatusString = createDto.Status,
            PasswordHash = _passwordHasher.HashPassword(password),
            StoreId = string.IsNullOrWhiteSpace(createDto.StoreId) ? null : createDto.StoreId.Trim(),
            StoreName = string.IsNullOrWhiteSpace(createDto.StoreId) ? null : createDto.StoreName,
            BaseSalary = createDto.BaseSalary,
            BaseSalaryCurrency = createDto.BaseSalaryCurrency,
            CommissionExclusivityModeStored = createDto.CommissionExclusivityMode,
            ExtraPermissions = normalizedPermissions,
            AvatarUrl = createDto.AvatarUrl,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        user.NormalizeCommissionExclusivity();
        var created = await _userRepository.AddAsync(user, cancellationToken);

        _logger.LogInformation("Usuario creado: {UserId} ({Username})", created.Id, created.Username);
        return MapToResponse(created);
    }

    public async Task<UserResponseDto> UpdateUserAsync(string id, UpdateUserDto updateDto, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Usuario no encontrado: {id}");

        if (!string.IsNullOrWhiteSpace(updateDto.Name)) user.Name = updateDto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.Email))
        {
            var newEmail = updateDto.Email.Trim().ToLowerInvariant();
            if (newEmail != user.Email)
            {
                var existingEmail = await _userRepository.GetByEmailAsync(newEmail, cancellationToken);
                if (existingEmail != null && existingEmail.Id != id)
                    throw new InvalidOperationException($"El email '{newEmail}' ya está registrado");
                user.Email = newEmail;
            }
        }
        if (!string.IsNullOrWhiteSpace(updateDto.Role)) user.RoleString = updateDto.Role;
        if (!string.IsNullOrWhiteSpace(updateDto.Status)) user.StatusString = updateDto.Status;
        if (updateDto.StoreId != null)
        {
            user.StoreId = string.IsNullOrWhiteSpace(updateDto.StoreId) ? null : updateDto.StoreId.Trim();
            if (user.StoreId == null) user.StoreName = null;
        }
        if (updateDto.StoreName != null) user.StoreName = updateDto.StoreName;
        if (updateDto.BaseSalary.HasValue) user.BaseSalary = updateDto.BaseSalary.Value;
        if (!string.IsNullOrWhiteSpace(updateDto.BaseSalaryCurrency)) user.BaseSalaryCurrency = updateDto.BaseSalaryCurrency;
        if (!string.IsNullOrWhiteSpace(updateDto.CommissionExclusivityMode)) user.CommissionExclusivityModeStored = updateDto.CommissionExclusivityMode;
        if (updateDto.ExtraPermissions != null)
        {
            user.ExtraPermissions = AssignableUserPermissions.Normalize(updateDto.ExtraPermissions);
        }
        if (updateDto.AvatarUrl != null)
        {
            user.AvatarUrl = string.IsNullOrWhiteSpace(updateDto.AvatarUrl) ? null : updateDto.AvatarUrl;
        }

        user.NormalizeCommissionExclusivity();
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user, cancellationToken);
        return MapToResponse(user);
    }

    public async Task<RegeneratePasswordResponseDto> RegeneratePasswordAsync(string id, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Usuario no encontrado: {id}");

        var tempPassword = Guid.NewGuid().ToString("N")[..8] + "A1!";
        user.PasswordHash = _passwordHasher.HashPassword(tempPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepository.UpdateAsync(user, cancellationToken);

        _logger.LogInformation("Contraseña regenerada para usuario {UserId}", id);
        return new RegeneratePasswordResponseDto(tempPassword);
    }

    public async Task<bool> DeleteUserAsync(string id, CancellationToken cancellationToken = default)
    {
        return await _userRepository.DeleteAsync(id, cancellationToken);
    }

    public async Task<bool> UserExistsAsync(string id, CancellationToken cancellationToken = default)
    {
        return await _userRepository.ExistsAsync(id, cancellationToken);
    }

    public IReadOnlyList<AssignableUserPermissions.AssignablePermission> GetAssignablePermissions()
    {
        return AssignableUserPermissions.GetAll();
    }

    private static UserResponseDto MapToResponse(User user) => new(
        user.Id,
        user.Username,
        user.Email,
        user.Name,
        user.RoleString,
        user.StatusString,
        user.CreatedAt,
        user.CommissionExclusivityMode,
        user.BaseSalary,
        user.BaseSalaryCurrency,
        user.StoreId,
        user.StoreName,
        user.ExtraPermissions,
        user.AvatarUrl);
}

public class RoleService : IRoleService
{
    private readonly IRepository<Role> _roleRepository;
    private readonly ILogger<RoleService> _logger;

    public RoleService(IRepository<Role> roleRepository, ILogger<RoleService> logger)
    {
        _roleRepository = roleRepository;
        _logger = logger;
    }

    public async Task<IReadOnlyList<RoleResponseDto>> GetAllRolesAsync(CancellationToken cancellationToken = default)
    {
        var roles = await _roleRepository.GetAllAsync(cancellationToken);
        return roles.Select(MapToResponse).ToList();
    }

    public async Task<RoleResponseDto?> GetRoleByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var role = await _roleRepository.GetByIdAsync(id, cancellationToken);
        return role != null ? MapToResponse(role) : null;
    }

    public async Task<RoleResponseDto?> GetRoleByNameAsync(string name, CancellationToken cancellationToken = default)
    {
        var roles = await _roleRepository.FindAsync(r => r.Name == name, cancellationToken);
        var role = roles.FirstOrDefault();
        return role != null ? MapToResponse(role) : null;
    }

    public async Task<RoleResponseDto> CreateRoleAsync(CreateRoleDto createDto, CancellationToken cancellationToken = default)
    {
        var existing = await _roleRepository.FindAsync(r => r.Name == createDto.Name, cancellationToken);
        if (existing.Count > 0)
        {
            throw new InvalidOperationException($"El rol '{createDto.Name}' ya existe");
        }

        var role = new Role
        {
            Name = createDto.Name.Trim(),
            Description = createDto.Description,
            Permissions = createDto.Permissions.ToList(),
            IsSystem = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _roleRepository.AddAsync(role, cancellationToken);
        return MapToResponse(created);
    }

    public async Task<RoleResponseDto> UpdateRoleAsync(string id, UpdateRoleDto updateDto, CancellationToken cancellationToken = default)
    {
        var role = await _roleRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Rol no encontrado: {id}");

        if (updateDto.Description != null) role.Description = updateDto.Description;
        if (updateDto.Permissions != null) role.Permissions = updateDto.Permissions.ToList();

        role.UpdatedAt = DateTime.UtcNow;
        await _roleRepository.UpdateAsync(role, cancellationToken);
        return MapToResponse(role);
    }

    public async Task<bool> DeleteRoleAsync(string id, CancellationToken cancellationToken = default)
    {
        var role = await _roleRepository.GetByIdAsync(id, cancellationToken);
        if (role == null) return false;
        if (role.IsSystem) throw new InvalidOperationException("No se puede eliminar un rol del sistema");
        return await _roleRepository.DeleteAsync(id, cancellationToken);
    }

    public async Task<bool> RoleExistsAsync(string id, CancellationToken cancellationToken = default)
    {
        return await _roleRepository.ExistsAsync(id, cancellationToken);
    }

    private static RoleResponseDto MapToResponse(Role role) => new(
        role.Id,
        role.Name,
        role.Description,
        role.Permissions,
        role.IsSystem,
        role.CreatedAt,
        role.UpdatedAt);
}

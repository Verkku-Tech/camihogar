using Microsoft.Extensions.Logging;
using Ordina.Database.Entities.User;
using Ordina.Database.Repositories;
using Ordina.Users.Application.DTOs;
using Ordina.Users.Domain.Constants;
using System.Security.Cryptography;
using System.Text;

namespace Ordina.Users.Application.Services;

public class UserService : IUserService
{
    private const string StoreSellerRole = "Store Seller";

    private readonly IUserRepository _userRepository;
    private readonly IStoreRepository _storeRepository;
    private readonly IRoleRepository _roleRepository;
    private readonly ILogger<UserService> _logger;

    public UserService(
        IUserRepository userRepository,
        IStoreRepository storeRepository,
        IRoleRepository roleRepository,
        ILogger<UserService> logger)
    {
        _userRepository = userRepository;
        _storeRepository = storeRepository;
        _roleRepository = roleRepository;
        _logger = logger;
    }

    public async Task<IEnumerable<UserResponseDto>> GetAllUsersAsync(string? status = null)
    {
        try
        {
            IEnumerable<User> users;

            if (!string.IsNullOrWhiteSpace(status))
            {
                users = await _userRepository.GetByStatusAsync(status);
            }
            else
            {
                users = await _userRepository.GetAllAsync();
            }

            return users.Select(MapToDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuarios");
            throw;
        }
    }

    public async Task<UserResponseDto?> GetUserByIdAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del usuario es requerido", nameof(id));
            }

            var user = await _userRepository.GetByIdAsync(id);
            return user == null ? null : MapToDto(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuario con ID {UserId}", id);
            throw;
        }
    }

    public async Task<UserResponseDto?> GetUserByUsernameAsync(string username)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(username))
            {
                throw new ArgumentException("El nombre de usuario es requerido", nameof(username));
            }

            var user = await _userRepository.GetByUsernameAsync(username);
            return user == null ? null : MapToDto(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuario con username {Username}", username);
            throw;
        }
    }

    public async Task<UserResponseDto?> GetUserByEmailAsync(string email)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                throw new ArgumentException("El email es requerido", nameof(email));
            }

            var user = await _userRepository.GetByEmailAsync(email);
            return user == null ? null : MapToDto(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuario con email {Email}", email);
            throw;
        }
    }

    public async Task<UserResponseDto> CreateUserAsync(CreateUserDto createDto)
    {
        try
        {
            // Verificar si el username ya existe
            var existingUserByUsername = await _userRepository.GetByUsernameAsync(createDto.Username);
            if (existingUserByUsername != null)
            {
                throw new InvalidOperationException($"Ya existe un usuario con el nombre de usuario '{createDto.Username}'");
            }

            // Verificar si el email ya existe
            var existingUserByEmail = await _userRepository.GetByEmailAsync(createDto.Email);
            if (existingUserByEmail != null)
            {
                throw new InvalidOperationException($"Ya existe un usuario con el email '{createDto.Email}'");
            }

            var normalizedRole = NormalizeUserRole(createDto.Role);
            var (storeId, storeName) = await ValidateAndResolveStoreAsync(createDto.StoreId, normalizedRole);
            var extraPermissions = await ResolveExtraPermissionsForRoleAsync(
                normalizedRole,
                createDto.ExtraPermissions);

            var user = new User
            {
                Username = createDto.Username,
                Email = createDto.Email,
                Name = createDto.Name,
                Role = normalizedRole,
                Status = createDto.Status ?? "active",
                CreatedAt = DateTime.UtcNow,
                StoreId = storeId,
                StoreName = storeName,
                ExtraPermissions = extraPermissions,
            };

            // Hashear la contraseña antes de guardarla
            if (!string.IsNullOrWhiteSpace(createDto.Password))
            {
                user.PasswordHash = HashPassword(createDto.Password);
            }

            var createdUser = await _userRepository.CreateAsync(user);
            return MapToDto(createdUser);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear usuario");
            throw;
        }
    }

    public async Task<UserResponseDto> UpdateUserAsync(string id, UpdateUserDto updateDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del usuario es requerido", nameof(id));
            }

            var existingUser = await _userRepository.GetByIdAsync(id);
            if (existingUser == null)
            {
                throw new KeyNotFoundException($"Usuario con ID {id} no encontrado");
            }

            // Verificar si el nuevo username ya existe (si se está cambiando)
            if (!string.IsNullOrWhiteSpace(updateDto.Username) && updateDto.Username != existingUser.Username)
            {
                var userWithUsername = await _userRepository.GetByUsernameAsync(updateDto.Username);
                if (userWithUsername != null && userWithUsername.Id != id)
                {
                    throw new InvalidOperationException($"Ya existe un usuario con el nombre de usuario '{updateDto.Username}'");
                }
            }

            // Verificar si el nuevo email ya existe (si se está cambiando)
            if (!string.IsNullOrWhiteSpace(updateDto.Email) && updateDto.Email != existingUser.Email)
            {
                var userWithEmail = await _userRepository.GetByEmailAsync(updateDto.Email);
                if (userWithEmail != null && userWithEmail.Id != id)
                {
                    throw new InvalidOperationException($"Ya existe un usuario con el email '{updateDto.Email}'");
                }
            }

            // Actualizar solo los campos proporcionados
            if (!string.IsNullOrWhiteSpace(updateDto.Username))
                existingUser.Username = updateDto.Username;

            if (!string.IsNullOrWhiteSpace(updateDto.Email))
                existingUser.Email = updateDto.Email;

            if (!string.IsNullOrWhiteSpace(updateDto.Name))
                existingUser.Name = updateDto.Name;

            if (!string.IsNullOrWhiteSpace(updateDto.Role))
                existingUser.Role = NormalizeUserRole(updateDto.Role);

            if (!string.IsNullOrWhiteSpace(updateDto.Status))
                existingUser.Status = updateDto.Status;

            // Actualizar campos de comisiones
            if (!string.IsNullOrWhiteSpace(updateDto.CommissionExclusivityMode))
            {
                if (!CommissionExclusivityModes.IsValid(updateDto.CommissionExclusivityMode))
                {
                    throw new ArgumentException(
                        $"Modo de exclusividad inválido: {updateDto.CommissionExclusivityMode}");
                }

                existingUser.CommissionExclusivityMode = updateDto.CommissionExclusivityMode.Trim();
            }
            else if (updateDto.ExclusiveCommission.HasValue)
            {
                existingUser.CommissionExclusivityMode = updateDto.ExclusiveCommission.Value
                    ? CommissionExclusivityModes.Exclusive
                    : CommissionExclusivityModes.Shared;
            }

            existingUser.NormalizeCommissionExclusivity();

            if (updateDto.BaseSalary.HasValue)
                existingUser.BaseSalary = updateDto.BaseSalary.Value;

            if (!string.IsNullOrWhiteSpace(updateDto.BaseSalaryCurrency))
                existingUser.BaseSalaryCurrency = updateDto.BaseSalaryCurrency;

            var effectiveRole = !string.IsNullOrWhiteSpace(updateDto.Role)
                ? NormalizeUserRole(updateDto.Role)
                : existingUser.Role;

            if (updateDto.StoreId != null)
            {
                var (storeId, storeName) = await ValidateAndResolveStoreAsync(
                    string.IsNullOrWhiteSpace(updateDto.StoreId) ? null : updateDto.StoreId.Trim(),
                    effectiveRole);
                existingUser.StoreId = storeId;
                existingUser.StoreName = storeName;
            }
            else if (!string.IsNullOrWhiteSpace(updateDto.Role))
            {
                if (IsStoreSellerRole(effectiveRole))
                {
                    var (storeId, storeName) = await ValidateAndResolveStoreAsync(
                        existingUser.StoreId,
                        effectiveRole);
                    existingUser.StoreId = storeId;
                    existingUser.StoreName = storeName;
                }
                else
                {
                    existingUser.StoreId = null;
                    existingUser.StoreName = null;
                }
            }
            else if (IsStoreSellerRole(effectiveRole))
            {
                var (storeId, storeName) = await ValidateAndResolveStoreAsync(
                    existingUser.StoreId,
                    effectiveRole);
                existingUser.StoreId = storeId;
                existingUser.StoreName = storeName;
            }

            if (updateDto.ExtraPermissions != null)
            {
                existingUser.ExtraPermissions = await ResolveExtraPermissionsForRoleAsync(
                    effectiveRole,
                    updateDto.ExtraPermissions);
            }

            var updatedUser = await _userRepository.UpdateAsync(existingUser);
            return MapToDto(updatedUser);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar usuario con ID {UserId}", id);
            throw;
        }
    }

    public async Task<RegeneratePasswordResponseDto> RegeneratePasswordAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("El ID del usuario es requerido", nameof(id));
        }

        var existingUser = await _userRepository.GetByIdAsync(id);
        if (existingUser == null)
        {
            throw new KeyNotFoundException($"Usuario con ID {id} no encontrado");
        }

        var temporaryPassword = GenerateTemporaryPassword();
        existingUser.PasswordHash = HashPassword(temporaryPassword);
        await _userRepository.UpdateAsync(existingUser);

        return new RegeneratePasswordResponseDto { TemporaryPassword = temporaryPassword };
    }

    public async Task<bool> DeleteUserAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del usuario es requerido", nameof(id));
            }

            var exists = await _userRepository.ExistsAsync(id);
            if (!exists)
            {
                return false;
            }

            return await _userRepository.DeleteAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar usuario con ID {UserId}", id);
            throw;
        }
    }

    public async Task<bool> UserExistsAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del usuario es requerido", nameof(id));
            }

            return await _userRepository.ExistsAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del usuario con ID {UserId}", id);
            throw;
        }
    }

    /// <summary>
    /// Normaliza variantes de rol a la forma canónica usada en Mongo y JWT.
    /// </summary>
    private static string NormalizeUserRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
            return role;

        var trimmed = role.Trim();
        if (string.Equals(trimmed, "Online Seller", StringComparison.Ordinal)
            || string.Equals(trimmed, "Vendedor Online", StringComparison.OrdinalIgnoreCase))
            return "Online Seller";

        if (string.Equals(trimmed, "Store Seller", StringComparison.Ordinal)
            || string.Equals(trimmed, "Vendedor de tienda", StringComparison.OrdinalIgnoreCase)
            || string.Equals(trimmed, "Vendedor de Tienda", StringComparison.OrdinalIgnoreCase))
            return "Store Seller";

        return trimmed;
    }

    private static bool IsStoreSellerRole(string role) =>
        string.Equals(NormalizeUserRole(role), StoreSellerRole, StringComparison.Ordinal);

    private async Task<(string? StoreId, string? StoreName)> ValidateAndResolveStoreAsync(
        string? storeId,
        string role)
    {
        var normalizedRole = NormalizeUserRole(role);
        var trimmedStoreId = string.IsNullOrWhiteSpace(storeId) ? null : storeId.Trim();

        if (IsStoreSellerRole(normalizedRole) && trimmedStoreId == null)
        {
            throw new ArgumentException("La tienda es obligatoria para vendedores de tienda");
        }

        if (trimmedStoreId == null)
        {
            return (null, null);
        }

        var store = await _storeRepository.GetByIdAsync(trimmedStoreId);
        if (store == null)
        {
            throw new ArgumentException($"No existe una tienda con ID '{trimmedStoreId}'");
        }

        if (!string.Equals(store.Status, "active", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException($"La tienda '{store.Name}' no está activa");
        }

        return (store.Id, store.Name);
    }

    public IReadOnlyList<AssignablePermissionDto> GetAssignablePermissions()
    {
        return AssignableUserPermissions.GetAll()
            .Select(p => new AssignablePermissionDto { Id = p.Id, Label = p.Label })
            .ToList();
    }

    private async Task<List<string>> ResolveExtraPermissionsForRoleAsync(
        string roleName,
        IEnumerable<string>? requested)
    {
        var normalized = AssignableUserPermissions.Normalize(requested);
        if (normalized.Contains(Permissions.Dispatch.ConfirmDelivery, StringComparer.Ordinal)
            && !string.Equals(roleName, "Supervisor", StringComparison.Ordinal))
        {
            throw new ArgumentException(
                "El permiso Confirmar entrega solo puede asignarse a usuarios con rol Supervisor.");
        }

        var rolePermissions = await GetRolePermissionsAsync(roleName);
        return AssignableUserPermissions.SubtractRolePermissions(normalized, rolePermissions);
    }

    private async Task<List<string>> GetRolePermissionsAsync(string roleName)
    {
        if (string.IsNullOrWhiteSpace(roleName)) return [];
        var role = await _roleRepository.GetByNameAsync(roleName);
        return role?.Permissions ?? [];
    }

    private static UserResponseDto MapToDto(User user)
    {
        user.NormalizeCommissionExclusivity();

        return new UserResponseDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Name = user.Name,
            Role = user.Role,
            Status = user.Status,
            CreatedAt = user.CreatedAt,
            CommissionExclusivityMode = user.CommissionExclusivityMode,
            ExclusiveCommission = user.ExclusiveCommission,
            BaseSalary = user.BaseSalary,
            BaseSalaryCurrency = user.BaseSalaryCurrency,
            StoreId = user.StoreId,
            StoreName = user.StoreName,
            ExtraPermissions = user.ExtraPermissions ?? [],
        };
    }

    private static string GenerateTemporaryPassword(int length = 16)
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        var data = new byte[length];
        RandomNumberGenerator.Fill(data);
        var result = new char[length];
        for (var i = 0; i < length; i++)
        {
            result[i] = chars[data[i] % chars.Length];
        }

        return new string(result);
    }

    /// <summary>
    /// Hashea una contraseña usando SHA256 (igual que AuthService para mantener consistencia)
    /// </summary>
    private static string HashPassword(string password)
    {
        // Implementación con SHA256 para desarrollo
        // En producción, deberías usar BCrypt.Net.BCrypt.HashPassword(password)
        
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        var hashedPassword = BitConverter.ToString(hashedBytes).Replace("-", "").ToLowerInvariant();
        
        return hashedPassword;
    }
}


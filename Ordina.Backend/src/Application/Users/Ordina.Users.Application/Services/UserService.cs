using Microsoft.Extensions.Logging;
using Ordina.Database.Entities.User;
using Ordina.Database.Repositories;
using Ordina.Users.Application.DTOs;
using System.Security.Cryptography;
using System.Text;

namespace Ordina.Users.Application.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository userRepository, ILogger<UserService> logger)
    {
        _userRepository = userRepository;
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

            var user = new User
            {
                Username = createDto.Username,
                Email = createDto.Email,
                Name = createDto.Name,
                Role = createDto.Role,
                Status = createDto.Status ?? "active",
                CreatedAt = DateTime.UtcNow
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
                existingUser.Role = updateDto.Role;

            if (!string.IsNullOrWhiteSpace(updateDto.Status))
                existingUser.Status = updateDto.Status;

            // Hashear la contraseña antes de guardarla
            if (!string.IsNullOrWhiteSpace(updateDto.Password))
            {
                existingUser.PasswordHash = HashPassword(updateDto.Password);
            }

            // Actualizar campos de comisiones
            if (updateDto.ExclusiveCommission.HasValue)
                existingUser.ExclusiveCommission = updateDto.ExclusiveCommission.Value;

            if (updateDto.BaseSalary.HasValue)
                existingUser.BaseSalary = updateDto.BaseSalary.Value;

            if (!string.IsNullOrWhiteSpace(updateDto.BaseSalaryCurrency))
                existingUser.BaseSalaryCurrency = updateDto.BaseSalaryCurrency;

            var updatedUser = await _userRepository.UpdateAsync(existingUser);
            return MapToDto(updatedUser);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar usuario con ID {UserId}", id);
            throw;
        }
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

    private static UserResponseDto MapToDto(User user)
    {
        return new UserResponseDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Name = user.Name,
            Role = user.Role,
            Status = user.Status,
            CreatedAt = user.CreatedAt,
            ExclusiveCommission = user.ExclusiveCommission,
            BaseSalary = user.BaseSalary,
            BaseSalaryCurrency = user.BaseSalaryCurrency
        };
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


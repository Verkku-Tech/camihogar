using Microsoft.Extensions.Configuration;
using Ordina.Security.Application.DTOs;
using Ordina.Database.Entities.User;
using Ordina.Database.Entities.RefreshToken;
using Ordina.Database.Repositories;
using System.Security.Cryptography;
using System.Text;

namespace Ordina.Security.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly ITokenService _tokenService;
    private readonly IConfiguration _configuration;
    private readonly IRoleRepository _roleRepository;

    public AuthService(
        IUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        ITokenService tokenService,
        IConfiguration configuration,
        IRoleRepository roleRepository)
    {
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _tokenService = tokenService;
        _configuration = configuration;
        _roleRepository = roleRepository;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        // Buscar usuario por username o email
        var user = await _userRepository.GetByUsernameOrEmailAsync(request.Username);

        if (user == null)
        {
            throw new UnauthorizedAccessException("Usuario o contraseña incorrectos");
        }

        // Verificar que el usuario esté activo
        if (user.Status != "active")
        {
            throw new UnauthorizedAccessException("Tu cuenta está desactivada. Contacta al administrador.");
        }

        // Verificar contraseña
        if (string.IsNullOrEmpty(user.PasswordHash) || !VerifyPassword(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Usuario o contraseña incorrectos");
        }

        // Obtener permisos del rol
        var permissions = new List<string>();
        if (!string.IsNullOrEmpty(user.Role))
        {
            var role = await _roleRepository.GetByNameAsync(user.Role);
            if (role != null)
            {
                permissions = role.Permissions;
            }
        }

        // Generar tokens (el rol ya viene en la entidad MongoDB User.Role)
        var token = _tokenService.GenerateToken(user, permissions);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();

        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryInMinutes"] ?? "480");
        var refreshTokenExpiresAt = DateTime.UtcNow.AddDays(30); // Refresh token válido por 30 días

        // Guardar refresh token en MongoDB
        var refreshTokenEntity = new RefreshToken
        {
            Token = refreshTokenValue,
            UserId = user.Id,
            ExpiresAt = refreshTokenExpiresAt,
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };
        await _refreshTokenRepository.CreateAsync(refreshTokenEntity);

        var response = new LoginResponse
        {
            Token = token,
            RefreshToken = refreshTokenValue,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes),
            RefreshTokenExpiresAt = refreshTokenExpiresAt,
            User = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role ?? "Sin rol asignado",
                Name = user.Name,
                Status = user.Status,
                Permissions = permissions
            }
        };

        return response;
    }

    public async Task<RefreshTokenResponse> RefreshTokenAsync(string refreshToken)
    {
        // Buscar refresh token en MongoDB
        var storedToken = await _refreshTokenRepository.GetByTokenAsync(refreshToken);

        if (storedToken == null || storedToken.IsRevoked || storedToken.ExpiresAt < DateTime.UtcNow)
        {
            throw new UnauthorizedAccessException("Refresh token inválido o expirado");
        }

        // Obtener usuario
        var user = await _userRepository.GetByIdAsync(storedToken.UserId);
        if (user == null || user.Status != "active")
        {
            throw new UnauthorizedAccessException("Usuario no encontrado o inactivo");
        }

        // Revocar token anterior
        storedToken.IsRevoked = true;
        await _refreshTokenRepository.UpdateAsync(storedToken);

        // Obtener permisos del rol
        var permissions = new List<string>();
        if (!string.IsNullOrEmpty(user.Role))
        {
            var role = await _roleRepository.GetByNameAsync(user.Role);
            if (role != null)
            {
                permissions = role.Permissions;
            }
        }

        // Generar nuevos tokens
        var newToken = _tokenService.GenerateToken(user, permissions);
        var newRefreshTokenValue = _tokenService.GenerateRefreshToken();

        // Guardar nuevo refresh token
        var refreshTokenExpiresAt = DateTime.UtcNow.AddDays(30);
        var newStoredToken = new RefreshToken
        {
            Token = newRefreshTokenValue,
            UserId = user.Id,
            ExpiresAt = refreshTokenExpiresAt,
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };
        await _refreshTokenRepository.CreateAsync(newStoredToken);

        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryInMinutes"] ?? "480");
        return new RefreshTokenResponse
        {
            Token = newToken,
            RefreshToken = newRefreshTokenValue,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes),
            RefreshTokenExpiresAt = refreshTokenExpiresAt
        };
    }

    private bool VerifyPassword(string password, string passwordHash)
    {
        // Implementación con SHA256 para desarrollo
        // En producción, deberías usar BCrypt.Net.BCrypt.Verify(password, passwordHash)
        
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        var hashedPassword = BitConverter.ToString(hashedBytes).Replace("-", "").ToLowerInvariant();
        
        return passwordHash.Equals(hashedPassword, StringComparison.OrdinalIgnoreCase);
    }
}

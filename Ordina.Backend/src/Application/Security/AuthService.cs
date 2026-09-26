using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Domain.Enums;
using Ordina.Domain.Security;
using Ordina.Domain.Users;

namespace Ordina.Application.Security;

public class AuthService : IAuthService
{
    private const int AccessTokenExpirationMinutes = 60;
    private const int RefreshTokenExpirationDays = 30;

    private readonly IUserRepository _userRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IRepository<Role> _roleRepository;
    private readonly ITokenService _tokenService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IRepository<Role> roleRepository,
        ITokenService tokenService,
        IPasswordHasher passwordHasher,
        ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _roleRepository = roleRepository;
        _tokenService = tokenService;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    private async Task<List<string>> GetUserPermissionsAsync(User user, CancellationToken cancellationToken)
    {
        var rolePermissions = new List<string>();
        if (!string.IsNullOrEmpty(user.RoleString))
        {
            var roles = await _roleRepository.FindAsync(r => r.Name == user.RoleString, cancellationToken);
            var role = roles?.FirstOrDefault();
            if (role != null)
            {
                rolePermissions = role.Permissions ?? new List<string>();
            }
        }
        return UserPermissionResolver.Merge(rolePermissions, user.ExtraPermissions);
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        using var scope = _logger.BeginScope(new Dictionary<string, object>
        {
            ["Username"] = request.Username,
            ["Module"] = "Security"
        });

        var user = await _userRepository.GetByUsernameAsync(request.Username, cancellationToken)
                   ?? await _userRepository.GetByEmailAsync(request.Username, cancellationToken);

        if (user == null)
        {
            _logger.LogWarning("Intento de login fallido para usuario: {Username}", request.Username);
            throw new UnauthorizedAccessException("Usuario o contraseña incorrectos");
        }

        if (user.Status != UserStatus.Active)
        {
            _logger.LogWarning("Intento de login con cuenta inactiva: {UserId}", user.Id);
            throw new UnauthorizedAccessException("Tu cuenta está desactivada. Contacta al administrador.");
        }

        if (string.IsNullOrEmpty(user.PasswordHash) || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Contraseña incorrecta para usuario: {UserId}", user.Id);
            throw new UnauthorizedAccessException("Usuario o contraseña incorrectos");
        }

        var permissions = await GetUserPermissionsAsync(user, cancellationToken);
        var token = _tokenService.GenerateToken(user, permissions);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();

        var expiresAt = DateTime.UtcNow.AddMinutes(AccessTokenExpirationMinutes);
        var refreshTokenExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpirationDays);

        var refreshTokenEntity = new RefreshToken
        {
            Token = refreshTokenValue,
            UserId = user.Id,
            ExpiresAt = refreshTokenExpiresAt,
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };
        await _refreshTokenRepository.AddAsync(refreshTokenEntity, cancellationToken);

        _logger.LogInformation("Usuario autenticado exitosamente: {UserId}", user.Id);

        return new LoginResponse(
            token,
            refreshTokenValue,
            expiresAt,
            refreshTokenExpiresAt,
            new UserDto(
                user.Id,
                user.Username,
                user.Email,
                user.RoleString,
                user.Name,
                user.StatusString,
                permissions,
                user.StoreId,
                user.StoreName,
                user.AvatarUrl));
    }

    public async Task<RefreshTokenResponse> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var storedToken = await _refreshTokenRepository.GetByTokenAsync(refreshToken, cancellationToken);

        // Grace period for concurrent requests if already rotated
        if (storedToken != null && storedToken.IsRevoked && !string.IsNullOrEmpty(storedToken.ReplacedByToken))
        {
            var tokenAge = DateTime.UtcNow - (storedToken.UpdatedAt ?? storedToken.CreatedAt);
            if (tokenAge.TotalSeconds <= 60)
            {
                var replacement = await _refreshTokenRepository.GetByTokenAsync(storedToken.ReplacedByToken, cancellationToken);
                if (replacement != null && !replacement.IsRevoked && replacement.ExpiresAt > DateTime.UtcNow)
                {
                    var repUser = await _userRepository.GetByIdAsync(replacement.UserId, cancellationToken);
                    if (repUser != null && repUser.Status == UserStatus.Active)
                    {
                        var repPerms = await GetUserPermissionsAsync(repUser, cancellationToken);
                        var repToken = _tokenService.GenerateToken(repUser, repPerms);
                        var repExpiresAt = DateTime.UtcNow.AddMinutes(AccessTokenExpirationMinutes);
                        return new RefreshTokenResponse(repToken, replacement.Token, repExpiresAt, replacement.ExpiresAt);
                    }
                }
            }
        }

        if (storedToken == null || storedToken.IsRevoked || storedToken.ExpiresAt < DateTime.UtcNow)
        {
            throw new UnauthorizedAccessException("Refresh token inválido o expirado");
        }

        var user = await _userRepository.GetByIdAsync(storedToken.UserId, cancellationToken);
        if (user == null || user.Status != UserStatus.Active)
        {
            throw new UnauthorizedAccessException("Usuario no encontrado o inactivo");
        }

        var newRefreshTokenValue = _tokenService.GenerateRefreshToken();
        var expiresAt = DateTime.UtcNow.AddMinutes(AccessTokenExpirationMinutes);
        var refreshTokenExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpirationDays);

        storedToken.IsRevoked = true;
        storedToken.ReplacedByToken = newRefreshTokenValue;
        storedToken.UpdatedAt = DateTime.UtcNow;
        await _refreshTokenRepository.UpdateAsync(storedToken, cancellationToken);

        var permissions = await GetUserPermissionsAsync(user, cancellationToken);
        var newToken = _tokenService.GenerateToken(user, permissions);

        var newStoredToken = new RefreshToken
        {
            Token = newRefreshTokenValue,
            UserId = user.Id,
            ExpiresAt = refreshTokenExpiresAt,
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };
        await _refreshTokenRepository.AddAsync(newStoredToken, cancellationToken);

        return new RefreshTokenResponse(newToken, newRefreshTokenValue, expiresAt, refreshTokenExpiresAt);
    }

    public async Task ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new KeyNotFoundException("Usuario no encontrado");

        if (user.Status != UserStatus.Active)
        {
            throw new InvalidOperationException("Tu cuenta está desactivada.");
        }

        if (string.IsNullOrEmpty(user.PasswordHash) || !_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
        {
            throw new InvalidOperationException("La contraseña actual es incorrecta");
        }

        if (request.NewPassword == request.CurrentPassword)
        {
            throw new InvalidOperationException("La nueva contraseña debe ser distinta a la actual");
        }

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepository.UpdateAsync(user, cancellationToken);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var storedToken = await _refreshTokenRepository.GetByTokenAsync(refreshToken, cancellationToken);
        if (storedToken != null)
        {
            storedToken.IsRevoked = true;
            storedToken.UpdatedAt = DateTime.UtcNow;
            await _refreshTokenRepository.UpdateAsync(storedToken, cancellationToken);
        }
    }

    public async Task<UserDto?> GetCurrentUserDtoAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
        if (user == null) return null;

        var rolePermissions = new List<string>();
        if (!string.IsNullOrEmpty(user.RoleString))
        {
            var roles = await _roleRepository.FindAsync(r => r.Name == user.RoleString, cancellationToken);
            var role = roles.FirstOrDefault();
            if (role != null)
            {
                rolePermissions = role.Permissions;
            }
        }

        var permissions = UserPermissionResolver.Merge(rolePermissions, user.ExtraPermissions);
        return new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.RoleString,
            user.Name,
            user.StatusString,
            permissions,
            user.StoreId,
            user.StoreName,
            user.AvatarUrl);
    }

    public async Task<LoginResponse> ImpersonateUserAsync(string currentUserId, string targetUserId, CancellationToken cancellationToken = default)
    {
        if (string.Equals(currentUserId, targetUserId, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("No puedes impersonar a tu propio usuario.");
        }

        var targetUser = await _userRepository.GetByIdAsync(targetUserId, cancellationToken)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        if (targetUser.Status != UserStatus.Active)
        {
            throw new InvalidOperationException("No se puede impersonar a un usuario inactivo.");
        }

        var currentUser = await _userRepository.GetByIdAsync(currentUserId, cancellationToken);
        if (currentUser != null && currentUser.Role == UserRole.Administrator && targetUser.Role == UserRole.SuperAdministrator)
        {
            throw new InvalidOperationException("Un Administrador no puede impersonar a un Super Administrador.");
        }

        var permissions = await GetUserPermissionsAsync(targetUser, cancellationToken);
        var token = _tokenService.GenerateToken(targetUser, permissions, currentUserId);
        var expiresAt = DateTime.UtcNow.AddMinutes(AccessTokenExpirationMinutes);

        _logger.LogInformation("Usuario {CurrentUserId} ({CurrentUserRole}) inició impersonación del usuario {TargetUserId} ({TargetUserRole})",
            currentUserId, currentUser?.RoleString ?? "Unknown", targetUserId, targetUser.RoleString);

        // ponytail: No emitimos nuevo refreshToken para preservar la sesión del superadmin intacta
        return new LoginResponse(
            token,
            string.Empty,
            expiresAt,
            expiresAt,
            new UserDto(
                targetUser.Id,
                targetUser.Username,
                targetUser.Email,
                targetUser.RoleString,
                targetUser.Name,
                targetUser.StatusString,
                permissions,
                targetUser.StoreId,
                targetUser.StoreName,
                targetUser.AvatarUrl));
    }
}


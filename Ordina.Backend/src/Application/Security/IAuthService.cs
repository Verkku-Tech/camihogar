using Ordina.Domain.Users;

namespace Ordina.Application.Security;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<RefreshTokenResponse> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken cancellationToken = default);
    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<UserDto?> GetCurrentUserDtoAsync(string userId, CancellationToken cancellationToken = default);
    Task<LoginResponse> ImpersonateUserAsync(string currentUserId, string targetUserId, CancellationToken cancellationToken = default);
}

public interface ITokenService
{
    string GenerateToken(User user, IEnumerable<string> permissions, string? impersonatedBy = null);
    string GenerateRefreshToken();
}

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}

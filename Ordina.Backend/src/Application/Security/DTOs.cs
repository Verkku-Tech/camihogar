namespace Ordina.Application.Security;

public record LoginRequest(string Username, string Password);

public record UserDto(
    string Id,
    string Username,
    string Email,
    string Role,
    string Name,
    string Status,
    IReadOnlyList<string> Permissions,
    string? StoreId = null,
    string? StoreName = null,
    string? AvatarUrl = null);

public record LoginResponse(
    string Token,
    string RefreshToken,
    DateTime ExpiresAt,
    DateTime RefreshTokenExpiresAt,
    UserDto User);

public record RefreshTokenRequest(string RefreshToken);

public record RefreshTokenResponse(
    string Token,
    string RefreshToken,
    DateTime ExpiresAt,
    DateTime RefreshTokenExpiresAt);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

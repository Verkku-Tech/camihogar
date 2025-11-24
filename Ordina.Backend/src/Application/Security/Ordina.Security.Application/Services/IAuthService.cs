using Ordina.Security.Application.DTOs;

namespace Ordina.Security.Application.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<RefreshTokenResponse> RefreshTokenAsync(string refreshToken);
}


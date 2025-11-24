using Ordina.Database.Entities.RefreshToken;

namespace Ordina.Database.Repositories;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenAsync(string token);
    Task<RefreshToken?> GetByUserIdAsync(string userId);
    Task<RefreshToken> CreateAsync(RefreshToken refreshToken);
    Task<RefreshToken> UpdateAsync(RefreshToken refreshToken);
    Task<bool> DeleteAsync(string id);
    Task<bool> RevokeAllForUserAsync(string userId);
}


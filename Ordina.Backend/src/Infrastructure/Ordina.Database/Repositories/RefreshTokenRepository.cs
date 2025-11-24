using MongoDB.Driver;
using Ordina.Database.Entities.RefreshToken;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly IMongoCollection<RefreshToken> _collection;

    public RefreshTokenRepository(MongoDbContext context)
    {
        _collection = context.RefreshTokens;
    }

    public async Task<RefreshToken?> GetByTokenAsync(string token)
    {
        return await _collection.Find(rt => rt.Token == token && !rt.IsRevoked).FirstOrDefaultAsync();
    }

    public async Task<RefreshToken?> GetByUserIdAsync(string userId)
    {
        return await _collection.Find(rt => rt.UserId == userId && !rt.IsRevoked && rt.ExpiresAt > DateTime.UtcNow)
            .SortByDescending(rt => rt.CreatedAt)
            .FirstOrDefaultAsync();
    }

    public async Task<RefreshToken> CreateAsync(RefreshToken refreshToken)
    {
        refreshToken.CreatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(refreshToken);
        return refreshToken;
    }

    public async Task<RefreshToken> UpdateAsync(RefreshToken refreshToken)
    {
        await _collection.ReplaceOneAsync(rt => rt.Id == refreshToken.Id, refreshToken);
        return refreshToken;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(rt => rt.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> RevokeAllForUserAsync(string userId)
    {
        var update = Builders<RefreshToken>.Update.Set(rt => rt.IsRevoked, true);
        var result = await _collection.UpdateManyAsync(
            rt => rt.UserId == userId && !rt.IsRevoked,
            update
        );
        return result.ModifiedCount > 0;
    }
}


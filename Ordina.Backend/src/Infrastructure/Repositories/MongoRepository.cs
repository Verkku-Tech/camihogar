using System.Linq.Expressions;
using MongoDB.Driver;
using Ordina.Application.Common;
using Ordina.Domain.Common;

namespace Ordina.Infrastructure.Repositories;

public class MongoRepository<T> : IRepository<T> where T : BaseEntity
{
    protected readonly IMongoCollection<T> _collection;

    public MongoRepository(IMongoDatabase database, string collectionName)
    {
        _collection = database.GetCollection<T>(collectionName);
    }

    public virtual async Task<T?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var filter = Builders<T>.Filter.Eq(x => x.Id, id);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public virtual async Task<IReadOnlyList<T>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _collection.Find(_ => true).ToListAsync(cancellationToken);
    }

    public virtual async Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        return await _collection.Find(predicate).ToListAsync(cancellationToken);
    }

    public virtual async Task<PagedResult<T>> GetPagedAsync(
        int page,
        int pageSize,
        Expression<Func<T, bool>>? predicate = null,
        CancellationToken cancellationToken = default)
    {
        var filter = predicate != null ? Builders<T>.Filter.Where(predicate) : Builders<T>.Filter.Empty;
        var totalCount = await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);

        var items = await _collection.Find(filter)
            .SortByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<T>(items, (int)totalCount, page, pageSize);
    }

    public virtual async Task<T> AddAsync(T entity, CancellationToken cancellationToken = default)
    {
        if (entity.CreatedAt == default) entity.CreatedAt = DateTime.UtcNow;
        if (entity.UpdatedAt == default) entity.UpdatedAt = DateTime.UtcNow;

        await _collection.InsertOneAsync(entity, cancellationToken: cancellationToken);
        return entity;
    }

    public virtual async Task<bool> UpdateAsync(T entity, CancellationToken cancellationToken = default)
    {
        entity.UpdatedAt = DateTime.UtcNow;
        var filter = Builders<T>.Filter.Eq(x => x.Id, entity.Id);
        var result = await _collection.ReplaceOneAsync(filter, entity, cancellationToken: cancellationToken);
        return result.ModifiedCount > 0 || result.MatchedCount > 0;
    }

    public virtual async Task<bool> UpdateWithConcurrencyAsync(
        T entity,
        DateTime expectedUpdatedAt,
        CancellationToken cancellationToken = default)
    {
        var filter = Builders<T>.Filter.And(
            Builders<T>.Filter.Eq(x => x.Id, entity.Id),
            Builders<T>.Filter.Eq(x => x.UpdatedAt, expectedUpdatedAt));

        entity.UpdatedAt = DateTime.UtcNow;
        var result = await _collection.ReplaceOneAsync(filter, entity, cancellationToken: cancellationToken);

        return result.ModifiedCount > 0;
    }

    public virtual async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var filter = Builders<T>.Filter.Eq(x => x.Id, id);
        var result = await _collection.DeleteOneAsync(filter, cancellationToken);
        return result.DeletedCount > 0;
    }

    public virtual async Task<bool> ExistsAsync(string id, CancellationToken cancellationToken = default)
    {
        var filter = Builders<T>.Filter.Eq(x => x.Id, id);
        return await _collection.Find(filter).AnyAsync(cancellationToken);
    }
}

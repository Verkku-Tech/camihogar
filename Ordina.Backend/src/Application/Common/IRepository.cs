using System.Linq.Expressions;
using Ordina.Domain.Common;

namespace Ordina.Application.Common;

public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<T>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    Task<PagedResult<T>> GetPagedAsync(int page, int pageSize, Expression<Func<T, bool>>? predicate = null, CancellationToken cancellationToken = default);
    Task<T> AddAsync(T entity, CancellationToken cancellationToken = default);
    Task<bool> UpdateAsync(T entity, CancellationToken cancellationToken = default);
    /// <summary>
    /// Actualización con control de concurrencia optimista usando updatedAt.
    /// Retorna false si el documento fue modificado por otra transacción.
    /// </summary>
    Task<bool> UpdateWithConcurrencyAsync(T entity, DateTime expectedUpdatedAt, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(string id, CancellationToken cancellationToken = default);
}

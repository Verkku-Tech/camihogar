using Ordina.Application.Common;
using Ordina.Domain.Inventory;

namespace Ordina.Application.Inventory;

public interface IPhysicalStockRepository : IRepository<PhysicalStock>
{
    Task<bool> ReserveStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default);
    Task<bool> ReleaseStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default);
    Task<bool> DeductSoldStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default);
}

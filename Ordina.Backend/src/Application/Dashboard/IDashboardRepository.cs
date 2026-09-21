using Ordina.Domain.Catalog;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;

namespace Ordina.Application.Dashboard;

public interface IDashboardRepository
{
    Task<IReadOnlyList<Order>> GetAllOrdersForDashboardAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExchangeRate>> GetExchangeRatesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Category>> GetCategoriesAsync(CancellationToken cancellationToken = default);
}


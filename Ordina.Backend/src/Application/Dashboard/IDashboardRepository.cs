using Ordina.Domain.Catalog;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Ordina.Domain.Stores;
using Ordina.Domain.Users;

namespace Ordina.Application.Dashboard;

public interface IDashboardRepository
{
    Task<IReadOnlyList<Order>> GetAllOrdersForDashboardAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExchangeRate>> GetExchangeRatesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Category>> GetCategoriesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<User>> GetUsersAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Store>> GetStoresAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Commission>> GetCommissionsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SaleTypeCommissionRule>> GetSaleTypeCommissionRulesAsync(CancellationToken cancellationToken = default);
}


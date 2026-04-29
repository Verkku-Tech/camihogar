using Ordina.Database.Entities.Client;

namespace Ordina.Database.Repositories;

public interface IClientCreditLedgerRepository
{
    Task InsertAsync(ClientCreditLedger entry, CancellationToken cancellationToken = default);

    Task<decimal> SumAmountUsdByClientIdAsync(string clientId, CancellationToken cancellationToken = default);

    /// <summary>Evita duplicar acreditación por sobrepago del mismo pedido.</summary>
    Task<bool> ExistsOverpaymentForOrderAsync(string orderId, CancellationToken cancellationToken = default);
}

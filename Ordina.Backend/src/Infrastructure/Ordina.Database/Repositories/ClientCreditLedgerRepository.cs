using MongoDB.Driver;
using Ordina.Database.Entities.Client;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class ClientCreditLedgerRepository : IClientCreditLedgerRepository
{
    private readonly IMongoCollection<ClientCreditLedger> _collection;

    public ClientCreditLedgerRepository(MongoDbContext context)
    {
        _collection = context.ClientCreditLedgers;
    }

    public async Task InsertAsync(ClientCreditLedger entry, CancellationToken cancellationToken = default)
    {
        await _collection.InsertOneAsync(entry, cancellationToken: cancellationToken);
    }

    public async Task<decimal> SumAmountUsdByClientIdAsync(string clientId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<ClientCreditLedger>.Filter.Eq(x => x.ClientId, clientId);
        var list = await _collection.Find(filter).ToListAsync(cancellationToken);
        return list.Sum(x => x.AmountUsd);
    }

    public async Task<bool> ExistsOverpaymentForOrderAsync(string orderId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<ClientCreditLedger>.Filter.And(
            Builders<ClientCreditLedger>.Filter.Eq(x => x.OrderId, orderId),
            Builders<ClientCreditLedger>.Filter.Eq(x => x.Type, "overpayment"));
        var count = await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        return count > 0;
    }
}

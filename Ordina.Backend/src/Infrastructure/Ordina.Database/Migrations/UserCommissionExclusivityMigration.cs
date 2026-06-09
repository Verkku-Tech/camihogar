using MongoDB.Driver;
using Ordina.Database.Entities.User;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Migrations;

/// <summary>
/// Migra exclusiveCommission (bool) a commissionExclusivityMode (string).
/// </summary>
public static class UserCommissionExclusivityMigration
{
    public static async Task RunAsync(MongoDbContext context)
    {
        var collection = context.Users;
        var users = await collection.Find(_ => true).ToListAsync();
        var writes = new List<WriteModel<User>>();

        foreach (var user in users)
        {
            var previousMode = user.CommissionExclusivityModeStored;
            user.NormalizeCommissionExclusivity();

            if (previousMode == user.CommissionExclusivityModeStored &&
                user.ExclusiveCommissionStored == CommissionExclusivityModes.IsExclusive(user.CommissionExclusivityMode))
            {
                continue;
            }

            var update = Builders<User>.Update
                .Set(u => u.CommissionExclusivityModeStored, user.CommissionExclusivityModeStored)
                .Set(u => u.ExclusiveCommissionStored, user.ExclusiveCommissionStored);

            writes.Add(new UpdateOneModel<User>(
                Builders<User>.Filter.Eq(u => u.Id, user.Id),
                update));
        }

        if (writes.Count > 0)
            await collection.BulkWriteAsync(writes);
    }
}

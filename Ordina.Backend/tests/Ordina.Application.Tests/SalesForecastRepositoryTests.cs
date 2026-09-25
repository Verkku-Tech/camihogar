using MongoDB.Bson.Serialization;
using Ordina.Domain.Dashboard;
using Xunit;

namespace Ordina.Application.Tests;

public class SalesForecastRepositoryTests
{
    [Fact]
    public void SalesForecastRecord_ShouldMapBsonProperly()
    {
        var classMap = BsonClassMap.LookupClassMap(typeof(SalesForecastRecord));
        Assert.NotNull(classMap);
        Assert.NotNull(classMap.GetMemberMap(nameof(SalesForecastRecord.VersionNumber)));
        Assert.NotNull(classMap.GetMemberMap(nameof(SalesForecastRecord.ProjectionsHash)));
        Assert.NotNull(classMap.GetMemberMap(nameof(SalesForecastRecord.Title)));
    }
}

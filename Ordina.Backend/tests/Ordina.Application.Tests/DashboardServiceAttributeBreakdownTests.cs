using System.Threading.Tasks;
using Ordina.Application.Dashboard;
using Xunit;

namespace Ordina.Application.Tests;

public class DashboardServiceAttributeBreakdownTests
{
    [Fact]
    public void TopProductDto_SupportsHasAttributesParameter()
    {
        var dto = new TopProductDto("Cama Matrimonial", "Camas", 10, 2500m, HasAttributes: true);
        Assert.True(dto.HasAttributes);
    }
}

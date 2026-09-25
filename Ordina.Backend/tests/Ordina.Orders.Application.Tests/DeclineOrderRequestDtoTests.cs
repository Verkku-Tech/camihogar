using System.Text.Json;
using Ordina.Orders.Application.DTOs;
using Xunit;

namespace Ordina.Orders.Application.Tests;

public class DeclineOrderRequestDtoTests
{
    [Fact]
    public void Deserializes_Reason_Property()
    {
        var json = "{\"reason\":\"Solicitado por lisbeth\"}";
        var dto = JsonSerializer.Deserialize<DeclineOrderRequestDto>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(dto);
        Assert.Equal("Solicitado por lisbeth", dto.GetReason());
    }

    [Fact]
    public void Deserializes_DeclineReason_Property()
    {
        var json = "{\"declineReason\":\"Solicitado por lisbeth\"}";
        var dto = JsonSerializer.Deserialize<DeclineOrderRequestDto>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(dto);
        Assert.Equal("Solicitado por lisbeth", dto.GetReason());
    }
}

using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Stores;
using Ordina.Domain.Stores;
using Xunit;

namespace Ordina.Application.Tests;

public class StoreDisplayLimitsTests
{
    private readonly Mock<IRepository<Store>> _storeRepoMock = new();
    private readonly Mock<ICacheService> _cacheServiceMock = new();
    private readonly Mock<ILogger<StoreService>> _loggerMock = new();
    private readonly StoreService _storeService;

    public StoreDisplayLimitsTests()
    {
        _storeService = new StoreService(
            _storeRepoMock.Object,
            _cacheServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task UpdateDisplayLimitsAsync_UpdatesAndSanitizesLimits()
    {
        var storeId = "store-123";
        var store = new Store
        {
            Id = storeId,
            Name = "Tienda Caracas",
            Code = "CCS",
            MaxCapacity = 25,
            ProductDisplayLimits = new()
        };

        _storeRepoMock.Setup(r => r.GetByIdAsync(storeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(store);

        var inputLimits = new Dictionary<string, int>
        {
            { "prod-1", 3 },
            { "prod-2", -5 }, // Negativo debe normalizarse a 0
            { "  prod-3  ", 2 } // Debe limpiar espacios
        };

        var result = await _storeService.UpdateDisplayLimitsAsync(storeId, inputLimits);

        Assert.NotNull(result);
        Assert.Equal(3, result.ProductDisplayLimits!["prod-1"]);
        Assert.Equal(0, result.ProductDisplayLimits["prod-2"]);
        Assert.Equal(2, result.ProductDisplayLimits["prod-3"]);
        _storeRepoMock.Verify(r => r.UpdateAsync(It.IsAny<Store>(), It.IsAny<CancellationToken>()), Times.Once);
        _cacheServiceMock.Verify(c => c.RemoveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_StoresDisplayLimitsProperly()
    {
        _storeRepoMock.Setup(r => r.AddAsync(It.IsAny<Store>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Store s, CancellationToken ct) => s);

        var createDto = new CreateStoreDto(
            Name: "Tienda Valencia",
            Code: "VAL",
            Address: "Av Bolivar",
            Phone: "04141234567",
            Email: "valencia@camihogar.com",
            Rif: "J-12345678-0",
            MaxCapacity: 30,
            ProductDisplayLimits: new() { { "prod-bed", 4 }, { "prod-sofa", 2 } }
        );

        var result = await _storeService.CreateAsync(createDto);

        Assert.NotNull(result);
        Assert.Equal(30, result.MaxCapacity);
        Assert.Equal(4, result.ProductDisplayLimits!["prod-bed"]);
        Assert.Equal(2, result.ProductDisplayLimits["prod-sofa"]);
    }
}

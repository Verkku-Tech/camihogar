using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Stores;
using Ordina.Domain.Stores;
using Xunit;

namespace Ordina.Application.Tests;

public class WarehouseServiceTests
{
    private readonly Mock<IRepository<Warehouse>> _repoMock = new();
    private readonly WarehouseService _service;

    public WarehouseServiceTests()
    {
        _service = new WarehouseService(_repoMock.Object, NullLogger<WarehouseService>.Instance);
    }

    [Fact]
    public async Task CreateAsync_ValidDto_CreatesAndReturnsWarehouse()
    {
        var dto = new CreateWarehouseDto("Depósito Central Terrinca", "TERR-01", "Zona Industrial Terrinca", "0414-1234567", 150, true);
        _repoMock.Setup(r => r.AddAsync(It.IsAny<Warehouse>(), default))
            .ReturnsAsync((Warehouse w, CancellationToken _) =>
            {
                w.Id = "wh-1";
                return w;
            });

        var result = await _service.CreateAsync(dto);

        Assert.NotNull(result);
        Assert.Equal("wh-1", result.Id);
        Assert.Equal("Depósito Central Terrinca", result.Name);
        Assert.Equal("TERR-01", result.Code);
        Assert.True(result.IsCentral);
        Assert.Equal(150, result.MaxCapacity);
        Assert.Equal("active", result.Status);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsMappedDtos()
    {
        var warehouses = new List<Warehouse>
        {
            new() { Id = "wh-1", Name = "Depósito 1", Code = "DEP-1", MaxCapacity = 80, Status = "active" },
            new() { Id = "wh-2", Name = "Depósito 2", Code = "DEP-2", MaxCapacity = 50, Status = "active" }
        };
        _repoMock.Setup(r => r.GetAllAsync(default)).ReturnsAsync(warehouses);

        var result = await _service.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.Equal("Depósito 1", result[0].Name);
        Assert.Equal("Depósito 2", result[1].Name);
    }

    [Fact]
    public async Task UpdateAsync_ExistingWarehouse_UpdatesProperties()
    {
        var existing = new Warehouse { Id = "wh-1", Name = "Viejo", Code = "OLD", MaxCapacity = 50 };
        _repoMock.Setup(r => r.GetByIdAsync("wh-1", default)).ReturnsAsync(existing);
        _repoMock.Setup(r => r.UpdateAsync(It.IsAny<Warehouse>(), default)).ReturnsAsync(true);

        var updateDto = new UpdateWarehouseDto(Name: "Nuevo Nombre", MaxCapacity: 120);
        var result = await _service.UpdateAsync("wh-1", updateDto);

        Assert.NotNull(result);
        Assert.Equal("Nuevo Nombre", result!.Name);
        Assert.Equal(120, result.MaxCapacity);
    }
}

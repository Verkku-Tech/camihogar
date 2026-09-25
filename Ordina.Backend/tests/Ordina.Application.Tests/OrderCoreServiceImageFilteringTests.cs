using Moq;
using Ordina.Application.Common;
using Ordina.Application.Orders;
using Ordina.Domain.Orders;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Ordina.Application.Tests;

public class OrderCoreServiceImageFilteringTests
{
    private readonly Mock<IOrderRepository> _orderRepoMock = new();
    private readonly Mock<ILogger<OrderCoreService>> _loggerMock = new();

    private static Order CreateOrderWithImages()
    {
        return new Order
        {
            Id = "60c72b2f9b1d8b2badbee123",
            OrderNumber = "ORD-00001",
            ClientName = "Test Client",
            Products = new List<OrderProduct>
            {
                new()
                {
                    Name = "Mesa",
                    Price = 100,
                    Quantity = 1,
                    Total = 100,
                    Images = new List<ProductImage>
                    {
                        new() { Id = "img-1", Base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" }
                    }
                }
            },
            PartialPayments = new List<PartialPayment>
            {
                new()
                {
                    Id = "pay-1",
                    Amount = 50,
                    Method = "Transferencia",
                    Images = new List<ProductImage>
                    {
                        new() { Id = "pay-img-1", Base64 = "data:image/jpeg;base64,abcdef123456" }
                    }
                }
            }
        };
    }

    [Fact]
    public async Task GetPagedAsync_WhenIncludeImagesIsFalse_ShouldOmitImagesInDto()
    {
        var order = CreateOrderWithImages();
        var pagedResult = new PagedResult<Order>(new List<Order> { order }, 1, 1, 50);
        _orderRepoMock.Setup(r => r.GetFilteredPagedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<OrderQueryFilter>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(pagedResult);

        var service = new OrderCoreService(_orderRepoMock.Object, _loggerMock.Object);
        var filter = new OrderQueryFilter(IncludeImages: false);
        var result = await service.GetPagedAsync(new PagedRequest(1, 50), filter);

        var item = Assert.Single(result.Items);
        Assert.Null(item.Products[0].Images);
        Assert.Null(item.PartialPayments![0].Images);
    }

    [Fact]
    public async Task GetByIdAsync_WhenIncludeImagesIsTrue_ShouldIncludeImagesInDto()
    {
        var order = CreateOrderWithImages();
        _orderRepoMock.Setup(r => r.GetByIdAsync("60c72b2f9b1d8b2badbee123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);

        var service = new OrderCoreService(_orderRepoMock.Object, _loggerMock.Object);
        var result = await service.GetByIdAsync("60c72b2f9b1d8b2badbee123", includeImages: true);

        Assert.NotNull(result);
        Assert.NotNull(result.Products[0].Images);
        Assert.Single(result.Products[0].Images!);
        Assert.NotNull(result.PartialPayments![0].Images);
        Assert.Single(result.PartialPayments![0].Images!);
    }
}

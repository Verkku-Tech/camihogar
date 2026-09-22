using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Catalog;
using Ordina.Application.Common;
using Ordina.Domain.Catalog;
using Ordina.Domain.Users;
using Xunit;

namespace Ordina.Application.Tests;

public class ProductServiceTests
{
    private readonly Mock<IProductRepository> _productRepoMock = new();
    private readonly Mock<ICacheService> _cacheServiceMock = new();
    private readonly Mock<ILogger<ProductService>> _loggerMock = new();
    private readonly ProductService _productService;

    public ProductServiceTests()
    {
        _productService = new ProductService(
            _productRepoMock.Object,
            _cacheServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task GetPagedAsync_PassesFilterToRepository_WithCategoryAndStatus()
    {
        Expression<Func<Product, bool>>? capturedFilter = null;

        _productRepoMock
            .Setup(r => r.GetPagedAsync(
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<Expression<Func<Product, bool>>?>(),
                It.IsAny<CancellationToken>()))
            .Callback<int, int, Expression<Func<Product, bool>>?, CancellationToken>(
                (page, size, filter, ct) => capturedFilter = filter)
            .ReturnsAsync(new PagedResult<Product>(new List<Product>(), 0, 1, 10));

        var request = new PagedRequest(Page: 1, PageSize: 10, SearchTerm: "sofa");
        var result = await _productService.GetPagedAsync(request, categoryId: "cat-1", status: "Disponible", cancellationToken: CancellationToken.None);

        Assert.NotNull(result);
        Assert.NotNull(capturedFilter);

        var compiledFilter = capturedFilter!.Compile();

        // Matching product
        var matchingProduct = new Product
        {
            Name = "sofa cama",
            CategoryId = "cat-1",
            StatusString = "Disponible"
        };
        Assert.True(compiledFilter(matchingProduct));

        // Non-matching category
        var wrongCategoryProduct = new Product
        {
            Name = "sofa cama",
            CategoryId = "cat-2",
            StatusString = "Disponible"
        };
        Assert.False(compiledFilter(wrongCategoryProduct));

        // Non-matching status
        var wrongStatusProduct = new Product
        {
            Name = "sofa cama",
            CategoryId = "cat-1",
            StatusString = "Agotado"
        };
        Assert.False(compiledFilter(wrongStatusProduct));
    }

    [Fact]
    public void Permissions_All_ContainsExpectedItems()
    {
        var all = Permissions.GetAll();
        Assert.NotEmpty(all);
        Assert.Contains(Permissions.Users.Read, all);
        Assert.Contains(Permissions.Orders.Read, all);
        Assert.Contains(Permissions.Dispatch.ConfirmDelivery, all);
        Assert.True(Permissions.All.Contains(Permissions.Dispatch.SendToRoute));
    }

    [Fact]
    public void AssignableUserPermissions_IsAssignable_UsesFrozenDictionaryCorrectly()
    {
        Assert.True(AssignableUserPermissions.IsAssignable(Permissions.Dispatch.SendToRoute));
        Assert.True(AssignableUserPermissions.IsAssignable(Permissions.Dispatch.ConfirmDelivery));
        Assert.True(AssignableUserPermissions.IsAssignable(Permissions.Manufacturing.Manage));
        Assert.False(AssignableUserPermissions.IsAssignable(Permissions.Users.Delete));
        Assert.False(AssignableUserPermissions.IsAssignable("unknown.permission"));
    }
}

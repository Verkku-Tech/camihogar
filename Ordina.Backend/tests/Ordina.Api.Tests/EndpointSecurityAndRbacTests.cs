using System.Reflection;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Api.Controllers;
using Ordina.Application.Common;
using Ordina.Domain.Common;
using Ordina.Domain.Security;
using Xunit;

namespace Ordina.Api.Tests;

public class EndpointSecurityAndRbacTests
{
    private readonly Mock<IRepository<AccessPin>> _pinRepoMock = new();
    private readonly Mock<ILogger<AccessPinController>> _loggerMock = new();

    [Theory]
    [InlineData(typeof(UsersController))]
    [InlineData(typeof(AccessPinController))]
    [InlineData(typeof(CommissionSettingsController))]
    [InlineData(typeof(RolesController))]
    [InlineData(typeof(FinanceController))]
    [InlineData(typeof(OrdersController))]
    [InlineData(typeof(ProductsController))]
    [InlineData(typeof(StoresController))]
    public void SensitiveControllers_MustBeDecoratedWithAuthorizeAttribute(Type controllerType)
    {
        var authorizeAttr = controllerType.GetCustomAttribute<AuthorizeAttribute>(inherit: true);
        Assert.NotNull(authorizeAttr);
    }

    [Fact]
    public async Task AccessPinGenerate_ForbidsAccess_WhenUserIsNotAdmin()
    {
        // Arrange
        var controller = new AccessPinController(_pinRepoMock.Object, _loggerMock.Object);
        var sellerClaims = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, "user-seller-1"),
            new Claim(ClaimTypes.Role, "Store Seller")
        ], "TestAuth"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = sellerClaims }
        };

        // Act
        var result = await controller.Generate(CancellationToken.None);

        // Assert
        Assert.IsType<ForbidResult>(result.Result);
        _pinRepoMock.Verify(r => r.AddAsync(It.IsAny<AccessPin>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("Super Administrator")]
    [InlineData("Administrator")]
    public async Task AccessPinGenerate_Succeeds_WhenUserIsAdmin(string adminRole)
    {
        // Arrange
        var controller = new AccessPinController(_pinRepoMock.Object, _loggerMock.Object);
        var adminClaims = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, "admin-1"),
            new Claim(ClaimTypes.Role, adminRole)
        ], "TestAuth"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = adminClaims }
        };

        _pinRepoMock.Setup(r => r.AddAsync(It.IsAny<AccessPin>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AccessPin p, CancellationToken _) => p);

        // Act
        var result = await controller.Generate(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(okResult.Value);
        _pinRepoMock.Verify(r => r.AddAsync(It.IsAny<AccessPin>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}

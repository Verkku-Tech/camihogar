using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Ordina.Api.Controllers;
using Ordina.Application.Security;
using Ordina.Application.Users;
using Xunit;

namespace Ordina.Api.Tests;

public class AuthControllerSecurityTests
{
    private readonly Mock<IAuthService> _authServiceMock = new();
    private readonly Mock<IUserService> _userServiceMock = new();
    private readonly AuthController _controller;

    public AuthControllerSecurityTests()
    {
        _controller = new AuthController(_authServiceMock.Object, _userServiceMock.Object);
    }

    [Fact]
    public async Task Refresh_ReturnsForbidden_WhenAntiCsrfHeaderIsMissing()
    {
        // Arrange
        var context = new DefaultHttpContext();
        // Missing X-Requested-With header
        _controller.ControllerContext = new ControllerContext { HttpContext = context };

        // Act
        var result = await _controller.Refresh(CancellationToken.None);

        // Assert
        var objectResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, objectResult.StatusCode);
    }

    [Fact]
    public async Task Refresh_ReturnsUnauthorized_WhenCookieIsMissing()
    {
        // Arrange
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Requested-With"] = "XMLHttpRequest";
        // No refreshToken cookie set
        _controller.ControllerContext = new ControllerContext { HttpContext = context };

        // Act
        var result = await _controller.Refresh(CancellationToken.None);

        // Assert
        var unauthorizedResult = Assert.IsType<UnauthorizedObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status401Unauthorized, unauthorizedResult.StatusCode);
    }
}

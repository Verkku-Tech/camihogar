using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Security;
using Ordina.Domain.Enums;
using Ordina.Domain.Security;
using Ordina.Domain.Users;
using Ordina.Infrastructure.Security;
using Xunit;

namespace Ordina.Application.Tests;

public class AuthAndSecurityTests
{
    private readonly PasswordHasher _hasher = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepoMock = new();
    private readonly Mock<IRepository<Role>> _roleRepoMock = new();
    private readonly Mock<ITokenService> _tokenServiceMock = new();
    private readonly Mock<ILogger<AuthService>> _loggerMock = new();
    private readonly AuthService _authService;

    public AuthAndSecurityTests()
    {
        _authService = new AuthService(
            _userRepoMock.Object,
            _refreshTokenRepoMock.Object,
            _roleRepoMock.Object,
            _tokenServiceMock.Object,
            _hasher,
            _loggerMock.Object);
    }

    [Fact]
    public void PasswordHasher_BcryptHash_VerifiesSuccessfully()
    {
        var password = "SecurePassword123!";
        var hash = _hasher.HashPassword(password);

        Assert.StartsWith("$2a$", hash); // BCrypt prefix
        Assert.True(_hasher.VerifyPassword(password, hash));
        Assert.False(_hasher.VerifyPassword("WrongPassword", hash));
    }

    [Fact]
    public void PasswordHasher_LegacySha256_VerifiesSuccessfully()
    {
        var password = "LegacyPassword123!";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        var legacyHex = Convert.ToHexString(bytes).ToLowerInvariant();

        Assert.Equal(64, legacyHex.Length);
        Assert.True(_hasher.VerifyPassword(password, legacyHex));
        Assert.False(_hasher.VerifyPassword("WrongPassword", legacyHex));
    }

    [Fact]
    public async Task AuthService_LoginAsync_ThrowsUnauthorized_WhenUserIsInactive()
    {
        var user = new User
        {
            Id = "user-1",
            Username = "inactive_user",
            Email = "inactive@camihogar.com",
            Status = UserStatus.Inactive,
            PasswordHash = _hasher.HashPassword("TestPass123!")
        };

        _userRepoMock.Setup(r => r.GetByUsernameAsync("inactive_user", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var request = new LoginRequest("inactive_user", "TestPass123!");

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _authService.LoginAsync(request, CancellationToken.None));

        Assert.Contains("desactivada", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuthService_LoginAsync_ThrowsUnauthorized_WhenPasswordIsIncorrect()
    {
        var user = new User
        {
            Id = "user-1",
            Username = "active_user",
            Email = "active@camihogar.com",
            Status = UserStatus.Active,
            PasswordHash = _hasher.HashPassword("CorrectPassword!")
        };

        _userRepoMock.Setup(r => r.GetByUsernameAsync("active_user", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var request = new LoginRequest("active_user", "WrongPassword!");

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _authService.LoginAsync(request, CancellationToken.None));

        Assert.Contains("incorrectos", ex.Message, StringComparison.OrdinalIgnoreCase);
    }
}

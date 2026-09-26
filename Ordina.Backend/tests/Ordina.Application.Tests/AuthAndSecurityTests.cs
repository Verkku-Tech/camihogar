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
    public void PasswordHasher_PlaintextPassword_VerifiesSuccessfully()
    {
        var password = "PlaintextPassword123!";
        Assert.True(_hasher.VerifyPassword(password, password));
        Assert.False(_hasher.VerifyPassword("WrongPassword", password));
    }

    [Fact]
    public void PasswordHasher_HyphenatedSha256_VerifiesSuccessfully()
    {
        var password = "LegacyPassword123!";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        var hyphenatedHex = BitConverter.ToString(bytes); // e.g. "EF-92-B7-..."

        Assert.True(_hasher.VerifyPassword(password, hyphenatedHex));
    }

    [Fact]
    public void User_EffectivePasswordHash_FallsBackToPassword()
    {
        var userWithBoth = new User { PasswordHash = "hash1", Password = "pwd1" };
        Assert.Equal("hash1", userWithBoth.EffectivePasswordHash);

        var userWithLegacyOnly = new User { PasswordHash = null, Password = "legacy_pwd" };
        Assert.Equal("legacy_pwd", userWithLegacyOnly.EffectivePasswordHash);
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

    [Fact]
    public async Task AuthService_ImpersonateUserAsync_GeneratesToken_ForActiveUser()
    {
        var targetUser = new User
        {
            Id = "user-2",
            Username = "seller_user",
            Email = "seller@camihogar.com",
            RoleString = "Store Seller",
            Status = UserStatus.Active,
            Name = "Vendedor Tienda",
            AvatarUrl = "data:image/webp;base64,impersonated_avatar"
        };

        _userRepoMock.Setup(r => r.GetByIdAsync("user-2", It.IsAny<CancellationToken>()))
            .ReturnsAsync(targetUser);

        _roleRepoMock.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Role, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Role>());

        _tokenServiceMock.Setup(t => t.GenerateToken(targetUser, It.IsAny<System.Collections.Generic.IEnumerable<string>>(), "superadmin-1"))
            .Returns("impersonated_jwt_token");

        var response = await _authService.ImpersonateUserAsync("superadmin-1", "user-2", CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal("impersonated_jwt_token", response.Token);
        Assert.Equal("seller_user", response.User.Username);
        Assert.Equal("Store Seller", response.User.Role);
        Assert.Equal("data:image/webp;base64,impersonated_avatar", response.User.AvatarUrl);
    }

    [Fact]
    public async Task AuthService_ImpersonateUserAsync_Throws_WhenTargetUserNotFound()
    {
        _userRepoMock.Setup(r => r.GetByIdAsync("non-existent", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _authService.ImpersonateUserAsync("superadmin-1", "non-existent", CancellationToken.None));
    }

    [Fact]
    public async Task AuthService_ImpersonateUserAsync_Throws_WhenTargetUserIsInactive()
    {
        var inactiveUser = new User
        {
            Id = "user-inactive",
            Username = "inactive_user",
            Status = UserStatus.Inactive
        };

        _userRepoMock.Setup(r => r.GetByIdAsync("user-inactive", It.IsAny<CancellationToken>()))
            .ReturnsAsync(inactiveUser);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _authService.ImpersonateUserAsync("superadmin-1", "user-inactive", CancellationToken.None));

        Assert.Contains("inactivo", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuthService_ImpersonateUserAsync_Throws_WhenTargetUserIsSameAsCurrent()
    {
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _authService.ImpersonateUserAsync("superadmin-1", "superadmin-1", CancellationToken.None));

        Assert.Contains("propio usuario", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuthService_ImpersonateUserAsync_AllowsAdministrator_ToImpersonateNonSuperAdmin()
    {
        var adminUser = new User
        {
            Id = "admin-1",
            Username = "admin_user",
            RoleString = "Administrator",
            Status = UserStatus.Active
        };

        var targetUser = new User
        {
            Id = "seller-1",
            Username = "seller_user",
            RoleString = "Store Seller",
            Status = UserStatus.Active
        };

        _userRepoMock.Setup(r => r.GetByIdAsync("admin-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(adminUser);

        _userRepoMock.Setup(r => r.GetByIdAsync("seller-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(targetUser);

        _tokenServiceMock.Setup(t => t.GenerateToken(targetUser, It.IsAny<System.Collections.Generic.IEnumerable<string>>(), "admin-1"))
            .Returns("admin_impersonated_token");

        var response = await _authService.ImpersonateUserAsync("admin-1", "seller-1", CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal("admin_impersonated_token", response.Token);
        Assert.Equal("seller_user", response.User.Username);
    }

    [Fact]
    public async Task AuthService_ImpersonateUserAsync_Throws_WhenAdministrator_TriesToImpersonateSuperAdmin()
    {
        var adminUser = new User
        {
            Id = "admin-1",
            Username = "admin_user",
            RoleString = "Administrator",
            Status = UserStatus.Active
        };

        var superAdminUser = new User
        {
            Id = "superadmin-1",
            Username = "super_admin_user",
            RoleString = "Super Administrator",
            Status = UserStatus.Active
        };

        _userRepoMock.Setup(r => r.GetByIdAsync("admin-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(adminUser);

        _userRepoMock.Setup(r => r.GetByIdAsync("superadmin-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(superAdminUser);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _authService.ImpersonateUserAsync("admin-1", "superadmin-1", CancellationToken.None));

        Assert.Contains("Super Administrador", ex.Message, StringComparison.OrdinalIgnoreCase);
    }
}


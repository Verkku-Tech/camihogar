using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Security;
using Ordina.Application.Users;
using Ordina.Domain.Enums;
using Ordina.Domain.Security;
using Ordina.Domain.Users;
using Ordina.Infrastructure.Security;
using Xunit;

namespace Ordina.Application.Tests;

public class UserServiceTests
{
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<IRepository<Role>> _roleRepoMock = new();
    private readonly PasswordHasher _hasher = new();
    private readonly Mock<ILogger<UserService>> _loggerMock = new();
    private readonly UserService _userService;

    public UserServiceTests()
    {
        _userService = new UserService(
            _userRepoMock.Object,
            _roleRepoMock.Object,
            _hasher,
            _loggerMock.Object);
    }

    [Fact]
    public async Task CreateUserAsync_SetsAndReturnsAvatarUrl()
    {
        var createDto = new CreateUserDto(
            Username: "avatar_user",
            Email: "avatar@test.com",
            Name: "Avatar User",
            Role: "Store Seller",
            AvatarUrl: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoA");

        _userRepoMock.Setup(r => r.GetByUsernameAsync("avatar_user", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);
        _userRepoMock.Setup(r => r.GetByEmailAsync("avatar@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        User? capturedUser = null;
        _userRepoMock.Setup(r => r.AddAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .Callback<User, CancellationToken>((u, _) =>
            {
                u.Id = "user-avatar-1";
                capturedUser = u;
            })
            .ReturnsAsync((User u, CancellationToken _) => u);

        var result = await _userService.CreateUserAsync(createDto, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoA", result.AvatarUrl);
        Assert.NotNull(capturedUser);
        Assert.Equal("data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoA", capturedUser.AvatarUrl);
    }

    [Fact]
    public async Task UpdateUserAsync_UpdatesAvatarUrl()
    {
        var existingUser = new User
        {
            Id = "user-1",
            Username = "existing_user",
            Email = "existing@test.com",
            Name = "Existing",
            AvatarUrl = "data:image/webp;base64,old"
        };

        _userRepoMock.Setup(r => r.GetByIdAsync("user-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        var updateDto = new UpdateUserDto(
            AvatarUrl: "data:image/webp;base64,new");

        var result = await _userService.UpdateUserAsync("user-1", updateDto, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("data:image/webp;base64,new", result.AvatarUrl);
        Assert.Equal("data:image/webp;base64,new", existingUser.AvatarUrl);
    }

    [Fact]
    public async Task UpdateUserAsync_ClearsAvatarUrl_WhenEmptyStringPassed()
    {
        var existingUser = new User
        {
            Id = "user-2",
            Username = "existing_user_2",
            Email = "existing2@test.com",
            Name = "Existing 2",
            AvatarUrl = "data:image/webp;base64,old"
        };

        _userRepoMock.Setup(r => r.GetByIdAsync("user-2", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        var updateDto = new UpdateUserDto(
            AvatarUrl: "");

        var result = await _userService.UpdateUserAsync("user-2", updateDto, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Null(result.AvatarUrl);
        Assert.Null(existingUser.AvatarUrl);
    }

    [Fact]
    public async Task UpdateUserAsync_NormalizesEmptyStoreIdToNull()
    {
        var existingUser = new User
        {
            Id = "user-3",
            Username = "admin_user",
            Email = "admin@test.com",
            Name = "Admin",
            StoreId = "507f1f77bcf86cd799439011",
            StoreName = "Tienda Centro"
        };

        _userRepoMock.Setup(r => r.GetByIdAsync("user-3", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        var updateDto = new UpdateUserDto(
            StoreId: "");

        var result = await _userService.UpdateUserAsync("user-3", updateDto, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Null(result.StoreId);
        Assert.Null(existingUser.StoreId);
        Assert.Null(existingUser.StoreName);
    }
}

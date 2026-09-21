using Moq;
using Ordina.Application.Common;
using Ordina.Application.Security;
using Ordina.Domain.Security;
using Xunit;

namespace Ordina.Application.Tests;

public class NavigationSettingsServiceTests
{
    private readonly Mock<IRepository<NavigationSettings>> _repoMock = new();
    private readonly NavigationSettingsService _service;

    public NavigationSettingsServiceTests()
    {
        _service = new NavigationSettingsService(_repoMock.Object);
    }

    [Fact]
    public async Task GetSettingsAsync_ReturnsEmptyList_WhenNoDocumentExists()
    {
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<NavigationSettings>());

        var result = await _service.GetSettingsAsync();

        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetSettingsAsync_ReturnsStoredItems_WhenDocumentExists()
    {
        var existing = new NavigationSettings
        {
            Items = new List<NavigationItemSetting>
            {
                new() { Id = "analytics", Active = true, SuperAdminOnly = true, AllowedRoles = new() { "Super Administrator" } }
            }
        };
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<NavigationSettings> { existing });

        var result = await _service.GetSettingsAsync();

        Assert.Single(result);
        Assert.Equal("analytics", result[0].Id);
        Assert.True(result[0].SuperAdminOnly);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Administrator")]
    [InlineData("Supervisor")]
    [InlineData("Store Seller")]
    public async Task UpdateSettingsAsync_ThrowsUnauthorized_WhenUserIsNotSuperAdmin(string? nonSuperAdminRole)
    {
        var items = new List<NavigationItemSetting>
        {
            new() { Id = "analytics", Active = true }
        };

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.UpdateSettingsAsync(items, nonSuperAdminRole));
    }

    [Fact]
    public async Task UpdateSettingsAsync_CreatesNewSettings_WhenSuperAdmin_AndNoneExist()
    {
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<NavigationSettings>());

        var items = new List<NavigationItemSetting>
        {
            new() { Id = "analytics", Active = true, SuperAdminOnly = true }
        };

        var result = await _service.UpdateSettingsAsync(items, "Super Administrator");

        Assert.Single(result);
        Assert.Equal("analytics", result[0].Id);
        _repoMock.Verify(r => r.AddAsync(It.Is<NavigationSettings>(s => s.Items.Count == 1), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateSettingsAsync_UpdatesExistingSettings_WhenSuperAdmin()
    {
        var existing = new NavigationSettings
        {
            Id = "507f1f77bcf86cd799439011",
            Items = new List<NavigationItemSetting>()
        };
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<NavigationSettings> { existing });

        var items = new List<NavigationItemSetting>
        {
            new() { Id = "analytics", Active = true, SuperAdminOnly = false, AllowedRoles = new() { "Super Administrator", "Administrator" } }
        };

        var result = await _service.UpdateSettingsAsync(items, "Super Administrator");

        Assert.Single(result);
        Assert.Equal(2, result[0].AllowedRoles.Count);
        _repoMock.Verify(r => r.UpdateAsync(It.Is<NavigationSettings>(s => s.Items.Count == 1), It.IsAny<CancellationToken>()), Times.Once);
    }
}

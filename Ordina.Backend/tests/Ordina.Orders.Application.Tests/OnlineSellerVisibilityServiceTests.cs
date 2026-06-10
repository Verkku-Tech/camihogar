using Microsoft.Extensions.Caching.Memory;
using Ordina.Database.Entities.User;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.OnlineSeller;

namespace Ordina.Orders.Application.Tests;

public class OnlineSellerVisibilityServiceTests
{
    [Fact]
    public async Task GetOnlineSellerUserIdsAsync_ReturnsOnlyOnlineSellerRoles()
    {
        var users = new List<User>
        {
            new() { Id = "online-1", Role = "Online Seller", Username = "a" },
            new() { Id = "online-2", Role = "Vendedor Online", Username = "b" },
            new() { Id = "store-1", Role = "Store Seller", Username = "c" },
            new() { Id = "admin-1", Role = "Administrator", Username = "d" },
        };

        var service = new OnlineSellerVisibilityService(
            new FakeUserRepository(users),
            new MemoryCache(new MemoryCacheOptions()));

        var ids = await service.GetOnlineSellerUserIdsAsync();

        Assert.Equal(2, ids.Count);
        Assert.Contains("online-1", ids);
        Assert.Contains("online-2", ids);
        Assert.DoesNotContain("store-1", ids);
    }

    [Fact]
    public async Task ResolveTeamFilterIdsAsync_WhenCallerIsOnlineSeller_ReturnsTeamIds()
    {
        var users = new List<User>
        {
            new() { Id = "online-1", Role = "Online Seller", Username = "a" },
        };

        var service = new OnlineSellerVisibilityService(
            new FakeUserRepository(users),
            new MemoryCache(new MemoryCacheOptions()));

        var filter = await service.ResolveTeamFilterIdsAsync("Online Seller");

        Assert.NotNull(filter);
        Assert.Single(filter!);
        Assert.Equal("online-1", filter!.First());
    }

    [Fact]
    public async Task ResolveTeamFilterIdsAsync_WhenCallerIsNotOnlineSeller_ReturnsNull()
    {
        var service = new OnlineSellerVisibilityService(
            new FakeUserRepository([]),
            new MemoryCache(new MemoryCacheOptions()));

        var filter = await service.ResolveTeamFilterIdsAsync("Store Seller");

        Assert.Null(filter);
    }

    private sealed class FakeUserRepository(IReadOnlyList<User> users) : IUserRepository
    {
        public Task<User?> GetByIdAsync(string id) =>
            Task.FromResult(users.FirstOrDefault(u => u.Id == id));

        public Task<IEnumerable<User>> GetAllAsync() =>
            Task.FromResult<IEnumerable<User>>(users);

        public Task<User?> GetByUsernameAsync(string username) =>
            Task.FromResult(users.FirstOrDefault(u => u.Username == username));

        public Task<User?> GetByEmailAsync(string email) =>
            Task.FromResult<User?>(null);

        public Task<User?> GetByUsernameOrEmailAsync(string usernameOrEmail) =>
            Task.FromResult<User?>(null);

        public Task<IEnumerable<User>> GetByStatusAsync(string status) =>
            Task.FromResult(users.Where(u => u.Status == status));

        public Task<User> CreateAsync(User user) => throw new NotSupportedException();

        public Task<User> UpdateAsync(User user) => throw new NotSupportedException();

        public Task<bool> DeleteAsync(string id) => throw new NotSupportedException();

        public Task<bool> ExistsAsync(string id) =>
            Task.FromResult(users.Any(u => u.Id == id));
    }
}

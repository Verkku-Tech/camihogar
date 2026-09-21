using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Notifications;
using Ordina.Domain.Notifications;
using Xunit;

namespace Ordina.Application.Tests;

public class NotificationServiceTests
{
    private readonly Mock<INotificationRepository> _mockRepo;
    private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
    private readonly Mock<IServiceScope> _mockScope;
    private readonly Mock<IServiceProvider> _mockServiceProvider;
    private readonly Mock<ILogger<NotificationService>> _mockLogger;
    private readonly NotificationService _service;

    public NotificationServiceTests()
    {
        _mockRepo = new Mock<INotificationRepository>();
        _mockScopeFactory = new Mock<IServiceScopeFactory>();
        _mockScope = new Mock<IServiceScope>();
        _mockServiceProvider = new Mock<IServiceProvider>();
        _mockLogger = new Mock<ILogger<NotificationService>>();

        _mockScopeFactory.Setup(f => f.CreateScope()).Returns(_mockScope.Object);
        _mockScope.Setup(s => s.ServiceProvider).Returns(_mockServiceProvider.Object);
        _mockServiceProvider.Setup(p => p.GetService(typeof(INotificationRepository))).Returns(_mockRepo.Object);

        _mockRepo.Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        _service = new NotificationService(_mockScopeFactory.Object, _mockLogger.Object);
    }

    [Fact]
    public async Task PublishAsync_PersistsNotificationAndReturnsDto()
    {
        var dto = new CreateNotificationDto(
            Type: "ExchangeRateChanged",
            Title: "Tasa actualizada",
            Message: "1 USD = 50.00 VES",
            Severity: "info",
            Link: "/configuracion/tasas");

        var result = await _service.PublishAsync(dto);

        Assert.NotNull(result);
        Assert.Equal("ExchangeRateChanged", result.Type);
        Assert.Equal("Tasa actualizada", result.Title);
        Assert.False(result.IsRead);
        _mockRepo.Verify(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SubscribeAsync_ReceivesMatchingBroadcastNotification()
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        var enumerator = _service.SubscribeAsync("user123", new[] { "Administrator" }, cts.Token).GetAsyncEnumerator(cts.Token);

        // Advance to establish subscription
        var moveNextTask = enumerator.MoveNextAsync();

        // Publish broadcast notification
        await _service.PublishAsync(new CreateNotificationDto(
            Type: "ExchangeRateChanged",
            Title: "Broadcast",
            Message: "Todos la ven",
            Severity: "info"));

        var hasItem = await moveNextTask;
        Assert.True(hasItem);
        Assert.Equal("Broadcast", enumerator.Current.Title);
    }

    [Fact]
    public async Task GetUserNotificationsAsync_PassesSkipAndLimit()
    {
        _mockRepo.Setup(r => r.GetForUserAsync("u1", It.IsAny<IEnumerable<string>>(), 10, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Notification>());

        var result = await _service.GetUserNotificationsAsync("u1", new[] { "Admin" }, skip: 10, limit: 10);

        Assert.NotNull(result);
        _mockRepo.Verify(r => r.GetForUserAsync("u1", It.IsAny<IEnumerable<string>>(), 10, 10, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_CallsRepository()
    {
        _mockRepo.Setup(r => r.DeleteAsync("notif-1", "u1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await _service.DeleteAsync("notif-1", "u1");

        Assert.True(result);
        _mockRepo.Verify(r => r.DeleteAsync("notif-1", "u1", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAllAsync_CallsRepository()
    {
        _mockRepo.Setup(r => r.DeleteAllAsync("u1", It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await _service.DeleteAllAsync("u1", new[] { "Admin" });

        Assert.True(result);
        _mockRepo.Verify(r => r.DeleteAllAsync("u1", It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}

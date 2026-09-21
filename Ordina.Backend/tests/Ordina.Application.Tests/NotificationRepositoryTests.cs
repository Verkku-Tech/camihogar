using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Domain.Notifications;
using Xunit;

namespace Ordina.Application.Tests;

public class NotificationRepositoryTests
{
    [Fact]
    public void Notification_Initialization_SetsDefaults()
    {
        var notification = new Notification
        {
            Type = "ExchangeRateChanged",
            Title = "Tasa actualizada",
            Message = "Nueva tasa USD",
            Severity = "info"
        };

        Assert.NotNull(notification.Id);
        Assert.True(ObjectId.TryParse(notification.Id, out _));
        Assert.Equal("info", notification.Severity);
        Assert.Empty(notification.TargetRoles);
        Assert.Empty(notification.ReadByUserIds);
        Assert.Empty(notification.DeletedByUserIds);
    }
}

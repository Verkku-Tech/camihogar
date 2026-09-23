using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Support;
using Ordina.Domain.Support;
using Xunit;

namespace Ordina.Application.Tests;

public class SupportServiceTests
{
    private readonly Mock<IRepository<SupportTicket>> _ticketRepoMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILogger<SupportService>> _loggerMock;

    public SupportServiceTests()
    {
        _ticketRepoMock = new Mock<IRepository<SupportTicket>>();
        _emailServiceMock = new Mock<IEmailService>();
        _loggerMock = new Mock<ILogger<SupportService>>();

        _ticketRepoMock.Setup(r => r.AddAsync(It.IsAny<SupportTicket>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SupportTicket t, CancellationToken _) => t);

        _emailServiceMock.Setup(e => e.SendSupportNotificationAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
    }

    [Fact]
    public async Task CreateTicketAsync_PersistsTicket_AndDispatchesEmailToVerkkuTech()
    {
        var service = new SupportService(
            _ticketRepoMock.Object,
            _emailServiceMock.Object,
            _loggerMock.Object);

        var dto = new CreateSupportTicketDto(
            Category: "system_error",
            Priority: "high",
            Subject: "Error en pago",
            Description: "No se guardó el abono",
            CurrentUrl: "/pedidos/123",
            ClientInfo: "Chrome 120"
        );

        var userContext = new SupportCurrentUserContext(
            UserId: "user-1",
            UserName: "Juan Perez",
            UserEmail: "juan@camihogar.com",
            UserRole: "Vendedor",
            StoreId: "store-1",
            StoreName: "Guatire"
        );

        var result = await service.CreateTicketAsync(dto, userContext);

        Assert.NotNull(result);
        Assert.StartsWith("TCK-", result.TicketCode);
        Assert.True(result.EmailSent);
        _ticketRepoMock.Verify(r => r.AddAsync(It.Is<SupportTicket>(t =>
            t.Subject == dto.Subject &&
            t.UserId == userContext.UserId &&
            t.StoreName == "Guatire"
        ), It.IsAny<CancellationToken>()), Times.Once);

        _emailServiceMock.Verify(e => e.SendSupportNotificationAsync(
            It.Is<string>(s => s.StartsWith("[SOPORTE FORGE]") && s.Contains(dto.Subject)),
            It.Is<string>(b => b.Contains("Juan Perez") && b.Contains("abono") && b.Contains("FORGE")),
            It.IsAny<CancellationToken>()
        ), Times.Once);
    }

    [Fact]
    public async Task CreateTicketAsync_WhenEmailFails_StillPersistsTicketSuccessfully()
    {
        _emailServiceMock.Setup(e => e.SendSupportNotificationAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var service = new SupportService(
            _ticketRepoMock.Object,
            _emailServiceMock.Object,
            _loggerMock.Object);

        var dto = new CreateSupportTicketDto(
            Category: "data",
            Priority: "low",
            Subject: "Duda inventario",
            Description: "Stock desfasado",
            CurrentUrl: "/inventario",
            ClientInfo: "Firefox"
        );

        var userContext = new SupportCurrentUserContext(
            UserId: "user-2",
            UserName: "Maria Diaz",
            UserEmail: "maria@camihogar.com",
            UserRole: "Encargado"
        );

        var result = await service.CreateTicketAsync(dto, userContext);

        Assert.NotNull(result);
        Assert.StartsWith("TCK-", result.TicketCode);
        Assert.False(result.EmailSent);
        _ticketRepoMock.Verify(r => r.AddAsync(It.IsAny<SupportTicket>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}

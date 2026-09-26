using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Ordina.Api.Controllers;
using Ordina.Application.Common;
using Ordina.Application.Reports;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Api.Tests;

public class ReportsControllerTests
{
    private readonly Mock<IReportService> _reportServiceMock = new();
    private readonly Mock<IOrderRepository> _orderRepositoryMock = new();

    private ReportsController CreateController()
    {
        var controller = new ReportsController(_reportServiceMock.Object, _orderRepositoryMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext()
        };
        return controller;
    }

    [Fact]
    public async Task GetPaymentsReport_ReturnsOkWithRows()
    {
        // Arrange
        var mockRows = new List<PaymentReportRowDto>
        {
            new()
            {
                Fecha = "2026-09-24",
                Pedido = "ORD-2178",
                Cliente = "Keila Spínola",
                MetodoPago = "Zelle",
                MontoOriginal = 260m,
                MonedaOriginal = "USD",
                MontoBs = null,
                MontoUsd = 260m,
                Cuenta = "zelle@empresa.com",
                Referencia = "Kelly Spínola",
                OrderId = "6ab675186c3368f22479cab4",
                PaymentType = "main",
                PaymentIndex = -1,
                IsConciliated = false
            }
        };

        _reportServiceMock
            .Setup(s => s.GetPaymentsReportDataAsync(
                It.IsAny<DateTime?>(),
                It.IsAny<DateTime?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockRows);

        var controller = CreateController();

        // Act
        var result = await controller.GetPaymentsReport(
            startDate: DateTime.UtcNow.AddDays(-1),
            endDate: DateTime.UtcNow,
            cancellationToken: CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var rows = Assert.IsAssignableFrom<IReadOnlyList<PaymentReportRowDto>>(okResult.Value);
        Assert.Single(rows);
        Assert.Equal("ORD-2178", rows[0].Pedido);
        Assert.Equal("Zelle", rows[0].MetodoPago);
    }

    [Fact]
    public async Task DownloadManufacturingReportExcel_ReturnsFileResultWithNombreReporteDateFormat()
    {
        // Arrange
        var fakeBytes = new byte[] { 1, 2, 3, 4 };
        _reportServiceMock
            .Setup(s => s.GenerateManufacturingReportExcelAsync(
                It.IsAny<DateTime?>(),
                It.IsAny<DateTime?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(fakeBytes);

        var controller = CreateController();

        // Act
        var result = await controller.DownloadManufacturingReportExcel(
            cancellationToken: CancellationToken.None);

        // Assert
        var fileResult = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileResult.ContentType);
        var expectedDate = DateTime.UtcNow.ToString("dd-MM-yyyy");
        Assert.Equal($"attachment; filename=\"ReporteFabricacion_{expectedDate}.xlsx\"", controller.Response.Headers.ContentDisposition.ToString());
    }
}

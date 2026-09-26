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

namespace Ordina.Api.Tests.Controllers;

public class ReportsControllerCommissionTests
{
    private readonly Mock<IReportService> _reportServiceMock = new();
    private readonly Mock<IOrderRepository> _orderRepoMock = new();

    private ReportsController CreateController()
    {
        return new ReportsController(_reportServiceMock.Object, _orderRepoMock.Object);
    }

    [Fact]
    public async Task GetCommissionsReport_PassesAllFilterParametersToService()
    {
        // Arrange
        var testFrom = new DateTime(2026, 9, 1);
        var testTo = new DateTime(2026, 9, 26);
        var expectedRows = new List<CommissionReportRowDto>
        {
            new()
            {
                Pedido = "PED-123",
                Vendedor = "Carlos",
                Comision = 15.0m
            }
        };

        _reportServiceMock
            .Setup(s => s.GetCommissionReportAsync(
                testFrom,
                testTo,
                "v-1",
                "store-1",
                "store",
                "ref-1",
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedRows);

        var controller = CreateController();

        // Act
        var result = await controller.GetCommissionsReport(
            from: testFrom,
            to: testTo,
            vendorId: "v-1",
            storeId: "store-1",
            sellerType: "store",
            referrerId: "ref-1",
            cancellationToken: CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var rows = Assert.IsAssignableFrom<IReadOnlyList<CommissionReportRowDto>>(okResult.Value);
        Assert.Single(rows);
        Assert.Equal("PED-123", rows[0].Pedido);

        _reportServiceMock.Verify(s => s.GetCommissionReportAsync(
            testFrom,
            testTo,
            "v-1",
            "store-1",
            "store",
            "ref-1",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetCommissionReferrers_CallsReportServiceWithDateRange()
    {
        // Arrange
        var testStart = new DateTime(2026, 9, 1);
        var testEnd = new DateTime(2026, 9, 26);
        var expectedReferrers = new List<CommissionReferrerOptionDto>
        {
            new() { Id = "ref-1", Name = "Maria Referido" }
        };

        _reportServiceMock
            .Setup(s => s.GetCommissionReferrersInRangeAsync(testStart, testEnd, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedReferrers);

        var controller = CreateController();

        // Act
        var result = await controller.GetCommissionReferrers(
            startDate: testStart,
            endDate: testEnd,
            cancellationToken: CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsAssignableFrom<IReadOnlyList<CommissionReferrerOptionDto>>(okResult.Value);
        Assert.Single(list);
        Assert.Equal("Maria Referido", list[0].Name);

        _reportServiceMock.Verify(s => s.GetCommissionReferrersInRangeAsync(
            testStart,
            testEnd,
            It.IsAny<CancellationToken>()), Times.Once);
    }
}

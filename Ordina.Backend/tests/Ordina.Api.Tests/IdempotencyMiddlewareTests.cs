using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Api.Middleware;
using Ordina.Application.Common;
using Ordina.Domain.Common;
using Xunit;

namespace Ordina.Api.Tests;

public class IdempotencyMiddlewareTests
{
    private readonly Mock<ILogger<IdempotencyMiddleware>> _loggerMock = new();
    private readonly Mock<IIdempotencyRepository> _repoMock = new();

    [Fact]
    public async Task InvokeAsync_WhenDuplicateMutationId_ReturnsCachedResponseAndDoesNotCallNext()
    {
        // Arrange
        var mutationId = "test-mutation-uuid-123";
        var existingRecord = new IdempotencyRecord
        {
            MutationId = mutationId,
            HttpMethod = "POST",
            Endpoint = "/api/orders",
            ResponseStatusCode = 201,
            ResponseBody = "{\"orderNumber\":\"ORD-001\"}",
            CreatedAt = System.DateTime.UtcNow
        };

        _repoMock.Setup(r => r.GetByMutationIdAsync(mutationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingRecord);

        var nextCalled = false;
        RequestDelegate next = (ctx) =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        };

        var middleware = new IdempotencyMiddleware(next, _loggerMock.Object);

        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/api/orders";
        context.Request.Headers["X-Mutation-Id"] = mutationId;
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context, _repoMock.Object);

        // Assert
        Assert.False(nextCalled, "The next delegate should NOT be called for a duplicate mutation ID.");
        Assert.Equal(201, context.Response.StatusCode);
        Assert.Equal("true", context.Response.Headers["X-Idempotent-Replay"].ToString());

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var responseText = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Equal(existingRecord.ResponseBody, responseText);
    }

    [Fact]
    public async Task InvokeAsync_WhenNewMutationId_ExecutesNextAndSavesRecord()
    {
        // Arrange
        var mutationId = "new-mutation-uuid-456";

        _repoMock.Setup(r => r.GetByMutationIdAsync(mutationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((IdempotencyRecord?)null);

        var nextCalled = false;
        RequestDelegate next = async (ctx) =>
        {
            nextCalled = true;
            ctx.Response.StatusCode = 200;
            await ctx.Response.WriteAsync("{\"status\":\"ok\"}");
        };

        var middleware = new IdempotencyMiddleware(next, _loggerMock.Object);

        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/api/orders";
        context.Request.Headers["X-Mutation-Id"] = mutationId;
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context, _repoMock.Object);

        // Assert
        Assert.True(nextCalled, "The next delegate should be called for a new mutation ID.");
        Assert.Equal(200, context.Response.StatusCode);

        _repoMock.Verify(r => r.SaveAsync(It.Is<IdempotencyRecord>(rec =>
            rec.MutationId == mutationId &&
            rec.ResponseStatusCode == 200 &&
            rec.ResponseBody == "{\"status\":\"ok\"}"), It.IsAny<CancellationToken>()), Times.Once);
    }
}

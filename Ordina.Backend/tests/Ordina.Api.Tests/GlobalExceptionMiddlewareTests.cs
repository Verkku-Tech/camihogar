using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Api.Middleware;
using Xunit;

namespace Ordina.Api.Tests;

public class GlobalExceptionMiddlewareTests
{
    private readonly Mock<ILogger<GlobalExceptionMiddleware>> _loggerMock = new();

    [Fact]
    public async Task InvokeAsync_MapsConcurrencyConflict_To409Conflict()
    {
        // Arrange
        RequestDelegate next = (ctx) =>
            throw new InvalidOperationException("Concurrency conflict: The entity has been modified by another process.");

        var middleware = new GlobalExceptionMiddleware(next, _loggerMock.Object);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(409, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Contains("409", body);
        Assert.Contains("Concurrency conflict", body);
    }

    [Fact]
    public async Task InvokeAsync_MapsKeyNotFound_To404NotFound()
    {
        // Arrange
        RequestDelegate next = (ctx) =>
            throw new KeyNotFoundException("Order with id 123 was not found.");

        var middleware = new GlobalExceptionMiddleware(next, _loggerMock.Object);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(404, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Contains("404", body);
        Assert.Contains("Order with id 123 was not found", body);
    }

    [Fact]
    public async Task InvokeAsync_MapsUnauthorizedAccess_To401Unauthorized()
    {
        // Arrange
        RequestDelegate next = (ctx) =>
            throw new UnauthorizedAccessException("Credenciales inválidas.");

        var middleware = new GlobalExceptionMiddleware(next, _loggerMock.Object);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(401, context.Response.StatusCode);
    }
}

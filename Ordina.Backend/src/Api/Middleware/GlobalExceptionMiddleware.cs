using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Ordina.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred while processing {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var statusCode = HttpStatusCode.InternalServerError;
        var message = "An unexpected error occurred.";

        switch (exception)
        {
            case InvalidOperationException ex when ex.Message.Contains("Concurrency conflict", StringComparison.OrdinalIgnoreCase) 
                                               || ex.Message.StartsWith("CONFLICT:", StringComparison.OrdinalIgnoreCase)
                                               || ex.Message.Contains("modificado por otro", StringComparison.OrdinalIgnoreCase):
                statusCode = HttpStatusCode.Conflict;
                message = ex.Message;
                break;
            case InvalidOperationException ex:
                statusCode = HttpStatusCode.BadRequest;
                message = ex.Message;
                break;
            case KeyNotFoundException ex:
                statusCode = HttpStatusCode.NotFound;
                message = ex.Message;
                break;
            case UnauthorizedAccessException ex:
                statusCode = HttpStatusCode.Unauthorized;
                message = string.IsNullOrWhiteSpace(ex.Message) ? "Unauthorized access." : ex.Message;
                break;
            case ArgumentException ex:
                statusCode = HttpStatusCode.BadRequest;
                message = ex.Message;
                break;
            default:
                message = exception.Message;
                break;
        }

        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.StatusCode = (int)statusCode;

        var response = new
        {
            statusCode = (int)statusCode,
            message,
            error = exception.GetType().Name,
            timestamp = DateTime.UtcNow
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}

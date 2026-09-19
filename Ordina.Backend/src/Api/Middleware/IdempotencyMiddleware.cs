using System.IO;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Domain.Common;

namespace Ordina.Api.Middleware;

public class IdempotencyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<IdempotencyMiddleware> _logger;

    public IdempotencyMiddleware(RequestDelegate next, ILogger<IdempotencyMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IIdempotencyRepository idempotencyRepo)
    {
        var method = context.Request.Method;
        if (!HttpMethods.IsPost(method) &&
            !HttpMethods.IsPut(method) &&
            !HttpMethods.IsPatch(method) &&
            !HttpMethods.IsDelete(method))
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue("X-Mutation-Id", out var mutationIdValues) ||
            string.IsNullOrWhiteSpace(mutationIdValues.ToString()))
        {
            await _next(context);
            return;
        }

        var mutationId = mutationIdValues.ToString().Trim();
        var cancellationToken = context.RequestAborted;

        var existing = await idempotencyRepo.GetByMutationIdAsync(mutationId, cancellationToken);
        if (existing != null)
        {
            _logger.LogInformation("Idempotency match found for MutationId {MutationId}. Returning cached response.", mutationId);
            context.Response.StatusCode = existing.ResponseStatusCode;
            context.Response.Headers["X-Idempotent-Replay"] = "true";

            if (!string.IsNullOrEmpty(existing.ResponseBody))
            {
                context.Response.ContentType = "application/json; charset=utf-8";
                await context.Response.WriteAsync(existing.ResponseBody, cancellationToken);
            }
            return;
        }

        var originalBodyStream = context.Response.Body;
        using var responseBody = new MemoryStream();
        context.Response.Body = responseBody;

        try
        {
            await _next(context);

            responseBody.Seek(0, SeekOrigin.Begin);
            string responseText = await new StreamReader(responseBody, Encoding.UTF8).ReadToEndAsync(cancellationToken);
            responseBody.Seek(0, SeekOrigin.Begin);

            if (context.Response.StatusCode < 500)
            {
                var record = new IdempotencyRecord
                {
                    MutationId = mutationId,
                    HttpMethod = context.Request.Method,
                    Endpoint = context.Request.Path,
                    ResponseStatusCode = context.Response.StatusCode,
                    ResponseBody = responseText,
                    CreatedAt = DateTime.UtcNow
                };

                await idempotencyRepo.SaveAsync(record, cancellationToken);
            }

            await responseBody.CopyToAsync(originalBodyStream, cancellationToken);
        }
        finally
        {
            context.Response.Body = originalBodyStream;
        }
    }
}

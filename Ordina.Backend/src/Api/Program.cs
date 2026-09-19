using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Ordina.Api.Middleware;
using Ordina.Application;
using Ordina.Infrastructure;
using Ordina.Infrastructure.Mongo;

var builder = WebApplication.CreateBuilder(args);

// 1. OpenTelemetry Logging, Tracing & Metrics (Aspire Dashboard)
var otelEndpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]
                   ?? Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT")
                   ?? "http://aspire-dashboard:4317";

builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(
        serviceName: "Ordina.Api",
        serviceVersion: "1.0.0"))
    .WithTracing(tracing =>
    {
        tracing.AddAspNetCoreInstrumentation()
               .AddHttpClientInstrumentation();
        if (!string.IsNullOrEmpty(otelEndpoint))
        {
            tracing.AddOtlpExporter(opt => opt.Endpoint = new Uri(otelEndpoint));
        }
    })
    .WithMetrics(metrics =>
    {
        metrics.AddAspNetCoreInstrumentation()
               .AddHttpClientInstrumentation()
               .AddRuntimeInstrumentation();
        if (!string.IsNullOrEmpty(otelEndpoint))
        {
            metrics.AddOtlpExporter(opt => opt.Endpoint = new Uri(otelEndpoint));
        }
    });

builder.Logging.AddOpenTelemetry(logging =>
{
    logging.IncludeFormattedMessage = true;
    logging.IncludeScopes = true;
    if (!string.IsNullOrEmpty(otelEndpoint))
    {
        logging.AddOtlpExporter(opt => opt.Endpoint = new Uri(otelEndpoint));
    }
});

// 2. Add API Controllers & JSON configuration
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// 3. Response Compression (Brotli & Gzip)
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

// 4. Rate Limiting Policies
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 15,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy("telemetry", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

// 5. JWT Authentication & Authorization
var jwtKey = builder.Configuration["Jwt:SecretKey"] ?? "OrdinaSuperSecretKeyForDevelopmentMustBeAtLeast32CharsLong!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "OrdinaApi";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "OrdinaClients";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// 6. CORS Policy
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? new[] { "http://localhost:5173", "http://localhost:4173", "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowConfiguredOrigins", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .WithExposedHeaders("X-Idempotent-Replay", "X-Mutation-Id");
    });
});

// 7. Register Application & Infrastructure layers (100% MongoDB)
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

// 8. Pipeline configuration
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();

app.UseResponseCompression();

app.UseRouting();
app.UseCors("AllowConfiguredOrigins");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.UseMiddleware<IdempotencyMiddleware>();

app.MapControllers();

app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    service = "Ordina.Api",
    runtime = Environment.Version.ToString(),
    timestamp = DateTime.UtcNow
}));

// 9. Startup initialization (Indexes & Seeder)
using (var scope = app.Services.CreateScope())
{
    try
    {
        var indexManager = scope.ServiceProvider.GetRequiredService<IndexManager>();
        await indexManager.EnsureIndexesAsync();

        var seeder = scope.ServiceProvider.GetRequiredService<MongoDatabaseSeeder>();
        await seeder.SeedAsync();
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "MongoDB initialization skipped or deferred: {Message}", ex.Message);
    }
}

app.Run();

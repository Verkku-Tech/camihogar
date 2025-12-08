using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire components.
builder.AddServiceDefaults();

// Add services to the container.
builder.Services.AddProblemDetails();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        // Obtener URLs permitidas desde variable de entorno o configuración
        var allowedOriginsEnv = builder.Configuration["AllowedUrls"];
        string[] allowedOrigins;
        
        if (!string.IsNullOrEmpty(allowedOriginsEnv))
        {
            // Si existe la variable de entorno, usar esa (formato: "url1,url2,url3")
            allowedOrigins = allowedOriginsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(url => url.Trim())
                .ToArray();
        }
        else
        {
            // Si no, usar configuración desde appsettings.json
            allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
                ?? new[] 
                { 
                    "http://localhost:3000", 
                    "https://localhost:3000",
                    "http://camihogar.verkku.com",
                    "https://camihogar.verkku.com",
                    "http://48.217.223.103:3000",
                    "http://camihogar.eastus.cloudapp.azure.com:3000"
                };
        }
        
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Add controllers for API Gateway functionality
builder.Services.AddControllers();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "Ordina API Gateway", 
        Version = "v1",
        Description = "Gateway principal para todas las APIs del sistema Ordina"
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

// Enable CORS
app.UseCors("AllowFrontend");

// Enable Swagger in all environments
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Ordina API Gateway v1");
        c.RoutePrefix = "swagger";
        c.DocumentTitle = "Ordina API Gateway";
    });
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapDefaultEndpoints();

// Service Discovery Endpoint
//app.MapGet("/", () => 
//{
//    return Results.Content("""
//        <html>
//        <head>
//            <title>Ordina API Gateway</title>
//            <style>
//                body { font-family: Arial, sans-serif; margin: 40px; }
//                .service { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
//                .service h3 { margin-top: 0; color: #333; }
//                .service a { color: #007bff; text-decoration: none; }
//                .service a:hover { text-decoration: underline; }
//                .admin-tools { background: #e8f4f8; }
//                .apis { background: #f8f9fa; }
//            </style>
//        </head>
//        <body>
//            <h1>🚀 Ordina API Gateway</h1>
//            <p>Bienvenido al sistema de microservicios Ordina</p>
            
//            <h2>📊 Herramientas de Administración</h2>
//            <div class="service admin-tools">
//                <h3>🐘 pgAdmin</h3>
//                <p>Administrador de base de datos PostgreSQL</p>
//                <a href="http://localhost:5050" target="_blank">🔗 Acceder a pgAdmin</a>
//                <p><small>Email: admin@ordina.com | Password: OrdinaPassword123!</small></p>
//            </div>
            
//            <div class="service admin-tools">
//                <h3>⚡ Supabase Studio</h3>
//                <p>Interfaz de administración de Supabase</p>
//                <a href="http://localhost:3000" target="_blank">🔗 Acceder a Supabase Studio</a>
//            </div>
            
//            <h2>🛠️ APIs y Documentación</h2>
//            <div class="service apis">
//                <h3>🌐 API Gateway</h3>
//                <p>Documentación principal del gateway</p>
//                <a href="/swagger" target="_blank">📋 Ver Swagger Documentation</a>
//            </div>
            
//            <div class="service apis">
//                <h3>🔐 Security API</h3>
//                <p>Gestión de roles, permisos y seguridad</p>
//                <a href="http://localhost:5000/swagger" target="_blank">📋 Ver Swagger Documentation</a>
//            </div>
            
//            <div class="service apis">
//                <h3>👥 Users API</h3>
//                <p>Gestión de usuarios y perfiles</p>
//                <a href="http://localhost:5001/swagger" target="_blank">📋 Ver Swagger Documentation</a>
//            </div>
            
//            <div class="service apis">
//                <h3>🏪 Providers API</h3>
//                <p>Gestión de proveedores y productos</p>
//                <a href="http://localhost:5002/swagger" target="_blank">📋 Ver Swagger Documentation</a>
//            </div>
            
//            <div class="service apis">
//                <h3>📦 Orders API</h3>
//                <p>Gestión de pedidos y órdenes</p>
//                <a href="http://localhost:5003/swagger" target="_blank">📋 Ver Swagger Documentation</a>
//            </div>
            
//            <div class="service apis">
//                <h3>💳 Payments API</h3>
//                <p>Gestión de pagos y métodos de pago</p>
//                <a href="http://localhost:5004/swagger" target="_blank">📋 Ver Swagger Documentation</a>
//            </div>
            
//            <p><small>Sistema desarrollado con .NET 9 + Aspire + Supabase</small></p>
//        </body>
//        </html>
//    """, "text/html");
//})
//.WithName("ServiceIndex")
//.WithOpenApi();

// Sample endpoint for testing
var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

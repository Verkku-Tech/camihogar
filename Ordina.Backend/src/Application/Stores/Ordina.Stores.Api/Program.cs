using Ordina.Database.MongoContext;
using Ordina.Stores.Application;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire components.
builder.AddServiceDefaults();

// Add services to the container.
builder.Services.AddProblemDetails();

// Configure MongoDB
builder.Services.AddMongoDb(builder.Configuration);

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

// Add Application Services
builder.Services.AddStoreServices();

// Add controllers
builder.Services.AddControllers();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Ordina Stores API",
        Version = "v1",
        Description = "API para la gestión de tiendas y cuentas bancarias en el sistema Ordina"
    });
});

var app = builder.Build();

// Initialize MongoDB (create indexes and seed data)
await using (var scope = app.Services.CreateAsyncScope())
{
    var context = scope.ServiceProvider.GetRequiredService<MongoDbContext>();
    await context.InitializeAsync();
}

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

// Enable CORS - DEBE estar antes de UseAuthorization
app.UseCors("AllowFrontend");

// Enable Swagger in all environments
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Ordina Stores API v1");
    c.RoutePrefix = "swagger";
});

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapDefaultEndpoints();

app.Run();
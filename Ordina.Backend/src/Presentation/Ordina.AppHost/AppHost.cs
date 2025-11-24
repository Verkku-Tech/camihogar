using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// ================================================================
// DATABASE LAYER - Single PostgreSQL Database with Schemas + Supabase
// ================================================================

// PostgreSQL Database - Single database for all microservices (Supabase-compatible)
var postgres = builder.AddPostgres("postgres")
    .WithEnvironment("POSTGRES_DB", "ordina_main")  // Database único
    .WithEnvironment("POSTGRES_USER", "postgres")
    .WithEnvironment("POSTGRES_PASSWORD", "OrdinaPassword123!")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithImage("supabase/postgres")
    .WithImageTag("15.1.0.147");

var ordinaDatabase = postgres.AddDatabase("ordina-main");

// ================================================================
// SUPABASE SERVICES
// ================================================================

// pgAdmin - Database Administration Tool
var pgAdmin = builder.AddContainer("pgadmin", "dpage/pgadmin4")
    .WithImageTag("latest")
    .WithHttpEndpoint(port: 5050, targetPort: 80, name: "pgadmin-ui")
    .WithEnvironment("PGADMIN_DEFAULT_EMAIL", "admin@ordina.com")
    .WithEnvironment("PGADMIN_DEFAULT_PASSWORD", "OrdinaPassword123!")
    .WithEnvironment("PGADMIN_CONFIG_SERVER_MODE", "False")
    .WithReference(postgres);

// Supabase Studio - Web Interface (for full Supabase experience)
// Note: For full Supabase functionality, use docker-compose instead
var supabaseStudio = builder.AddContainer("supabase-studio", "supabase/studio")
    .WithImageTag("20241216-df24b25")
    .WithHttpEndpoint(port: 3000, targetPort: 3000, name: "supabase-ui")
    .WithEnvironment("POSTGRES_PASSWORD", "OrdinaPassword123!")
    .WithReference(postgres);

// ================================================================
// CACHE LAYER
// ================================================================

// Redis Cache
var redis = builder.AddRedis("redis")
    .WithLifetime(ContainerLifetime.Persistent);

// ================================================================
// MICROSERVICES - All using the same database with different schemas
// ================================================================

// Security Service - Schema: security
var securityApi = builder.AddProject<Projects.Ordina_Security_Api>("security-api")
    .WithReference(ordinaDatabase)
    .WithReference(redis)
    .WithEnvironment("ConnectionStrings__DefaultConnection", ordinaDatabase);

// Users Service - Schema: users  
var usersApi = builder.AddProject<Projects.Ordina_Users_Api>("users-api")
    .WithReference(ordinaDatabase)
    .WithReference(redis)
    .WithEnvironment("ConnectionStrings__DefaultConnection", ordinaDatabase);

// Providers Service - Schema: providers
var providersApi = builder.AddProject<Projects.Ordina_Providers_Api>("providers-api")
    .WithReference(ordinaDatabase)
    .WithReference(redis)
    .WithEnvironment("ConnectionStrings__DefaultConnection", ordinaDatabase);

// Orders Service - Schema: orders
var ordersApi = builder.AddProject<Projects.Ordina_Orders_Api>("orders-api")
    .WithReference(ordinaDatabase)
    .WithReference(redis)
    .WithEnvironment("ConnectionStrings__DefaultConnection", ordinaDatabase);

// Payments Service - Schema: payments
var paymentsApi = builder.AddProject<Projects.Ordina_Payments_Api>("payments-api")
    .WithReference(ordinaDatabase)
    .WithReference(redis)
    .WithEnvironment("ConnectionStrings__DefaultConnection", ordinaDatabase);

// ================================================================
// API GATEWAY LAYER
// ================================================================

// API Gateway - Entry point for all services
var apiGateway = builder.AddProject<Projects.Ordina_ApiGateway>("api-gateway")
    .WithReference(securityApi)
    .WithReference(usersApi)
    .WithReference(providersApi)
    .WithReference(ordersApi)
    .WithReference(paymentsApi)
    .WithReference(redis);

// ================================================================
// BUILD APPLICATION
// ================================================================

var app = builder.Build();

await app.RunAsync();

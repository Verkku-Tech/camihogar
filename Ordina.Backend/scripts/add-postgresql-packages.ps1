# Script para añadir paquetes de PostgreSQL y Entity Framework Core a todos los proyectos Infrastructure
# Ejecutar desde la raíz del proyecto: .\scripts\add-postgresql-packages.ps1

Write-Host "🔧 Añadiendo paquetes de PostgreSQL y Entity Framework Core..." -ForegroundColor Green

# Lista de proyectos Infrastructure
$infrastructureProjects = @(
    "src/Application/Security/Ordina.Security.Infrastructure/Ordina.Security.Infrastructure.csproj",
    "src/Application/Users/Ordina.Users.Infrastructure/Ordina.Users.Infrastructure.csproj",
    "src/Application/Providers/Ordina.Providers.Infrastructure/Ordina.Providers.Infrastructure.csproj",
    "src/Application/Orders/Ordina.Orders.Infrastructure/Ordina.Orders.Infrastructure.csproj",
    "src/Application/Payments/Ordina.Payments.Infrastructure/Ordina.Payments.Infrastructure.csproj"
)

# Lista de proyectos API
$apiProjects = @(
    "src/Application/Security/Ordina.Security.Api/Ordina.Security.Api.csproj",
    "src/Application/Users/Ordina.Users.Api/Ordina.Users.Api.csproj",
    "src/Application/Providers/Ordina.Providers.Api/Ordina.Providers.Api.csproj",
    "src/Application/Orders/Ordina.Orders.Api/Ordina.Orders.Api.csproj",
    "src/Application/Payments/Ordina.Payments.Api/Ordina.Payments.Api.csproj"
)

# Paquetes necesarios para Entity Framework Core con PostgreSQL
$packages = @(
    "Npgsql.EntityFrameworkCore.PostgreSQL",
    "Microsoft.EntityFrameworkCore",
    "Microsoft.EntityFrameworkCore.Design",
    "Microsoft.EntityFrameworkCore.Tools"
)

# Añadir paquetes a cada proyecto Infrastructure
foreach ($project in $infrastructureProjects) {
    Write-Host "📦 Procesando proyecto: $project" -ForegroundColor Yellow
    
    foreach ($package in $packages) {
        Write-Host "  ➕ Añadiendo $package..." -ForegroundColor Cyan
        dotnet add $project package $package
    }
    
    Write-Host "  ✅ Completado: $project" -ForegroundColor Green
    Write-Host ""
}

# También añadir a AppHost para migraciones
Write-Host "📦 Añadiendo paquetes a AppHost para migraciones..." -ForegroundColor Yellow
dotnet add src/Presentation/Ordina.AppHost/Ordina.AppHost.csproj package Microsoft.EntityFrameworkCore.Tools

Write-Host "🎉 ¡Todos los paquetes de PostgreSQL y EF Core añadidos exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Crear DbContext en cada proyecto Infrastructure" -ForegroundColor White
Write-Host "2. Definir entidades en los proyectos Domain" -ForegroundColor White
Write-Host "3. Configurar servicios en los proyectos API" -ForegroundColor White
Write-Host "4. Crear y aplicar migraciones con:" -ForegroundColor White
Write-Host "   dotnet ef migrations add InitialCreate -p [Infrastructure] -s [API]" -ForegroundColor Gray
Write-Host "   dotnet ef database update -p [Infrastructure] -s [API]" -ForegroundColor Gray

Write-Host "🎯 Agregando referencia ServiceDefaults a APIs..." -ForegroundColor Yellow

foreach ($project in $apiProjects) {
    Write-Host "  → $project" -ForegroundColor Gray
    
    try {
        dotnet add $project reference "src/Infrastructure/Ordina.ServiceDefaults/Ordina.ServiceDefaults.csproj"
        Write-Host "    ✅ ServiceDefaults referenciado" -ForegroundColor Green
    }
    catch {
        Write-Host "    ❌ Error agregando referencia ServiceDefaults" -ForegroundColor Red
    }
}

Write-Host "🔄 Restaurando paquetes..." -ForegroundColor Cyan
dotnet restore

Write-Host "✅ ¡Configuración de PostgreSQL completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Configurar DbContext en cada proyecto Infrastructure" -ForegroundColor White
Write-Host "2. Crear migraciones: dotnet ef migrations add InitialCreate" -ForegroundColor White  
Write-Host "3. Configurar Supabase siguiendo: docs/SUPABASE_SETUP.md" -ForegroundColor White
Write-Host "4. Ejecutar: docker-compose up --build" -ForegroundColor White 
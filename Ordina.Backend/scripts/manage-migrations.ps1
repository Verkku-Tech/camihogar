# ================================================================
# ORDINA - Migration Management Script (Single Database Version)
# ================================================================
# Manejo de migraciones para todos los microservicios con base única
# Database: ordina_main con schemas separados
# 

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("add", "update", "remove", "list", "create-all", "update-all")]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("security", "users", "providers", "orders", "payments", "all")]
    [string]$Service = "all",
    
    [Parameter(Mandatory=$false)]
    [string]$MigrationName = "",

    [Parameter(Mandatory=$false)]
    [string]$ConnectionString = "Host=localhost;Database=ordina_main;Username=postgres;Password=OrdinaPassword123!;Port=5432"
)

# ================================================================
# CONFIGURACIÓN
# ================================================================

$Services = @{
    "security" = @{
        "Name" = "Security"
        "Path" = "src/Application/Security/Ordina.Security.Infrastructure"
        "Context" = "SecurityDbContext"
        "Schema" = "security"
    }
    "users" = @{
        "Name" = "Users"
        "Path" = "src/Application/Users/Ordina.Users.Infrastructure"
        "Context" = "UsersDbContext"
        "Schema" = "users"
    }
    "providers" = @{
        "Name" = "Providers"
        "Path" = "src/Application/Providers/Ordina.Providers.Infrastructure"
        "Context" = "ProvidersDbContext"
        "Schema" = "providers"
    }
    "orders" = @{
        "Name" = "Orders"
        "Path" = "src/Application/Orders/Ordina.Orders.Infrastructure"
        "Context" = "OrdersDbContext"
        "Schema" = "orders"
    }
    "payments" = @{
        "Name" = "Payments"
        "Path" = "src/Application/Payments/Ordina.Payments.Infrastructure"
        "Context" = "PaymentsDbContext"
        "Schema" = "payments"
    }
}

# ================================================================
# FUNCIONES AUXILIARES
# ================================================================

function Write-Header {
    param([string]$Title)
    Write-Host "================================================================" -ForegroundColor Blue
    Write-Host " $Title" -ForegroundColor Blue  
    Write-Host "================================================================" -ForegroundColor Blue
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Test-ServiceExists {
    param([string]$ServiceKey)
    return $Services.ContainsKey($ServiceKey)
}

function Get-ServicePath {
    param([string]$ServiceKey)
    return $Services[$ServiceKey]["Path"]
}

function Get-ServiceContext {
    param([string]$ServiceKey)
    return $Services[$ServiceKey]["Context"]
}

function Get-ServiceSchema {
    param([string]$ServiceKey)
    return $Services[$ServiceKey]["Schema"]
}

# ================================================================
# FUNCIONES DE MIGRACIÓN
# ================================================================

function Add-Migration {
    param([string]$ServiceKey, [string]$MigrationName)
    
    $serviceName = $Services[$ServiceKey]["Name"]
    $servicePath = Get-ServicePath $ServiceKey
    $context = Get-ServiceContext $ServiceKey
    $schema = Get-ServiceSchema $ServiceKey
    
    Write-Info "📦 Agregando migración '$MigrationName' para $serviceName (Schema: $schema)..."
    
    $fullMigrationName = "${serviceName}_${MigrationName}"
    
    try {
        dotnet ef migrations add $fullMigrationName `
            --project $servicePath `
            --context $context `
            --output-dir "Migrations" `
            --verbose
            
        Write-Info "✅ Migración agregada exitosamente para $serviceName"
    }
    catch {
        Write-Error "❌ Error agregando migración para $serviceName : $_"
    }
}

function Update-Database {
    param([string]$ServiceKey)
    
    $serviceName = $Services[$ServiceKey]["Name"]
    $servicePath = Get-ServicePath $ServiceKey
    $context = Get-ServiceContext $ServiceKey
    $schema = Get-ServiceSchema $ServiceKey
    
    Write-Info "🔄 Actualizando base de datos para $serviceName (Schema: $schema)..."
    
    try {
        dotnet ef database update `
            --project $servicePath `
            --context $context `
            --connection $ConnectionString `
            --verbose
            
        Write-Info "✅ Base de datos actualizada exitosamente para $serviceName"
    }
    catch {
        Write-Error "❌ Error actualizando base de datos para $serviceName : $_"
    }
}

function Remove-Migration {
    param([string]$ServiceKey)
    
    $serviceName = $Services[$ServiceKey]["Name"]
    $servicePath = Get-ServicePath $ServiceKey
    $context = Get-ServiceContext $ServiceKey
    
    Write-Warning "⚠️  Removiendo última migración para $serviceName..."
    
    try {
        dotnet ef migrations remove `
            --project $servicePath `
            --context $context `
            --force
            
        Write-Info "✅ Migración removida exitosamente para $serviceName"
    }
    catch {
        Write-Error "❌ Error removiendo migración para $serviceName : $_"
    }
}

function List-Migrations {
    param([string]$ServiceKey)
    
    $serviceName = $Services[$ServiceKey]["Name"]
    $servicePath = Get-ServicePath $ServiceKey
    $context = Get-ServiceContext $ServiceKey
    $schema = Get-ServiceSchema $ServiceKey
    
    Write-Info "📋 Migraciones para $serviceName (Schema: $schema):"
    
    try {
        dotnet ef migrations list `
            --project $servicePath `
            --context $context `
            --connection $ConnectionString
    }
    catch {
        Write-Error "❌ Error listando migraciones para $serviceName : $_"
    }
}

# ================================================================
# LÓGICA PRINCIPAL
# ================================================================

Write-Header "ORDINA - Gestión de Migraciones (Base de Datos Única)"
Write-Info "🗄️  Database: ordina_main"
Write-Info "🔄 Action: $Action"
Write-Info "🎯 Service: $Service"

if ($Service -eq "all") {
    $serviceKeys = $Services.Keys
} else {
    if (-not (Test-ServiceExists $Service)) {
        Write-Error "❌ Servicio '$Service' no reconocido. Servicios disponibles: $($Services.Keys -join ', ')"
        exit 1
    }
    $serviceKeys = @($Service)
}

switch ($Action) {
    "add" {
        if ([string]::IsNullOrEmpty($MigrationName)) {
            Write-Error "❌ Nombre de migración requerido para la acción 'add'"
            exit 1
        }
        
        foreach ($serviceKey in $serviceKeys) {
            Add-Migration $serviceKey $MigrationName
        }
    }
    
    "update" {
        foreach ($serviceKey in $serviceKeys) {
            Update-Database $serviceKey
        }
    }
    
    "remove" {
        foreach ($serviceKey in $serviceKeys) {
            Remove-Migration $serviceKey
        }
    }
    
    "list" {
        foreach ($serviceKey in $serviceKeys) {
            List-Migrations $serviceKey
            Write-Host ""
        }
    }
    
    "create-all" {
        Write-Header "Creando migraciones iniciales para todos los servicios"
        foreach ($serviceKey in $serviceKeys) {
            Add-Migration $serviceKey "InitialCreate"
        }
    }
    
    "update-all" {
        Write-Header "Actualizando base de datos para todos los servicios"
        foreach ($serviceKey in $serviceKeys) {
            Update-Database $serviceKey
        }
    }
}

Write-Header "🎉 Operación completada"

# ================================================================
# EJEMPLOS DE USO
# ================================================================
<#
# Crear migración inicial para todos los servicios
.\manage-migrations.ps1 -Action create-all

# Aplicar todas las migraciones
.\manage-migrations.ps1 -Action update-all

# Agregar migración específica a un servicio
.\manage-migrations.ps1 -Action add -Service users -MigrationName "AddUserProfile"

# Actualizar base de datos para un servicio específico
.\manage-migrations.ps1 -Action update -Service orders

# Listar migraciones de todos los servicios
.\manage-migrations.ps1 -Action list

# Remover última migración de un servicio
.\manage-migrations.ps1 -Action remove -Service payments
#> 
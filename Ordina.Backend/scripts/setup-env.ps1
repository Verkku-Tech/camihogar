# ================================================================
# Setup Environment Variables Script
# ================================================================
# Crea el archivo .env desde el template si no existe

param(
    [switch]$Force,
    [switch]$Help
)

if ($Help) {
    Write-Host "Setup Environment Variables Script" -ForegroundColor Green
    Write-Host "=================================="
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\setup-env.ps1                 # Crear .env si no existe"
    Write-Host "  .\setup-env.ps1 -Force          # Sobrescribir .env existente"
    Write-Host "  .\setup-env.ps1 -Help           # Mostrar esta ayuda"
    Write-Host ""
    exit 0
}

$rootPath = Split-Path -Parent $PSScriptRoot
$templateFile = Join-Path $rootPath "environment-template.txt"
$envFile = Join-Path $rootPath ".env"

Write-Host "🔧 Setup Environment Variables" -ForegroundColor Green
Write-Host "==============================="

# Verificar que existe el template
if (!(Test-Path $templateFile)) {
    Write-Host "❌ Error: Template file not found: $templateFile" -ForegroundColor Red
    exit 1
}

# Verificar si .env ya existe
if ((Test-Path $envFile) -and !$Force) {
    Write-Host "ℹ️  El archivo .env ya existe: $envFile" -ForegroundColor Yellow
    Write-Host "ℹ️  Use -Force para sobrescribir" -ForegroundColor Yellow
    exit 0
}

try {
    # Copiar template a .env
    Copy-Item $templateFile $envFile
    
    Write-Host "✅ Archivo .env creado exitosamente: $envFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Próximos pasos:" -ForegroundColor Cyan
    Write-Host "  1. Editar el archivo .env con tus valores específicos"
    Write-Host "  2. Asegurar que PostgreSQL esté ejecutándose:"
    Write-Host "     docker-compose up -d postgres"
    Write-Host "  3. Ejecutar cualquier API localmente:"
    Write-Host "     dotnet run --project src/Application/Security/Ordina.Security.Api"
    Write-Host ""
    Write-Host "🔍 El archivo .env será cargado automáticamente por todas las APIs" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error al crear .env: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 
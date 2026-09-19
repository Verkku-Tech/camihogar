# =====================================================================
# Script de Ejecución de Análisis SonarQube para Camihogar
# =====================================================================
param(
    [Parameter(Mandatory=$false)]
    [string]$SonarHostUrl = $env:SONAR_HOST_URL,
    
    [Parameter(Mandatory=$false)]
    [string]$SonarToken = $env:SONAR_TOKEN
)

if ([string]::IsNullOrWhiteSpace($SonarHostUrl) -or [string]::IsNullOrWhiteSpace($SonarToken)) {
    Write-Error "Debes proveer -SonarHostUrl y -SonarToken o definirlos como variables de entorno SONAR_HOST_URL y SONAR_TOKEN."
    exit 1
}

Write-Host "=== Iniciando Análisis SonarQube para Camihogar ===" -ForegroundColor Cyan

# 1. Backend: Iniciar Scanner de .NET
Write-Host "-> Iniciando dotnet-sonarscanner..." -ForegroundColor Yellow
dotnet-sonarscanner begin `
  /k:"camihogar-ordina" `
  /d:sonar.host.url="$SonarHostUrl" `
  /d:sonar.token="$SonarToken" `
  /d:sonar.cs.opencover.reportsPaths="Ordina.Backend/tests/**/TestResults/**/coverage.opencover.xml"

# 2. Backend: Compilar y ejecutar pruebas con cobertura
Write-Host "-> Compilando backend y ejecutando pruebas con cobertura..." -ForegroundColor Yellow
dotnet build Ordina.Backend/src/Api/Ordina.Api.csproj -c Release
dotnet test Ordina.Backend/tests/Ordina.Application.Tests --collect:"XPlat Code Coverage"
dotnet test Ordina.Backend/tests/Ordina.Api.Tests --collect:"XPlat Code Coverage"

# 3. Backend: Finalizar y enviar reporte de .NET
Write-Host "-> Finalizando scanner y enviando métricas a SonarQube..." -ForegroundColor Yellow
dotnet-sonarscanner end /d:sonar.token="$SonarToken"

# 4. Frontend: Typecheck, Lint y Tests con Cobertura
Write-Host "-> Ejecutando análisis de Frontend (Bun + Typecheck + Coverage)..." -ForegroundColor Yellow
Set-Location -Path Ordina.Frontend
bun run typecheck
bun run lint
bun test --coverage
Set-Location -Path ..

Write-Host "=== ✅ Análisis completado y enviado exitosamente a SonarQube ===" -ForegroundColor Green

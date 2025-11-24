# 🔧 **Configuración de Variables de Entorno (.env)**

## 📋 **Resumen**

La solución Ordina ahora soporta archivos `.env` para configurar variables de entorno de manera centralizada. Esto permite desarrollo local **sin necesidad de levantar todos los contenedores Docker**, ejecutando solo la base de datos y las APIs localmente.

## 🎯 **Casos de Uso**

### ✅ **Desarrollo Local (Recomendado)**
```bash
# Solo levantar PostgreSQL
docker-compose up -d postgres

# Ejecutar APIs individualmente
dotnet run --project src/Application/Security/Ordina.Security.Api
dotnet run --project src/Application/Users/Ordina.Users.Api
# etc...
```

### ✅ **Desarrollo con Docker Completo**
```bash
# Levantar toda la infraestructura
docker-compose up -d
```

## 🚀 **Setup Inicial**

### 1. **Crear archivo .env**
```bash
# Usar el script automatizado
.\scripts\setup-env.ps1

# O copiar manualmente
cp environment-template.txt .env
```

### 2. **Personalizar variables (Opcional)**
```bash
# Editar .env con tus valores específicos
notepad .env
```

### 3. **Verificar configuración**
```bash
# Compilar ServiceDefaults (donde está la lógica .env)
dotnet build src/Infrastructure/Ordina.ServiceDefaults

# Ejecutar cualquier API
dotnet run --project src/Application/Security/Ordina.Security.Api
```

## 📁 **Estructura de Archivos**

```
Test/
├── .env                           # ❌ NO en Git (vars reales)
├── environment-template.txt       # ✅ Template versionado  
├── scripts/
│   └── setup-env.ps1             # Script para crear .env
└── src/Infrastructure/Ordina.ServiceDefaults/
    └── Extensions.cs             # Lógica de carga .env
```

## 🔑 **Variables Principales**

### **Base de Datos**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ordina_main
DB_USER=postgres
DB_PASSWORD=OrdinaPassword123!
DB_CONNECTION_STRING=Host=${DB_HOST};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD};Port=${DB_PORT}
```

### **APIs (Puertos de desarrollo)**
```bash
API_GATEWAY_PORT=8080
SECURITY_API_PORT=8082
USERS_API_PORT=8083
PROVIDERS_API_PORT=8084
ORDERS_API_PORT=8085
PAYMENTS_API_PORT=8086
```

### **Herramientas de Desarrollo**
```bash
SWAGGER_ENABLED=true
LOGGING_LEVEL=Information
ENABLE_HEALTH_CHECKS=true
ENABLE_CORS=true
```

## ⚙️ **Cómo Funciona**

### 1. **Carga Automática**
- El archivo `.env` se carga automáticamente al iniciar cualquier API
- Utiliza la librería `DotNetEnv` 
- Se busca el `.env` en la raíz de la solución (donde está el `.sln`)

### 2. **Configuración en appsettings**
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "${DB_CONNECTION_STRING}"
  },
  "Swagger": {
    "Enabled": "${SWAGGER_ENABLED:true}"
  }
}
```

### 3. **Logs de Carga**
```
✅ .env file loaded from: D:\Camihogar\Test\.env
```

## 🛠️ **Comandos Útiles**

### **Setup Completo**
```bash
# 1. Crear .env
.\scripts\setup-env.ps1

# 2. Solo PostgreSQL
docker-compose up -d postgres

# 3. Ejecutar API
dotnet run --project src/Application/Security/Ordina.Security.Api
```

### **Re-crear .env**
```bash
# Sobrescribir .env existente
.\scripts\setup-env.ps1 -Force
```

### **Verificar configuración**
```bash
# Ver ayuda del script
.\scripts\setup-env.ps1 -Help

# Verificar que PostgreSQL esté corriendo
docker ps | grep postgres
```

## 🔍 **Debugging**

### **Verificar carga de .env**
```bash
# Los logs mostrarán:
✅ .env file loaded from: D:\path\to\.env
# o
ℹ️  No .env file found at: D:\path\to\.env
```

### **Variables no reconocidas**
```bash
# Verificar sintaxis en .env:
DB_HOST=localhost          # ✅ Correcto
DB_HOST = localhost        # ❌ Espacios no válidos
```

### **Problemas de conexión**
```bash
# Verificar PostgreSQL
docker-compose up -d postgres
docker logs ordina-postgres

# Verificar puerto libre
netstat -an | findstr :5054
```

## 📝 **Beneficios**

### ✅ **Desarrollo Local**
- **Más rápido**: Solo PostgreSQL en Docker
- **Menos recursos**: No todos los contenedores
- **Debugging fácil**: Ejecutar APIs directamente
- **Hot reload**: Cambios instantáneos

### ✅ **Configuración Centralizada**
- **Un solo lugar**: Todas las variables en `.env`
- **Versionado**: Template en `environment-template.txt`
- **Seguridad**: `.env` real no va a Git
- **Flexibilidad**: Override por ambiente

### ✅ **Compatibilidad**
- **Docker**: Sigue funcionando igual
- **Aspire**: Compatible con AppHost
- **CI/CD**: Usa variables del entorno
- **Producción**: No depende de archivos locales

## 🚨 **Consideraciones Importantes**

### **Seguridad**
- ❌ **NUNCA** commitear `.env` a Git
- ✅ Solo `environment-template.txt` va versionado
- ✅ Usar `.env` solo para desarrollo local
- ✅ En producción usar variables del sistema

### **Precedencia de Variables**
1. Variables del sistema (más alta)
2. Variables de `.env` 
3. Valores por defecto en `appsettings.json` (más baja)

## 🎯 **Casos de Uso Específicos**

### **Solo desarrollo de una API**
```bash
docker-compose up -d postgres
dotnet run --project src/Application/Security/Ordina.Security.Api
```

### **Desarrollo de múltiples APIs**
```bash
# Terminal 1
docker-compose up -d postgres

# Terminal 2
dotnet run --project src/Application/Security/Ordina.Security.Api

# Terminal 3
dotnet run --project src/Application/Users/Ordina.Users.Api
```

### **Testing completo**
```bash
# Toda la infraestructura
docker-compose up -d
```

---

## 📚 **Referencias**

- [DotNetEnv - GitHub](https://github.com/tonerdo/dotnet-env)
- [.NET Configuration - Microsoft Docs](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/configuration)
- [Docker Compose - Documentación](https://docs.docker.com/compose/)

---

**✨ Con esta configuración, puedes desarrollar eficientemente sin la sobrecarga de Docker completo, manteniendo la flexibilidad de la arquitectura de microservicios.** 
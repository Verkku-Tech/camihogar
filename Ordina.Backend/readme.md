# 🚀 Ordina - Monorepo .NET 9 con Supabase Local

![.NET](https://img.shields.io/badge/.NET-9.0-purple)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Supabase](https://img.shields.io/badge/Supabase-Local-green)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![Aspire](https://img.shields.io/badge/.NET_Aspire-Orchestration-orange)

**Ordina** es un monorepo moderno de microservicios construido con **.NET 9 Aspire**, **PostgreSQL**, **Supabase local** y **Docker**. Optimizado para tiendas locales con arquitectura pragmática que usa una base de datos única con schemas separados.

## 🌟 Características Principales

- **🏗️ Arquitectura de Microservicios**: 5 servicios independientes
- **🐘 PostgreSQL + Supabase**: Base de datos única con schemas separados e interfaz moderna
- **🐳 Docker Compose**: Orquestación completa de servicios
- **📊 .NET Aspire**: Observabilidad y gestión de servicios
- **🔄 Entity Framework**: Migraciones automatizadas
- **🔒 Clean Architecture**: Separación clara de responsabilidades
- **📱 Swagger/OpenAPI**: Documentación automática de APIs

## 🏛️ Arquitectura del Sistema

```
Ordina/
├── 🎯 Presentation Layer
│   ├── API Gateway (8080-8081)
│   └── Aspire AppHost (Orchestration)
├── 🔧 Infrastructure Layer
│   ├── ServiceDefaults (Configuración compartida)
│   └── Database (PostgreSQL + Supabase)
└── 📦 Application Layer (Microservicios)
    ├── 🔐 Security (8082) - Roles & Permisos
    ├── 👥 Users (8083) - Gestión de usuarios
    ├── 🏪 Providers (8084) - Proveedores y productos
    ├── 📦 Orders (8085) - Gestión de pedidos
    └── 💳 Payments (8086) - Procesamiento de pagos
```

### 🗄️ Modelo de Datos (Base Única con Schemas)

| Microservicio | Schema | Entidades Principales |
|---------------|--------|----------------------|
| **Security** | `security` | Role, Permission, RolePermission |
| **Users** | `users` | User, UserProfile |
| **Providers** | `providers` | Provider, Product |
| **Orders** | `orders` | Order, OrderItem |
| **Payments** | `payments` | Payment, PaymentMethod |

> 📋 **Database**: `ordina_main` - Todos los microservicios comparten una BD con schemas aislados

## 🚀 Inicio Rápido

### Prerrequisitos

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell) (Windows/Linux/macOS)

### 1. 📥 Clonar y Configurar

```bash
git clone <repository-url>
cd Ordina

# Instalar herramientas EF Core (si no las tienes)
dotnet tool install --global dotnet-ef
```

### 2. 🐳 Iniciar Infraestructura (Supabase Local)

```bash
# Iniciar todos los servicios con Docker Compose
docker-compose up -d

# Verificar que todos los servicios estén ejecutándose
docker-compose ps
```

### 3. 🗃️ Configurar Base de Datos

```powershell
# Crear migraciones para todos los microservicios (schemas separados)
.\scripts\manage-migrations.ps1 -Action create-all

# Aplicar migraciones a la base de datos
.\scripts\manage-migrations.ps1 -Action update-all
```

### 4. 🌐 Ejecutar con Aspire

```bash
# Opción A: Con Aspire (Recomendado)
dotnet run --project src/Presentation/Ordina.AppHost

# Opción B: Solo APIs con Docker
docker-compose up --build
```

## 🌐 Servicios y Puertos

| Servicio | Puerto | Descripción | URL |
|----------|--------|-------------|-----|
| **Supabase Studio** | 3000 | Interfaz de gestión DB | http://localhost:3000 |
| **API Gateway** | 8080-8081 | Gateway principal | http://localhost:8080 |
| **Security API** | 8082 | Autenticación y autorización | http://localhost:8082/swagger |
| **Users API** | 8083 | Gestión de usuarios | http://localhost:8083/swagger |
| **Providers API** | 8084 | Proveedores y productos | http://localhost:8084/swagger |
| **Orders API** | 8085 | Gestión de pedidos | http://localhost:8085/swagger |
| **Payments API** | 8086 | Procesamiento de pagos | http://localhost:8086/swagger |
| **PostgreSQL** | 5432 | Base de datos principal | localhost:5432 |
| **Redis** | 6379 | Cache distribuido | localhost:6379 |

## 🔧 Gestión de Migraciones

### Script PowerShell Automatizado

```powershell
# ✨ Comandos principales
.\scripts\manage-migrations.ps1 -Action create-all                    # Crear todas las migraciones
.\scripts\manage-migrations.ps1 -Action update-all                    # Aplicar todas las migraciones
.\scripts\manage-migrations.ps1 -Action list -Service Security        # Listar migraciones de Security
.\scripts\manage-migrations.ps1 -Action add -Service Users -MigrationName "AddNewField"

# 🎯 Servicios disponibles: security, users, providers, orders, payments, all
# 🗄️ Base de datos única: ordina_main con schemas separados
```

### Comandos EF Core Manuales

```bash
# Ejemplo para Security service
dotnet ef migrations add InitialCreate \
  -p src/Application/Security/Ordina.Security.Infrastructure \
  -s src/Application/Security/Ordina.Security.Api

dotnet ef database update \
  -p src/Application/Security/Ordina.Security.Infrastructure \
  -s src/Application/Security/Ordina.Security.Api
```

## 📊 Supabase Local

### 🔑 Credenciales de Acceso

```bash
# PostgreSQL (Base de datos única)
Host: localhost
Port: 5432
Database: ordina_main
Username: postgres
Password: OrdinaPassword123!

# Supabase Studio
URL: http://localhost:3000
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 🎯 Características Incluidas

- **Dashboard Web**: Gestión visual de la base de datos
- **Editor SQL**: Ejecutar consultas directamente
- **API Explorer**: Probar APIs REST generadas automáticamente
- **Gestión de Usuarios**: Sistema de autenticación integrado
- **Logs en Tiempo Real**: Monitoreo de queries y eventos

Ver [📖 Guía Completa de Supabase Local](docs/SUPABASE_LOCAL_SETUP.md) para más detalles.

## 🛠️ Scripts Útiles

### Gestión de Paquetes

```powershell
# Agregar paquetes PostgreSQL y EF Core
.\scripts\add-postgresql-packages.ps1
```

### Docker Commands

```bash
# 🔄 Reiniciar servicios
docker-compose down && docker-compose up -d

# 📋 Ver logs
docker-compose logs -f [service-name]

# 🗑️ Reset completo (⚠️ elimina datos)
docker-compose down -v
docker-compose up --build -d
```

### 📦 Dockerfile Unificado

Este proyecto utiliza un **Dockerfile unificado** para construir todos los microservicios. Ver [DOCKERFILE.md](./DOCKERFILE.md) para más detalles.

- ✅ Un solo Dockerfile en `Ordina.Backend/Dockerfile`
- ✅ Se usa con argumentos `PROJECT_PATH` para cada servicio
- ✅ Configurado automáticamente en el `docker-compose.yml` de la raíz

## 🧪 Desarrollo y Testing

### Estructura de Cada Microservicio

```
Ordina.[Service]/
├── Ordina.[Service].Api/          # Controllers, Middleware, Configuración
├── Ordina.[Service].Application/  # Casos de uso, CQRS, Handlers
├── Ordina.[Service].Domain/       # Entidades, Value Objects, Interfaces
└── Ordina.[Service].Infrastructure/ # DbContext, Repositories, Services externos
```

### Flujo de Desarrollo

1. **🔄 Modificar entidades** en `Domain/`
2. **📝 Crear migración**: `.\scripts\manage-migrations.ps1 -Action add -Service [Name] -MigrationName "[Description]"`
3. **✅ Aplicar cambios**: `.\scripts\manage-migrations.ps1 -Action update -Service [Name]`
4. **🔍 Verificar en Supabase Studio**: http://localhost:3000

### Testing APIs

```bash
# Usando curl
curl -X GET http://localhost:8082/swagger/index.html

# Usando HTTPie
http GET localhost:8083/api/users

# Importar colecciones Postman desde:
# src/Application/[Service]/Ordina.[Service].Api/Ordina.[Service].Api.http
```

## 📂 Estructura del Proyecto

```
Ordina/
├── 📄 docker-compose.yml                    # Configuración Docker
├── 📄 Ordina.sln                           # Solución principal
├── 📁 docs/                                # Documentación
│   ├── SUPABASE_LOCAL_SETUP.md             # Guía Supabase local
│   └── POSTGRESQL_MIGRATION_COMPLETE.md    # Migración PostgreSQL
├── 📁 scripts/                             # Scripts de automatización
│   ├── manage-migrations.ps1               # Gestión de migraciones
│   └── add-postgresql-packages.ps1         # Instalación de paquetes
├── 📁 supabase/                            # Configuración Supabase
│   ├── kong.yml                            # Configuración API Gateway
│   └── init.sql                            # Script inicialización
└── 📁 src/                                 # Código fuente
    ├── 📁 Application/                     # Microservicios
    │   ├── 📁 Security/                    # 🔐 Autenticación
    │   ├── 📁 Users/                       # 👥 Usuarios
    │   ├── 📁 Providers/                   # 🏪 Proveedores
    │   ├── 📁 Orders/                      # 📦 Pedidos
    │   └── 📁 Payments/                    # 💳 Pagos
    ├── 📁 Infrastructure/                  # Infraestructura compartida
    │   ├── 📁 Ordina.Database/             # Configuraciones DB
    │   └── 📁 Ordina.ServiceDefaults/      # Configuración común
    └── 📁 Presentation/                    # Capa de presentación
        ├── 📁 Ordina.ApiGateway/           # API Gateway
        └── 📁 Ordina.AppHost/              # Aspire Host
```

## 🚨 Troubleshooting

### Problemas Comunes

#### 🐳 Docker no inicia

```bash
# Verificar Docker Desktop
docker --version
docker-compose --version

# Liberar puertos ocupados
docker-compose down
netstat -ano | findstr :5432  # Windows
lsof -ti:5432 | xargs kill    # macOS/Linux
```

#### 🗃️ Error de migración

```bash
# Verificar conexión a DB
docker exec -it ordina-postgres psql -U postgres -c "\l"

# Reset migraciones (⚠️ elimina datos)
.\scripts\manage-migrations.ps1 -Action remove -Service [Name]
.\scripts\manage-migrations.ps1 -Action add -Service [Name]
```

#### 🌐 API no responde

```bash
# Verificar logs del servicio
docker-compose logs [service-name]

# Rebuild específico
docker-compose up --build [service-name]
```

Ver [🔍 Guía Completa de Troubleshooting](docs/SUPABASE_LOCAL_SETUP.md#troubleshooting) para más soluciones.

## 🤝 Contribución

1. **Fork** el repositorio
2. **Crear rama**: `git checkout -b feature/nueva-funcionalidad`
3. **Commit**: `git commit -am 'Agregar nueva funcionalidad'`
4. **Push**: `git push origin feature/nueva-funcionalidad`
5. **Pull Request**: Crear PR con descripción detallada

### Estándares de Código

- **Clean Architecture** para todos los microservicios
- **CQRS** para operaciones complejas
- **Entity Framework** para acceso a datos
- **Swagger/OpenAPI** para documentación
- **Docker** para containerización

## 📚 Recursos y Enlaces

- [📖 Documentación .NET Aspire](https://learn.microsoft.com/en-us/dotnet/aspire/)
- [🐘 PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [🚀 Supabase Documentation](https://supabase.com/docs)
- [🐳 Docker Compose Reference](https://docs.docker.com/compose/)
- [🔄 Entity Framework Core](https://docs.microsoft.com/en-us/ef/core/)

## 📋 TODO & Roadmap

- [ ] **Autenticación JWT** con Supabase Auth
- [ ] **API Rate Limiting** en el Gateway
- [ ] **Health Checks** para todos los servicios
- [ ] **Logging estructurado** con Serilog
- [ ] **Tests de integración** automatizados
- [ ] **CI/CD Pipeline** con GitHub Actions
- [ ] **Métricas y observabilidad** con Prometheus
- [ ] **Message Bus** con RabbitMQ o Azure Service Bus

## 📜 Licencia

Este proyecto está bajo la licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

**🎉 ¡Construido con ❤️ y las mejores prácticas de .NET!**

> **¿Tienes preguntas?** Abre un [Issue](../../issues) o revisa la [documentación completa](docs/).

---

### ⭐ Si te gusta este proyecto, ¡dale una estrella!

[![GitHub stars](https://img.shields.io/github/stars/tu-usuario/ordina?style=social)](https://github.com/tu-usuario/ordina/stargazers)

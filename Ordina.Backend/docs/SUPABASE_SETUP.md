# 🐘 Configuración PostgreSQL con Supabase

Esta guía te ayudará a configurar PostgreSQL usando Supabase como interfaz de gestión de base de datos para el monorepo Ordina.

## 🎯 Objetivo

Usar Supabase únicamente como **interfaz de gestión de PostgreSQL**, sin utilizar sus APIs serverless, solo aprovechando su excelente dashboard para administrar las bases de datos.

## 🚀 Configuración con Supabase Cloud

### Paso 1: Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. Clic en "New Project"
4. Completa los datos:
   - **Name**: `ordina-monorepo`
   - **Database Password**: `OrdinaPassword123!` (o la que prefieras)
   - **Region**: Selecciona la más cercana
5. Clic en "Create new project"

### Paso 2: Obtener Credenciales de Conexión

1. En el dashboard de Supabase, ve a **Settings** > **Database**
2. En la sección **Connection info**, encontrarás:
   - **Host**: `db.xxxxxxxxxxxxxxxx.supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: La que configuraste

### Paso 3: Actualizar Configuración del Monorepo

#### Opción A: Usar Supabase Cloud (Recomendado para desarrollo)

Actualiza las connection strings en `docker-compose.yml`:

```yaml
# Cambiar las variables de entorno de cada servicio:
environment:
  - ConnectionStrings__DefaultConnection=Host=db.xxxxxxxxxxxxxxxx.supabase.co;Database=ordina_security;Username=postgres;Password=TU_PASSWORD;Port=5432;SSL Mode=Require
```

#### Opción B: Usar PostgreSQL Local + Supabase Local

Si prefieres desarrollo completamente local, puedes usar Supabase CLI:

```bash
# Instalar Supabase CLI
npm install -g supabase

# Inicializar proyecto
supabase init

# Iniciar Supabase local
supabase start
```

### Paso 4: Crear Bases de Datos Separadas

En el **SQL Editor** de Supabase, ejecuta el siguiente script:

```sql
-- Crear bases de datos para cada microservicio
CREATE DATABASE ordina_security;
CREATE DATABASE ordina_users;
CREATE DATABASE ordina_providers;
CREATE DATABASE ordina_orders;
CREATE DATABASE ordina_payments;

-- Crear extensiones útiles en cada base de datos
\c ordina_security;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c ordina_users;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c ordina_providers;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c ordina_orders;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c ordina_payments;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

## 🏠 Configuración Local (Alternativa)

Si prefieres mantener PostgreSQL completamente local y solo usar Supabase para conectarte remotamente:

### Paso 1: Mantener docker-compose.yml actual

El `docker-compose.yml` ya está configurado para PostgreSQL local.

### Paso 2: Configurar Supabase para conexión externa

1. En Supabase, crea un nuevo proyecto
2. Ve a **Settings** > **Database** > **Connection pooling**
3. Usa **Direct connection** para conectarte a tu PostgreSQL local
4. Configura la conexión:
   - **Host**: `localhost` (o tu IP local)
   - **Port**: `5432`
   - **Database**: `ordina_main`
   - **User**: `postgres`
   - **Password**: `OrdinaPassword123!`

## 🔧 Configuración de los Microservicios

### Actualizar los proyectos .NET para usar PostgreSQL

1. **Agregar paquetes NuGet** a cada proyecto `.Infrastructure`:

```bash
# Para cada microservicio
dotnet add src/Application/Security/Ordina.Security.Infrastructure/Ordina.Security.Infrastructure.csproj package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add src/Application/Users/Ordina.Users.Infrastructure/Ordina.Users.Infrastructure.csproj package Npgsql.EntityFrameworkCore.PostgreSQL
# ... repetir para todos los microservicios
```

2. **Actualizar DbContext** en cada microservicio:

```csharp
// En cada archivo Infrastructure/Data/ApplicationDbContext.cs
protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
{
    if (!optionsBuilder.IsConfigured)
    {
        optionsBuilder.UseNpgsql(connectionString);
    }
}
```

3. **Configurar Dependency Injection**:

```csharp
// En Program.cs de cada API
services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
```

## 📊 Ventajas de usar Supabase

### 🎨 Interfaz Visual Excelente
- **Table Editor**: Crear y editar tablas visualmente
- **SQL Editor**: Ejecutar queries con autocompletado
- **Data Browser**: Ver y editar datos fácilmente
- **Schema Visualizer**: Ver relaciones entre tablas

### 🔍 Herramientas de Desarrollo
- **Real-time logs**: Ver queries en tiempo real
- **Performance insights**: Monitorear rendimiento
- **API docs**: Documentación automática (aunque no la usemos)
- **Database backups**: Respaldos automáticos

### 🚀 Facilidad de Uso
- No necesitas instalar pgAdmin u otras herramientas
- Acceso desde cualquier lugar con internet
- Colaboración en equipo fácil
- Migraciones visuales

## 🔐 Variables de Entorno Recomendadas

Crea un archivo `.env` en la raíz del proyecto:

```bash
# PostgreSQL Configuration
POSTGRES_HOST=db.xxxxxxxxxxxxxxxx.supabase.co  # O localhost para desarrollo local
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=OrdinaPassword123!

# Database Names
POSTGRES_DB_SECURITY=ordina_security
POSTGRES_DB_USERS=ordina_users
POSTGRES_DB_PROVIDERS=ordina_providers
POSTGRES_DB_ORDERS=ordina_orders
POSTGRES_DB_PAYMENTS=ordina_payments

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 🧪 Testing de la Conexión

1. **Desde Supabase Dashboard**:
   - Ve al **SQL Editor**
   - Ejecuta: `SELECT version();`
   - Deberías ver la versión de PostgreSQL

2. **Desde tu aplicación**:
   ```bash
   dotnet run --project src/Presentation/Ordina.AppHost
   ```
   - Verifica en el dashboard de Aspire que las conexiones están funcionando

3. **Desde psql (opcional)**:
   ```bash
   psql "postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres"
   ```

## 🎯 Próximos Pasos

1. ✅ Configurar Supabase project
2. ✅ Crear bases de datos separadas
3. 🔄 Agregar paquetes NuGet de PostgreSQL
4. 🔄 Configurar Entity Framework para PostgreSQL
5. 🔄 Crear migraciones iniciales
6. 🔄 Configurar seed data

## 💡 Tips y Recomendaciones

- **Desarrollo Local**: Usa PostgreSQL local con Supabase para gestión remota
- **Staging/Production**: Usa Supabase Cloud directamente
- **Backups**: Configura backups automáticos en Supabase
- **Monitoring**: Usa las métricas de Supabase para monitorear performance
- **Security**: Nunca hardcodear credenciales, usar variables de entorno

¡Con esta configuración tendrás lo mejor de ambos mundos: la potencia de PostgreSQL con la interfaz increíble de Supabase! 🚀 
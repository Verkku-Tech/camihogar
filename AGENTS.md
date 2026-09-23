# Manual y Directrices de Ingeniería para Agentes AI (AGENTS.md)

Este documento es el punto de referencia maestro para cualquier agente de Inteligencia Artificial o desarrollador que opere sobre el repositorio **FORGE ERP (Camihogar)**.

> [!IMPORTANT]
> **Nombre Oficial del ERP:** El sistema se llama oficialmente **FORGE** (o **Forge ERP**). En interfaces de usuario, correos electrónicos, títulos, diálogos, notificaciones y comunicaciones al usuario final, se debe utilizar siempre **FORGE**. Los nombres técnicos o namespaces existentes (`Ordina.*`) se preservan internamente por compatibilidad de ensamblados.

---

## 1. Visión General del Proyecto y Arquitectura

* **Nombre de Producto:** **FORGE ERP** (CamiHogar).
* **Backend:** Monolito Modular Clean en **.NET 10** (`Ordina.Api`, `Ordina.Application`, `Ordina.Domain`, `Ordina.Infrastructure`), compilado en ReadyToRun (ARM64) y desplegado en Raspberry Pi 5.
* **Base de Datos:** **100% MongoDB** (cero dependencias de PostgreSQL, Supabase o Redis).
* **Frontend:** SPA Estática en **Bun + Vite + React 19 + TypeScript + TanStack Query + PWA Offline**, desplegable en Cloudflare Pages.
* **Monitoreo & Logs:** **.NET Aspire Standalone Dashboard** en producción (`http://aspire-dashboard:4317`), protegido con `BrowserToken` y unificando logs del Backend y Frontend.
* **Sistema de Diseño:** **Verkku Precision Atelier** (Verde Esmeralda `#1CB569`, Grafito Cálido `#111418`, `Plus Jakarta Sans`, `JetBrains Mono`).

---

## 2. Índice de Reglas Modulares

Para directrices detalladas por área técnica, consulta los siguientes documentos en `.agents/rules/`:

1. [01-general-standards.md](file:///.agents/rules/01-general-standards.md): Idioma (Código en inglés, UI en español), Cero Hardcoding, Manejo de Secretos y Filosofía Ponytail.
2. [02-backend-dotnet10.md](file:///.agents/rules/02-backend-dotnet10.md): .NET 10, DTOs inmutables (`record`), `CancellationToken` obligatorio, Singleton de `MongoClient`, Paginación en Servidor y Scopes OpenTelemetry.
3. [03-frontend-bun-react19.md](file:///.agents/rules/03-frontend-bun-react19.md): Tooling con Bun, TypeScript estricto, 3 Stores de IndexedDB (`tanstack_cache`, `outbox_mutations`, `telemetry_buffer`), Idempotencia `X-Mutation-Id` y Telemetría.
4. [04-testing-tdd.md](file:///.agents/rules/04-testing-tdd.md): Metodología TDD estricta (Red-Green-Refactor) orientada exclusivamente a flujos de alto valor y condiciones de borde.
5. [05-infrastructure-and-devops.md](file:///.agents/rules/05-infrastructure-and-devops.md): Topología Cloudflare + Raspberry Pi 5 (Debian 12), Acceso SSH seguro por túnel, Monitoreo (Aspire/DB) y Regla Absoluta de Comandos No Destructivos.

---

## 3. Checklist Obligatorio para Todo Agente Antes de Escribir Código

Antes de generar o modificar código en este repositorio, verifica:

- [ ] **Idioma:** Nombres de variables, clases, métodos, DTOs y esquemas en **Inglés**. Textos de UI y mensajes al usuario en **Español**.
- [ ] **Identidad de Producto:** El ERP es **FORGE** (o **Forge ERP**). Prohibido terminantemente mostrar "Ordina" o "Ordina ERP" en UI, correos, asuntos, notificaciones o pies de firma.
- [ ] **Anti-Hardcoding:** ¿Estás usando un string libre para un estado, rol o etapa? **Reemplázalo por un Enum o Constante fuertemente tipada**.
- [ ] **Backend .NET 10:**
  - [ ] ¿Los DTOs son `public record` o `public readonly record struct`?
  - [ ] ¿Usas constructores primarios (*Primary Constructors*) y expresiones de colección (`[...]`) sin código boilerplate?
  - [ ] ¿Cero sync-over-async (`.Result`, `.Wait()`) y cero `async void`?
  - [ ] ¿Los endpoints están diseñados a la medida del caso de uso (`ManufacturingController`, `DispatchController`) con proyecciones exactas en vez de mega-endpoints genéricos?
  - [ ] ¿Todos los métodos async reciben y propagan `CancellationToken cancellationToken = default`?
  - [ ] ¿Se inyecta `TimeProvider` en vez de llamadas estáticas a `DateTime.UtcNow`?
  - [ ] ¿Las consultas a colecciones grandes usan paginación (`PagedRequest`, `PagedResult<T>`)?
  - [ ] ¿El cliente de MongoDB se inyecta como Singleton (nunca `new MongoClient()`) y las entidades tienen `[BsonIgnoreExtraElements]`?
  - [ ] ¿Los logs de operaciones clave usan logging estructurado semántico (sin interpolación de strings `$"..."`) y `_logger.BeginScope` con contexto de negocio (`OrderId`, `UserId`, `Module`)?
- [ ] **Frontend Bun + React 19:**
  - [ ] ¿Se usan comandos de Bun (`bun install`, `bun test`, `bun run build`)?
  - [ ] ¿El tipado es estricto (cero `any`, cero `React.FC`, e `import type` para interfaces y tipos)?
  - [ ] ¿Los hooks están compartimentados en su módulo (`src/modules/<feature>/hooks/`) sin reprocesamiento masivo de arrays en el cliente?
  - [ ] ¿Las mutaciones envían la cabecera `X-Mutation-Id: <uuid>`?
  - [ ] ¿Los errores se capturan con `ErrorBoundary` y se envían a `/api/telemetry/client-logs`?
  - [ ] **TanStack Query v5:** ¿Cero callbacks en `useQuery` (`onSuccess`/`onError`), uso de `placeholderData: keepPreviousData`, `isPending` para cargas y Query Keys estructuradas?
  - [ ] **React 19 Moderno:** ¿`ref` como prop regular (sin `forwardRef`), desestructuración con valores por defecto (cero `defaultProps`), `<Context value=...>` directo (sin `.Provider`), y cero subcomponentes anidados en el cuerpo de render (`react(static-components)`)?
  - [ ] **Conectividad Real vs navigator.onLine:** ¿Evalúas el modo offline con `useConnectivity` / `connectivityManager` (salud `/api/health`, 502/503/504, transporte) en vez del engañoso `navigator.onLine`? ¿Aíslas los errores 500 como bugs de aplicación sin activar modo offline?
  - [ ] **Catálogos vs Memoria de Página:** ¿Los filtros de entidades (vendedores, tiendas, cuentas, proveedores) consultan catálogos independientes y activos (`useActiveCatalogs`) en vez de deducirse de la página de resultados cargada en memoria?
  - [ ] **Reconciliación de Outbox:** ¿Las creaciones offline reemplazan sus IDs provisionales (`ord_off_...`) por la entidad canónica del servidor al drenarse el outbox?
  - [ ] **Animación de Carga Skeleton (`boneyard-js`):** ¿Cada componente o vista asíncrona cuenta con su animación de carga utilizando `boneyard-js` (`<Skeleton loading={...}>`) o componentes de skeleton para evitar pantallas en blanco, números vacíos o saltos de layout (CLS)?
- [ ] **TDD:** ¿Escribiste primero la prueba que valide el flujo real o caso de borde y la viste fallar (RED) antes de implementar?
- [ ] **Ponytail (Simplicidad Radical):** ¿Estás agregando abstracciones, fábricas o interfaces innecesarias para casos de un solo uso? Si es así, **elimínalas y escribe el código más simple y directo posible**.
- [ ] **Prohibición de Fallbacks no Solicitados:** Los "fallbacks" no son solución y enmascaran errores de contrato. **NUNCA agregues mecanismos de fallback silenciosos** (como consultar endpoints alternativos, simular datos o enmascarar fallos) a menos que se te indique explícitamente.
- [ ] **Seguridad en Servidor e Infraestructura:** ¿Vas a interactuar con el servidor (RPi 5)? **PROHIBICIÓN ABSOLUTA de ejecutar comandos destructivos** (`rm -rf`, `docker volume prune`, `dropDatabase`, etc.) sin confirmación previa y explícita del usuario humano.

---

## 4. Comandos Esenciales de Verificación

```bash
# Backend: Compilar y correr pruebas TDD
dotnet build Ordina.Backend/src/Api/Ordina.Api.csproj -c Release
dotnet test Ordina.Backend/tests/Ordina.Application.Tests
dotnet test Ordina.Backend/tests/Ordina.Api.Tests

# Frontend: Instalar, probar y compilar con Bun
cd Ordina.Frontend
bun install
bun test
bun run build
```

---

## 5. Infraestructura, Servidor (RPi 5) y Conexión SSH

* **Cloudflare:** Actúa como WAF, CDN, sirve el Frontend (PWA) y mantiene los túneles VPN Zero Trust hacia el servidor.
* **Servidor de Producción:**
  - **Hardware:** Raspberry Pi 5 (16 GB RAM, 64 GB Almacenamiento).
  - **Sistema Operativo:** Debian 12 (Bookworm, ARM64).
  - **Contenedores Docker:** Backend (.NET 10 API ReadyToRun ARM64), Base de Datos (MongoDB) y Dashboard de Aspire.
  - **Gestor de Túnel:** Cloudflare Tunnel administrado localmente en `/etc/cloudflared/config.yaml`.

### Protocolo de Conexión SSH al Servidor:
1. **Paso 1: Abrir el túnel TCP local de Cloudflared (en máquina de desarrollo):**
   ```bash
   cloudflared access tcp --hostname ssh-camihogar.verkku.com --url localhost:9888
   ```
2. **Paso 2: Conectar vía SSH:**
   ```bash
   ssh sa@localhost -p 9888
   ```
   *(La máquina local ya cuenta con la llave SSH autorizada; no requiere contraseña).*

### Regla Inquebrantable de Operaciones en el Servidor:
> [!CAUTION]
> **CERO COMANDOS DESTRUCTIVOS SIN PERMISO.**
> Ningún agente debe ejecutar comandos de eliminación de datos, depuración de volúmenes Docker (`docker volume prune`), borrado de colecciones en MongoDB o modificaciones en `/etc/` sin autorización expresa y previa del usuario.

### Tareas DevOps Planificadas:
1. **Validación de Estatus:** Monitoreo de recursos (RAM 16GB, disco 64GB, temperaturas/throttling del RPi 5) y salud de contenedores (`docker ps`, `docker stats`).
2. **Dashboard de Aspire:** Publicación segura vía túnel de Cloudflare para observabilidad unificada (Backend y Frontend).
3. **Monitoreo de MongoDB:** Supervisión de rendimiento de la base de datos, memoria y conexiones activas.
4. **Backups en la Nube:** Scripts automatizados periódicos de `mongodump` cifrados y sincronizados a almacenamiento en la nube (S3/R2).
5. **Scripts de Mantenimiento:** Rotación de logs de Docker y depuración segura de imágenes huérfanas.


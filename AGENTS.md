# Manual y Directrices de Ingeniería para Agentes AI (AGENTS.md)

Este documento es el punto de referencia maestro para cualquier agente de Inteligencia Artificial o desarrollador que opere sobre el repositorio **Camihogar / Ordina**.

---

## 1. Visión General del Proyecto y Arquitectura

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

---

## 3. Checklist Obligatorio para Todo Agente Antes de Escribir Código

Antes de generar o modificar código en este repositorio, verifica:

- [ ] **Idioma:** Nombres de variables, clases, métodos, DTOs y esquemas en **Inglés**. Textos de UI y mensajes al usuario en **Español**.
- [ ] **Anti-Hardcoding:** ¿Estás usando un string libre para un estado, rol o etapa? **Reemplázalo por un Enum o Constante fuertemente tipada**.
- [ ] **Backend .NET 10:**
  - [ ] ¿Los DTOs son `public record` o `public readonly record struct`?
  - [ ] ¿Los endpoints están diseñados a la medida del caso de uso (`ManufacturingController`, `DispatchController`) con proyecciones exactas en vez de mega-endpoints genéricos?
  - [ ] ¿Todos los métodos async reciben y propagan `CancellationToken cancellationToken = default`?
  - [ ] ¿Las consultas a colecciones grandes usan paginación (`PagedRequest`, `PagedResult<T>`)?
  - [ ] ¿El cliente de MongoDB se inyecta como Singleton (nunca `new MongoClient()`)?
  - [ ] ¿Los logs de operaciones clave usan `_logger.BeginScope` con contexto de negocio (`OrderId`, `UserId`, `Module`)?
- [ ] **Frontend Bun + React 19:**
  - [ ] ¿Se usan comandos de Bun (`bun install`, `bun test`, `bun run build`)?
  - [ ] ¿El tipado es estricto (cero `any`)?
  - [ ] ¿Los hooks están compartimentados en su módulo (`src/modules/<feature>/hooks/`) sin reprocesamiento masivo de arrays en el cliente?
  - [ ] ¿Las mutaciones envían la cabecera `X-Mutation-Id: <uuid>`?
  - [ ] ¿Los errores se capturan con `ErrorBoundary` y se envían a `/api/telemetry/client-logs`?
- [ ] **TDD:** ¿Escribiste primero la prueba que valide el flujo real o caso de borde y la viste fallar (RED) antes de implementar?
- [ ] **Ponytail (Simplicidad Radical):** ¿Estás agregando abstracciones, fábricas o interfaces innecesarias para casos de un solo uso? Si es así, **elimínalas y escribe el código más simple y directo posible**.

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

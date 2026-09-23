# Reglas Generales de Ingeniería y Estándares de Código

Este documento establece las directrices universales para cualquier agente o desarrollador que trabaje en **Camihogar / Ordina**.

---

## 1. Convenciones de Idioma

| Contexto | Idioma Obligatorio | Ejemplos |
| :--- | :--- | :--- |
| **Código Fuente (Backend & Frontend)** | **Inglés** | Nombres de variables, funciones, métodos, clases, interfaces, tipos, DTOs, campos de base de datos, rutas de API y propiedades. (`CreateOrderAsync`, `manufacturingStage`, `isDelivered`). |
| **Términos de Dominio Específicos** | **Inglés (o Glosario Establecido)** | `TaxId` / `RutId` (RUT/RIF), `Workshop` (Taller), `WorkOrder` (Orden de trabajo), `Dispatch` (Despacho), `ExchangeRate` (Tasa de cambio). |
| **Mensajes a Usuario Final / UI** | **Español** | Textos de botones, etiquetas, notificaciones toast, modales, alertas y mensajes de validación ("El cliente no tiene un RUT válido"). |
| **Logs del Sistema (OpenTelemetry)** | **Inglés con Metadata Estructurada** | `[Orders] Order {OrderId} status transitioned to {NewStatus}` |
| **Mensajes de Git / Commits** | **Inglés (Conventional Commits)** | `feat(orders): add server-side pagination and discount calculations` |

---

## 2. Identidad y Nombre del Producto (FORGE ERP)

> [!IMPORTANT]
> **Nombre Oficial del ERP: FORGE (o Forge ERP)**
> - **Regla Fundamental:** El ERP se llama oficialmente **FORGE**.
> - **Prohibición Estricta:** Queda terminantemente prohibido referirse al sistema como "Ordina", "Ordina ERP" o "Ordina CamiHogar" en:
>   - Textos de interfaz de usuario (UI), barras laterales, botones, cabeceras y modales.
>   - Asuntos (`Subject`) y cuerpos HTML de correos electrónicos salientes (ej. `[SOPORTE FORGE]`, `Generado automáticamente desde FORGE`).
>   - Remitentes de correo (`SenderName: "FORGE Soporte"`).
>   - Mensajes toast, alertas y notificaciones a usuarios.
> - **Excepción Técnica Interna:** Los nombres técnicos de proyectos, ensamblados o namespaces de .NET (`Ordina.Api`, `Ordina.Application`, `Ordina.Domain`, etc.) se preservan exclusivamente por estabilidad de compilación y compatibilidad de arquitectura interna. Nunca deben filtrarse al usuario.

---

## 3. Prohibición Absoluta de Hardcoding

1. **Cero Strings Mágicos para Estados:**
   - **Backend:** Usar Enums fuertemente tipados o constantes de clase sellada (`public enum OrderStatus`, `public static class ManufacturingStages`).
   - **Frontend:** Usar TypeScript string literal unions o const enums (`export type OrderStatus = 'Draft' | 'Confirmed' | 'InProduction' | 'Ready' | 'Delivered' | 'Cancelled'`).
2. **Cero Rutas o URLs Hardcodeadas:**
   - En el frontend, todas las llamadas a endpoints deben usar constantes centralizadas o helpers tipados en `src/lib/endpoints.ts`.
3. **Cero Textos Mágicos Repetidos:**
   - Textos de estado, roles y permisos deben provenir de constantes centralizadas (`Permissions.Orders.Create`, `Roles.Admin`).

---

## 3. Manejo Riguroso de Secretos y Configuración

1. **Cero Secretos en el Repositorio:**
   - Nunca incluir contraseñas, tokens JWT, Connection Strings de MongoDB o API keys en archivos versionados (`.cs`, `.ts`, `.json`, `.yml`).
2. **Desarrollo Local:**
   - Utilizar archivos `.env` (incluidos en `.gitignore`) o `.NET User Secrets` (`dotnet user-secrets`).
3. **Producción (Raspberry Pi 5 / Cloudflare):**
   - Inyección vía variables de entorno en Docker Compose o Cloudflare Environment Variables.
4. **Validación de Configuración al Arrancar:**
   - Validar obligatoriamente las variables requeridas en el arranque (`Program.cs` / `vite.config.ts`); si falta una variable crítica (ej. `MongoDb__ConnectionString`), la aplicación debe fallar de inmediato con un mensaje explicativo (Fail-Fast).

---

## 4. Política de Comentarios y Filosofía "Ponytail"

1. **Código Auto-Explicativo:**
   - No escribir comentarios que repitan lo que el código hace (`// suma a y b -> a + b`).
2. **Comentarios de Razón de Negocio:**
   - Explicar **el por qué**, no el qué (ej. `// El cálculo de IVA se omite para transacciones en zona franca según ley regional XYZ`).
3. **Marcadores de Atajos Deliberados:**
   - Cuando se tome un atajo consciente o simplificación temporal, usar el prefijo `// ponytail:` indicando qué se postergó y cuándo refactorizar:
     ```csharp
     // ponytail: linear scan acceptable for <50 items; replace with indexed query if catalog exceeds 1k items
     ```
4. **Preservación de Comentarios Existentes:**
   - No eliminar comentarios de negocio o documentación técnica preexistente a menos que sea explícitamente solicitado.

---

## 5. Prohibición Absoluta de Fallbacks no Solicitados

1. **Los Fallbacks no son Solución:**
   - Los mecanismos de "fallback" silenciosos (tales como consultar endpoints alternativos si el principal falla, inventar datos por defecto, o capturar excepciones para disimular un error de contrato) enmascaran los problemas de raíz e impiden detectar desalineaciones entre el cliente y el servidor.
2. **Principio de Fallo Temprano (Fail-Fast):**
   - Si un endpoint, servicio o contrato no funciona como debe, la operación debe fallar explícitamente para permitir diagnosticar y resolver la causa real del problema.
3. **Excepción Exclusiva:**
   - **Sólo** se deben implementar fallbacks cuando el usuario lo solicite de manera explícita e inequívoca en su requerimiento.

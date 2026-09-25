# Especificación de Diseño: Blindaje y Pruebas Reales de Extremo a Extremo (Camihogar / Ordina)

**Fecha:** 2026-09-22  
**Autor:** Antigravity AI  
**Estado:** Propuesta para Revisión  
**Ruta del Spec:** `docs/superpowers/specs/2026-09-22-blindaje-pruebas-reales-end-to-end-design.md`

---

## 1. Visión General, Objetivos y Principio Anti-Tautológico

### 1.1 El Problema Actual
Las pruebas automatizadas existentes en el repositorio sufren de dos debilidades críticas:
1. **Falsa Confianza por Fallbacks en Pruebas:** Existen pruebas donde la configuración o la conexión a base de datos utiliza cadenas de rescate (ejemplo: `_configuration.GetConnectionString("MongoDB") ?? "mongodb://localhost:27017/ordina_db"`). Si el archivo de configuración real de producción cambia de nombre, omite una clave o tiene sintaxis rota, las pruebas continúan pasando en verde artificialmente.
2. **Cobertura Desbalanceada:** No existen pruebas de integración sobre flujos medulares del frontend (autenticación JWT en React 19, conversiones multi-moneda con tasas BCV, filtros combinados de reportes) ni validaciones reales de estrés concurrente en el hardware de producción (Raspberry Pi 5 ARM64) o en los túneles y reglas WAF de Cloudflare.

### 1.2 Objetivo Central
Diseñar e implementar un sistema de pruebas riguroso que **demuestre el estado fidedigno de cada componente y proceso del sistema**, garantizando que cualquier ruptura de contrato, mala configuración o regresión operativa provoque una falla inmediata y explícita (RED).

### 1.3 Principios Inquebrantables
* **Cero Fallbacks en Pruebas:** Prohibido el uso de operadores `??`, valores por defecto no solicitados o bloques `catch` silenciosos en el código de pruebas.
* **Prueba de Mutación Obligatoria:** Toda prueba debe fallar si se altera deliberadamente una regla de negocio o clave de configuración en el código productivo.
* **Inyección y Contratos Reales:** Los servicios deben resolverse contra el contenedor de dependencias real y colecciones reales de MongoDB.

---

## 2. Modelo de Orquestación Multi-Agente y Paralelismo

Para optimizar el tiempo de desarrollo y asegurar la máxima exigencia de calidad, el trabajo se estructura en subagentes paralelos con roles disjuntos:

```
                              [ ORQUESTADOR PRINCIPAL ]
                                          │
            ┌─────────────────────────────┴─────────────────────────────┐
            ▼                                                           ▼
   [ TRACK A: BACKEND & BD ]                                   [ TRACK B: FRONTEND & PWA ]
   (Subagente Implementador A)                                 (Subagente Implementador B)
            │                                                           │
   • Fase 1: Configuración Real & DI                          • Fase 3: Contextos, Auth & Divisas
   • Fase 2: MongoDB Real & Reglas de Negocio                 • Fase 4: Reportes, Filtros & Pedidos
            │                                                 • Fase 5: Resiliencia Offline & Outbox
            ▼                                                           ▼
   [ REVISOR PESIMISTA A ]                                     [ REVISOR PESIMISTA B ]
   (Auditoría Adversarial Backend)                             (Auditoría Adversarial Frontend)
            │                                                           │
            └─────────────────────────────┬─────────────────────────────┘
                                          │ (Ambos tracks aprobados)
                                          ▼
                         [ TRACK C: CONVERGENCIA E INFRAESTRUCTURA ]
                         (Subagente Implementador C)
                                  • Fase 6: E2E Maestro, Estrés RPi 5 & Cloudflare
                                          │
                                          ▼
                                 [ REVISOR PESIMISTA C ]
                                 (Auditoría Adversarial E2E & Infra)
```

### 2.1 Roles por Fase
1. **Subagente Implementador (`/goal`)**:
   - Trabaja de manera autónoma en el código productivo y en los archivos de pruebas de la fase asignada.
   - Sigue el *How-To* metodológico específico sin desviaciones.
   - Termina cuando todas las pruebas de su suite están escritas y pasando.
2. **Subagente Revisor Pesimista (Adversarial Review)**:
   - Actúa como "Red Team" con mentalidad escéptica.
   - Aplica **pruebas de mutación**: introduce pequeños errores en el código (invertir una condición booleana, cambiar un nombre de clave, alterar un cálculo de moneda) y confirma que la prueba **falle de inmediato**.
   - Busca dependencias ocultas o mocks que no reflejen el entorno real.
   - Solo emite veredicto de `APROBADO` si no detecta falsos positivos.

### 2.2 Estrategia de Paralelismo
* **Paralelismo Total Inicial:**
  * **Track A (Backend):** Fases 1 y 2 se ejecutan en su propio hilo de trabajo en el árbol `Ordina.Backend`.
  * **Track B (Frontend):** Fases 3, 4 y 5 se ejecutan concurrentemente en el árbol `Ordina.Frontend`.
  * Ambos tracks operan sin conflictos de archivos compartidos.
* **Convergencia Final:**
  * **Track C (Infraestructura y E2E):** La Fase 6 inicia una vez que los Tracks A y B han sido auditados y aprobados por sus respectivos revisores pesimistas.

---

## 3. Especificación Detallada por Fases

### Fase 1: Configuración Real, Arranque y Contratos Base (Backend Core)
* **Objetivo:** Garantizar que `appsettings.json`, variables de entorno y el contenedor de inyección de dependencias (`Program.cs`) fallen si los contratos o secretos están ausentes.
* **Componentes a probar:**
  * `DatabaseConfigurationAndConnectionTests.cs`: Eliminar la cadena de fallback `?? "mongodb://..."`. Cargar directamente el `appsettings.Development.json` y `appsettings.json` físicos del proyecto `Ordina.Api`.
  * `DependencyInjectionValidationTests.cs`: Crear test que ejecute `builder.Services.AddInfrastructure()` y `AddApplication()`, construyendo el `IServiceProvider` con `ValidateScopes = true` y `ValidateOnBuild = true`. Resolver explícitamente `OrdersController`, `MongoDbContext`, `IOrderService`, `IProductService`, etc.
  * `MiddlewarePipelineTests.cs`: Validar que `IdempotencyMiddleware` rechace cabeceras corruptas y devuelva la respuesta cacheada ante un `X-Mutation-Id` repetido. Validar que `GlobalExceptionMiddleware` capture excepciones no controladas y devuelva `ProblemDetails` RFC 7807 sin stacktraces sensibles.

### Fase 2: Dominio, Servicios de Negocio y Base de Datos Real (Backend & MongoDB)
* **Objetivo:** Reemplazar mocks artificiales de `IMongoCollection` con pruebas contra una base de datos MongoDB real aislada (instancia de test limpia por suite).
* **Componentes a probar:**
  * **Índices de MongoDB:** Verificar que los índices requeridos por las consultas de alto tráfico existan físicamente en las colecciones (índices únicos en `orderNumber`, índices en `status`, índices de texto en `products`).
  * **Máquina de Estados de Órdenes:** Prohibir transiciones ilegales (ej. pasar una orden de `Generado` directamente a `Entregado` sin asignación a taller o despacho; prohibir cancelar una orden ya entregada).
  * **Cálculo Financiero y Pagos Mixtos:** Cálculo exacto de líneas de pedido, recargos de variantes, abonos parciales, descuentos e impuestos. Pruebas de pagos combinados (Efectivo Divisas + Pago Móvil Bs + Cashea) validando la conversión a tasa BCV.
  * **Seguridad y RBAC:** Validar que los endpoints protegidos con atributos de autorización exijan los permisos definidos en `Permissions.cs` y rechacen tokens con permisos insuficientes (`403 Forbidden`).

### Fase 3: Estado, Autenticación y Contextos (Frontend Core)
* **Objetivo:** Blindar la gestión de estado global de React 19 con `bun test`.
* **Componentes a probar:**
  * `AuthContext`: Sesión silenciosa desde cookies HttpOnly, expiración del token tras el periodo de gracia (1 hora) y preservación ante fallos de red dentro de la gracia. Permisos de usuario vía `hasPermission(permission)` con roles estándar (`admin`, `seller`, `workshop`, `delivery`).
  * `CurrencyContext`: Carga y refresco periódico de tasas activas (BCV). Conversión de montos multidivisa con precisión de 2 decimales. Manejo de fallback ordenado cuando el servidor de tasas está inaccesible (`"(sin tasa BCV)"`).
  * `NavigationContext`: Filtrado estricto del árbol de navegación según el rol del usuario autenticado y banderas `superAdminOnly`.

### Fase 4: Flujos de Negocio, Formularios y Filtros (Frontend Slices)
* **Objetivo:** Verificar la integridad visual, lógica y reactiva de los componentes de cara al usuario.
* **Componentes a probar:**
  * `payments-report`: Carga de datasets masivos (100+ filas). Filtros cruzados por rango de fechas, cuenta bancaria, forma de pago y estado de conciliación. Verificación de que la selección de filas se limpie al cambiar filtros para evitar operaciones accidentales sobre IDs no visibles.
  * `manufacturing-report`: Filtrado por estado (`debe_fabricar`, `por_fabricar`, `fabricando`, `almacen_no_fabricado`), taller y fechas. Verificación de cero re-renders en cascada (`react(set-state-in-effect)`).
  * Formularios de Pedido: Cálculos automáticos de subtotales, totales, adición de pagos parciales y verificación de campos obligatorios.

### Fase 5: Resiliencia Offline y PWA (Outbox & IndexedDB)
* **Objetivo:** Validar la capacidad de supervivencia operativa del frontend ante interrupciones de red o caídas del servidor.
* **Componentes a probar:**
  * `connectivityManager`: Transición precisa a `unreachable` ante fallos de transporte (`Failed to fetch`) o errores de gateway (502, 503, 504).
  * Aislamiento de Errores 500: Demostrar que un error de aplicación HTTP 500 **no** activa el modo offline.
  * `localApi` e IndexedDB: Creación de clientes y pedidos en almacenamiento local con prefijos temporales (`ord_off_...`, `cli_off_...`).
  * `syncManager`: Drenado secuencial FIFO al restablecer conexión, propagación de `X-Mutation-Id` y reconciliación de IDs temporales por las entidades canónicas de MongoDB.
  * Service Worker: Precaching de activos de producción (`dist/sw.js`) y navegación sin conexión.

### Fase 6: E2E, Estrés en RPi 5 y Verificación de Producción Cloudflare
* **Objetivo:** Certificar la solución completa en condiciones reales de carga, límites térmicos del hardware y seguridad perimetral.
* **Componentes a probar:**
  * **Flujo E2E Completo:** Script que simule el ciclo de vida completo de una orden (Creación de cliente -> Pedido personalizado -> Pago inicial -> Asignación a taller -> Finalización de fabricación -> Pago final de saldo restante -> Asignación de ruta y entrega).
  * **Pruebas de Estrés en RPi 5:** Herramienta de carga (`k6` o `bombardier`) ejecutando 50 usuarios concurrentes sostenidos durante 5 minutos contra el backend en el Raspberry Pi 5.
    * Monitoreo de memoria (límite estricto dentro de 16 GB).
    * Monitoreo térmico y estrangulamiento (`vcgencmd measure_temp` < 75°C, `vcgencmd get_throttled` == 0).
    * Latencia percentil 95 (P95 < 250 ms).
  * **Infraestructura Cloudflare:** Auditoría de configuración del túnel TCP/HTTP `cloudflared`, verificación de reglas WAF contra inyecciones y rate-limiting en endpoints de autenticación (`/api/auth/login`).

---

## 4. Matriz de Entregables y Criterios de Aceptación

| Fase | Artefactos / Pruebas Creadas | Comando de Verificación | Criterio de Éxito |
| :--- | :--- | :--- | :--- |
| **Fase 1** | Tests de DI, Configuration y Middlewares en `Ordina.Api.Tests` | `dotnet test Ordina.Backend/tests/Ordina.Api.Tests` | 100% pasando, cero fallbacks `??`, falla si `appsettings` cambia. |
| **Fase 2** | Tests de MongoDB real, Órdenes, Pagos y RBAC en `Ordina.Application.Tests` | `dotnet test Ordina.Backend/tests/Ordina.Application.Tests` | Colección real de prueba, índices verificados, transiciones validadas. |
| **Fase 3** | Tests de `AuthContext`, `CurrencyContext`, `NavigationContext` | `bun test src/contexts/__tests__/` | 100% pasando, ciclo de JWT validado, permisos verificados. |
| **Fase 4** | Tests de filtros de reportes y formularios de pedidos | `bun test src/components/__tests__/` | Datasets complejos, filtros combinados limpios, cero estados fantasma. |
| **Fase 5** | Tests de cortes de red, cola outbox y reconciliación de IDs | `bun test src/lib/__tests__/` | Reconciliación `ord_off_...` probada, aislamiento de 500 probado. |
| **Fase 6** | Script E2E, script k6 de estrés y auditoría Cloudflare | `k6 run scripts/stress-test.js` y `dotnet test --filter Category=E2E` | P95 < 250 ms, 0% errores 500, temperatura RPi 5 estable. |

---

## 5. Próximos Pasos

1. Revisión y aprobación del presente documento de diseño (`2026-09-22-blindaje-pruebas-reales-end-to-end-design.md`) por el usuario.
2. Generación del plan de implementación formal en `docs/superpowers/plans/2026-09-22-blindaje-pruebas-reales-end-to-end.md` y en el artefacto `implementation_plan.md`.
3. Despacho en paralelo de los subagentes del **Track A (Backend)** y **Track B (Frontend)**.

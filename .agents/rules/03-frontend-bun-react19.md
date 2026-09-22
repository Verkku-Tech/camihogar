# Reglas de Desarrollo Frontend (Bun + Vite + React 19 + TypeScript)

Este documento define los estándares técnicos, patrones de estado y directrices de UI para el frontend SPA de **Camihogar / Ordina** (`Ordina.Frontend`).

---

## 1. Tooling y Ejecución con Bun

1. **Gestor de Paquetes Exclusivo:** Usar `bun` para todas las operaciones de frontend:
   - `bun install`: Instalación de dependencias.
   - `bun run dev`: Servidor de desarrollo con Vite HMR.
   - `bun test`: Runner nativo de pruebas unitarias y de integración.
   - `bun run build`: Compilación estática del bundle en `dist/`.
2. **Cero Runtime de Node en Producción:** El artefacto final en `dist/` es 100% estático, listo para Cloudflare Pages o Nginx.

---

## 2. TypeScript Estricto y Tipado Seguro

1. **Configuración Estricta:** `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`.
2. **Prohibido el uso de `any`:**
   - Usar `unknown` con type guards, o esquemas de validación con **Zod** para respuestas externas.
3. **Prohibido `React.FC` / `React.FunctionComponent`:**
   - Tipar directamente los props en los parámetros de la función (`function Component({ title }: ComponentProps)`). `React.FC` añade tipado implícito innecesario y complica el uso de genéricos.
4. **Imports de Tipos con `import type`:**
   - Todo import exclusivo de tipos o interfaces debe usar `import type { ... }` para evitar ciclos de importación en runtime y permitir tree-shaking óptimo en el bundler.
5. **Event Handlers Estrictamente Tipados:**
   - Cero `(e: any)`. Tipar con `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`, `React.MouseEvent<HTMLButtonElement>`, etc.
6. **Estados Fuertemente Tipados (String Literal Unions):**
   - Nunca usar strings libres para estados, roles o etapas:
   ```typescript
   export type OrderStatus = 'Draft' | 'Confirmed' | 'InProduction' | 'Ready' | 'Delivered' | 'Cancelled';
   export type ManufacturingStage = 'Corte' | 'Armado' | 'Tapiceria' | 'Pintura' | 'ControlCalidad' | 'Empacado';
   ```

---

## 3. Manejo de Estado, TanStack Query v5 y Persistencia Offline (IndexedDB)

1. **Estándares Modernos de TanStack Query v5:**
   - **Prohibido callbacks en `useQuery`:** `onSuccess`, `onError` y `onSettled` están eliminados de `useQuery` en v5. Manejar efectos derivados en `useEffect`, computar valores directamente con `select: (data) => ...`, o usar callbacks exclusivamente en mutaciones (`useMutation`).
   - **Paginación Suave con `placeholderData`:** `keepPreviousData: true` está obsoleto/eliminado. Usar `placeholderData: keepPreviousData` (importado de `@tanstack/react-query`).
   - **Uso de `isPending` vs `isLoading`:** En TanStack Query v5, `isPending` es el estado inicial sin datos (en queries y mutaciones). `isLoading` equivale a `isPending && isFetching`. Comprobar `isPending` para spinners y bloqueos de botón.
   - **Query Key Factories Determinísticas:** Usar arrays tipados y estructurados para query keys (e.g. `['orders', 'list', { page, status }]`), nunca strings sueltos o desestructurados.
2. **Arquitectura de 3 ObjectStores en IndexedDB (`camihogar_offline_db`):**
   - `tanstack_cache`: Sincronización automática de queries mediante `@tanstack/react-query-persist-client` (`staleTime: 5 min`, `gcTime: 24h`).
   - `outbox_mutations`: Cola de mutaciones offline (POST/PUT/DELETE) con `mutationId` (UUIDv4) para garantizar idempotencia al reconectar.
   - `telemetry_buffer`: Buffer local para retener logs/errores cuando no hay internet y despacharlos en lote al volver en línea.
3. **Idempotencia en Mutaciones:**
   - Toda mutación que modifique datos debe enviar la cabecera `X-Mutation-Id: <uuid>` para evitar duplicados en reintentos de red.
4. **Cancelación Automática de Peticiones (`AbortSignal`):**
   - Pasar siempre el `signal` de TanStack Query a las peticiones del cliente API para abortar requests pendientes cuando el usuario navega o desmonta la vista.

---

## 4. Paginación y Filtros en el Servidor (URL-Driven State)

1. **Filtros Sincronizados con la URL:**
   - La página actual (`page`), el tamaño (`pageSize`), el texto de búsqueda (`search`) y los filtros (`status`, `stage`, `dateRange`) deben reflejarse en los search params de la URL (`useSearchParams`).
2. **Cero Paginación Completa en Memoria del Cliente:**
   - No descargar 5.000 pedidos para paginarlos en el navegador; consumir siempre endpoints paginados (`PagedResult<T>`).

---

## 5. Telemetría de Errores y Conexión con Aspire Dashboard

1. **Captura Universal de Errores:**
   - Toda excepción de React debe ser atrapada por `ErrorBoundary.tsx` y enviada a `telemetry.ts`.
   - `telemetry.ts` despacha `POST /api/telemetry/client-logs` al backend .NET 10 para su visualización en tiempo real en el **Aspire Dashboard**.
2. **Buffer de Telemetría Offline:**
   - Si no hay conexión al fallar, el error se guarda en `telemetry_buffer` de IndexedDB y se despacha apenas se restablece la red.

---

## 6. Estándares y Patrones Modernos de React 19

1. **`ref` como Prop Normal (Cero `forwardRef`):**
   - En React 19, `forwardRef` está obsoleto. Pasar y recibir `ref` como una prop estándar en cualquier componente funcional:
   ```typescript
   export function Input({ className, type, ref, ...props }: React.ComponentProps<"input">) {
     return <input ref={ref} type={type} className={cn("...", className)} {...props} />;
   }
   ```
2. **Acciones Asíncronas y Formularios (`useActionState` & `useFormStatus`):**
   - Para envíos de formulario y mutaciones, preferir `useActionState` en lugar de múltiples `useState` manuales (`isLoading`, `error`, `data`):
   ```typescript
   const [state, formAction, isPending] = useActionState(async (prevState, formData: FormData) => {
     return await submitOrderAction(formData);
   }, null);
   ```
3. **Actualizaciones Optimistas Nativas (`useOptimistic`):**
   - Para cambios inmediatos en la interfaz de taller (Kanban) o cambio de estados mientras se procesa la red:
   ```typescript
   const [optimisticStage, setOptimisticStage] = useOptimistic(
     currentStage,
     (state, newStage: ManufacturingStage) => newStage
   );
   ```
4. **Contexto Simplificado y Hook `use`:**
   - Usar `<AuthContext value={auth}>` directamente (eliminar `.Provider`).
   - Usar `use(AuthContext)` para lectura flexible (incluso condicional).
5. **Metadatos Nativos de Documento:**
   - Usar directamente `<title>` y `<meta>` dentro de los componentes; React 19 los eleva automáticamente al `<head>`.
6. **Prohibido `defaultProps` en Componentes Funcionales:**
   - En React 19 `defaultProps` en funciones está formalmente deprecado. Usar parámetros por defecto de ES6 en la desestructuración de props (`function Card({ variant = 'default' }: CardProps)`).
7. **Cero Sobre-memoización Innecesaria:**
   - No envolver valores primitivos simples (booleanos, strings, enteros) ni operaciones aritméticas $O(1)$ en `useMemo`.
   - No envolver callbacks inline triviales en `useCallback` a menos que se pasen a componentes optimizados con `React.memo` o formen parte de la lista de dependencias de un hook.

---

## 7. Compartimentación de Hooks y Separación de Responsabilidades

1. **Cero Reprocesamiento Masivo de Datos en el Frontend:**
   - **Prohibido:** Descargar una lista genérica de todas las órdenes y ejecutar `.filter()`, `.map()`, `.reduce()` complejos en el navegador para armar la vista de un módulo específico.
   - **Regla:** Toda la lógica pesada, filtros, agrupaciones y proyecciones **deben resolverse en el backend** mediante consultas específicas a MongoDB.
2. **Hooks Co-localizados por Módulo (`src/modules/<feature>/hooks/`):**
   - Cada módulo debe tener sus propios hooks a la medida que consuman su endpoint específico:
     * `src/modules/fabricacion/hooks/useManufacturingQueue.ts` -> Consume `GET /api/manufacturing/queue`.
     * `src/modules/despachos/hooks/useDispatchRoutes.ts` -> Consume `GET /api/dispatch/routes`.
     * `src/modules/pedidos/hooks/useOrdersList.ts` -> Consume `GET /api/orders`.
     * `src/modules/finanzas/hooks/useCommissionReport.ts` -> Consume `GET /api/finance/commissions`.
3. **Cuándo Compartir vs Cuándo Compartimentar:**
   - **Compartir (en `src/hooks/` o `src/lib/`):** Únicamente utilidades técnicas transversales (`useOnlineStatus`, `useDebounce`, `useLocalStorage`, `useAuth`).
   - **Compartimentar (en `src/modules/<feature>/`):** Todos los hooks de negocio, DTOs de vista, componentes de detalle y mutaciones.

---

## 8. Sistema de Diseño "Verkku Precision Atelier"

1. **Paleta de Colores de Marca y Estados:**
   - Primario (Marca): `#1CB569` (Verkku Emerald Green).
   - Fondos: `#111418` (Grafito Dark) / `#F8F9FA` (Alabaster Light).
   - Estados: Taller (`#D97706` Ámbar), Despacho (`#3B82F6` Azul Acero), Alerta/Refabricación (`#EF4444` Terracota).
2. **Tipografías:**
   - Interfaz & Títulos: `Plus Jakarta Sans`.
   - Números, Monedas & Métricas: `JetBrains Mono`.
3. **Ergonomía:**
   - Botones y tarjetas de taller táctiles y amplias (optimizadas para tablets de operarios).
   - Indicador de estado de sincronización (`SyncBadge`) visible en el encabezado (🟢 En línea / 🟡 X cambios pendientes / 🔴 Offline).

---

## 9. Animaciones de Carga y Skeletons (`boneyard-js`)

1. **Cero Pantallas en Blanco o Métricas Vacías en Carga:**
   - Ninguna página o componente debe mostrar métricas con valores vacíos (e.g. `$0.00`) o contenedores vacíos mientras se completan las solicitudes asíncronas de red.
2. **Estándar con `boneyard-js`:**
   - Envolver componentes, tarjetas KPI y gráficos con `<Skeleton loading={isLoading} name="...">` de `boneyard-js/react`.
   - Proporcionar siempre un componente `fallback` (o pre-generar los bones del layout) utilizando elementos animados (`animate-pulse` / `shimmer`) para garantizar que la transición visual sea suave y no genere saltos abruptos de layout (Cumulative Layout Shift - CLS).
3. **Respeto a Paleta y Dimensiones:**
   - Los esqueletos deben replicar la altura, bordes redondeados y márgenes del componente final renderizado.

---

## 10. Antipatrones Críticos a Evitar

### A. Conectividad y Modo Offline
1. **Evaluar disponibilidad con `navigator.onLine`:** `navigator.onLine` solo verifica que el dispositivo tenga un enlace de red activo (WiFi/datos), no que el backend esté vivo o la base de datos conectada. Usar siempre `useConnectivity().isServerReachable` o `connectivityManager.isServerUnreachable()`.
2. **Tratar el error HTTP 500 como caída del servidor:** Un 500 es un bug no controlado en un endpoint particular, no una falla de conectividad. No debe activar el modo offline ni cortar la comunicación para el resto de la aplicación. Solo activar offline ante errores de transporte/red, códigos de caída de infraestructura/gateway (`502`, `503`, `504`) o `/api/health` insalubre.
3. **Dejar registros huérfanos tras sincronizar el Outbox:** Las creaciones offline generan IDs temporales (`ord_off_...`, `cli_off_...`). Al drenar el outbox con éxito, se debe eliminar la entidad provisional local de IndexedDB y almacenar la entidad canónica devuelta por el servidor.
4. **Drenar el Outbox fuera de orden cronológico:** Las mutaciones deben procesarse en orden FIFO estricto (`createdAt` ascendente) para evitar conflictos de concurrencia (`409 Conflict`) o inconsistencias lógicas.

### B. Catálogos, Filtros y Paginación
5. **Filtros dependientes de la memoria de la página (*Memory-Coupled Filters*):** Nunca calcular opciones de filtros (vendedores, tiendas, cuentas, proveedores) deduciendo de los items ya cargados en la página actual. Usar catálogos centralizados (`useActiveCatalogs`) cacheados con `staleTime` razonable y filtrando únicamente registros con estado activo.
6. **Descargar colecciones masivas para filtrar en el navegador:** No solicitar `pageSize=10000` para filtrar o paginar en memoria en modo online; delegar la consulta y paginación en el servidor (`useServerPagination`).
7. **Invalidación global indiscriminada (*Shotgun Cache Invalidation*):** No llamar a `queryClient.invalidateQueries()` sin argumentos ante mutaciones locales; invalidar únicamente las query keys específicas del dominio afectado.

### C. React y Ciclo de Render
8. **Declarar componentes dentro del cuerpo de la función renderizadora:** Provoca reinicio de estado y desmontajes innecesarios del DOM en cada render (advertencia `react(static-components)`). Declarar subcomponentes fuera del componente principal o en archivos propios.
9. **Sincronizar estado derivado mediante `useEffect` (*Effect Waterfall*):** No usar efectos para recalcular totales, saldos o listas filtradas; preferir `useMemo` o selectores puros.
10. **Mutaciones de datos sin cabecera de idempotencia:** Toda petición `POST`, `PUT` o `DELETE` debe incluir `X-Mutation-Id: <uuid>` para prevenir duplicados ante reintentos automáticos de red o del outbox.

### D. TypeScript y TanStack Query v5
11. **Callbacks en `useQuery` (`onSuccess`, `onError`, `onSettled`):** Incompatibles y eliminados en TanStack Query v5. Usar callbacks solo en `useMutation` o selectores en `useQuery`.
12. **Uso de `keepPreviousData: true`:** Propiedad obsoleta. Debe usarse `placeholderData: keepPreviousData`.
13. **Tipado con `React.FC`:** No usar `React.FC` ni `React.FunctionComponent`. Tipar directamente los parámetros de la función del componente.
14. **Imports de tipos sin `import type`:** Siempre usar `import type { ... }` para evitar incluir tipos en el bundle JavaScript de runtime.


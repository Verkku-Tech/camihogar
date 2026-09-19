# Ordina.Frontend — SPA Estática React 19 + Vite + Bun + PWA Offline

Frontend cliente de alta disponibilidad para **Camihogar / Ordina ERP**, construido con **React 19**, **Vite**, **TypeScript** y **TanStack Query**, optimizado para el runtime de ultra alta velocidad **Bun** y diseñado como una **PWA Offline-First** desplegable en **Cloudflare Pages**.

---

## 🏛️ Características de Arquitectura

1. **Rendimiento Instantáneo con Bun & Vite:**
   - Instalación ultrarrápida de dependencias (`bun install`).
   - Compilación estática de producción en ~300 ms (`bun run build`).
   - Ejecución de pruebas unitarias nativas en milisegundos (`bun test`).
   - Cero necesidad de mantener un servidor Node.js en ejecución en producción (SPA 100% estático).

2. **PWA Offline-First Indestructible:**
   - **Service Worker Resiliente:** Intercepta caídas de red y respuestas de error `>= 500` (p. ej. *502 Bad Gateway* de Cloudflare), sirviendo la interfaz y los datos desde el App Shell local.
   - **Arquitectura de 3 Stores en IndexedDB:**
     - `tanstack_cache`: Persistencia del estado de servidor y consultas frecuentes de TanStack Query.
     - `outbox_mutations`: Cola de mutaciones (`POST`, `PUT`, `PATCH`, `DELETE`) encoladas sin conexión con orden FIFO y resolución secuencial al recuperar la red.
     - `telemetry_buffer`: Almacén local de logs y errores no controlados, volcados hacia `/api/telemetry/client-logs` cuando hay conexión disponible.

3. **Seguridad Robusta (Inmune a XSS y CSRF):**
   - **Access Token en Memoria React:** El token JWT de acceso vive exclusivamente en la memoria volátil de la aplicación; nunca se almacena en `localStorage` ni en `sessionStorage`.
   - **Silent Refresh:** Renovación transparente de tokens mediante cookies `HttpOnly; SameSite=Strict` a través de `/api/auth/refresh`.
   - **Anti-CSRF:** Inclusión obligatoria de la cabecera `X-Requested-With: XMLHttpRequest` en todas las peticiones con credenciales.
   - **Idempotencia:** Cada mutación genera y envía una cabecera `X-Mutation-Id: <UUIDv4>` para prevenir duplicados en caso de reintentos de red.

4. **Sistema de Diseño Verkku Precision Atelier:**
   - **Paleta de Identidad:** Verde Esmeralda (`#1CB569`), Grafito Cálido de Alto Contraste (`#111418`), Gris Borde Sutil (`#272B30`).
   - **Tipografía:** `Plus Jakarta Sans` para textos de interfaz legibles y `JetBrains Mono` para datos tabulares, montos y códigos de tracking.
   - **Componentes Modulares:** Formularios numéricos con soporte nativo de tasas BCV y conversión automática USD / Bs.

---

## 📂 Estructura del Código Fuente

```
Ordina.Frontend/
├── src/
│   ├── lib/                    # Núcleo de red y almacenamiento
│   │   ├── api-client.ts       # Cliente HTTP con silent refresh, Anti-CSRF e Idempotencia
│   │   ├── idb-store.ts        # Inicialización de almacenes IndexedDB nativos
│   │   ├── sync-manager.ts     # Gestor FIFO de sincronización de mutaciones fuera de línea
│   │   └── __tests__/          # Pruebas unitarias de clientes y stores
│   │
│   ├── contexts/               # Proveedores de estado global
│   │   └── AuthContext.tsx     # Contexto de autenticación, sesión y roles de usuario
│   │
│   ├── modules/                # Módulos organizados por caso de uso operativo
│   │   ├── orders/             # Gestión de órdenes, presupuestos y abonos
│   │   ├── manufacturing/      # Tablero de taller, avances de etapas y refabricación
│   │   ├── dispatch/           # Rutas de despacho, bodega y entregas
│   │   ├── clients/            # Búsqueda y gestión de clientes
│   │   └── finance/            # Tasa de cambio BCV, caja y conciliación
│   │
│   ├── components/             # Componentes UI reutilizables (Botones, Modales, Badges)
│   ├── types/                  # Definiciones de TypeScript estrictas (cero 'any')
│   ├── index.css               # Tokens CSS de Verkku Precision Atelier
│   ├── App.tsx                 # Enrutador principal y configuración de QueryClient
│   └── main.tsx                # Entrada de la aplicación y registro de PWA
│
├── public/                     # Recursos estáticos, manifest e iconos PWA
│   ├── favicon.ico
│   ├── manifest.json
│   └── data/abbaco/            # Datasets CSV migrados del sistema legacy
│
├── vite.config.ts              # Configuración de Vite con vite-plugin-pwa
├── tsconfig.json               # Configuración estricta de TypeScript
└── package.json                # Dependencias y scripts de Bun
```

---

## 🚀 Comandos de Desarrollo y Compilación

### Instalación de Dependencias
```bash
bun install
```

### Servidor de Desarrollo Local
```bash
bun dev
```
Inicia la aplicación en `http://localhost:5173` con recarga rápida (HMR).

### Verificación de Tipos y Calidad
```bash
# Validar tipos con TypeScript
bun run typecheck

# Análisis de linter (Oxlint / ESLint)
bun run lint
```

### Ejecución de Pruebas Unitarias
```bash
# Correr suite de pruebas unitarias
bun test

# Correr pruebas con reporte de cobertura
bun test --coverage
```

### Compilación para Producción
```bash
bun run build
```
Genera los archivos optimizados listos para desplegar en la carpeta `dist/`, registrando automáticamente el Service Worker (`dist/sw.js`) con las reglas de precaché de la PWA.

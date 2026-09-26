# Guía de Publicación y Despliegue Manual (Raspberry Pi & Cloudflare)

Esta guía detalla el procedimiento operativo para desplegar manualmente el **Backend Monolito Modular (.NET 10 ARM64)** en la Raspberry Pi 5 y el **Frontend SPA (Vite / React)** junto con el **Router A/B** en la infraestructura de Cloudflare (Pages & Workers).

---

## 1. Arquitectura de Despliegue y Acceso

```
                          [ Navegador / Cliente ]
                                     |
               +---------------------+---------------------+
               |                                           |
    (Sin cookie v2 / v1)                        (Cookie camihogar_version=v2)
               |                                           |
      camihogar.verkku.com                       camihogar.verkku.com / ?beta=1
               |                                           |
    [ Legacy RPi Port 3000 ]               [ Cloudflare Worker: camihogar-ab-router ]
    (Next.js App + Microservicios)                         |
                                           +---------------+---------------+
                                           |                               |
                                  Rutas estáticas / SPA               Rutas /api/*
                                           |                               |
                             [ Cloudflare Pages: camihogar-v2 ]     ch-api-v2.verkku.com
                                   (camihogar-v2.pages.dev)                |
                                                                [ Cloudflare Tunnel RPi ]
                                                                           |
                                                               [ ordina-modular-api:8090 ]
```

### Credenciales y Parámetros Clave
- **Host SSH RPi (vía túnel Cloudflare):** `127.0.0.1:9888` (Usuario: `sa`)
- **API Modular Pública:** `https://ch-api-v2.verkku.com`
- **Aspire Dashboard Modular:** `https://ch-admin-v2.verkku.com`
  - Token de acceso al dashboard: `Camihogar_Modular_Aspire_2026!`
- **Cloudflare Pages:** Proyecto `camihogar-v2` (`https://camihogar-v2.pages.dev`)
- **Directorio Backend en RPi:** `/home/sa/modular-monolith`

---

## 2. Prerrequisitos en la Máquina Local (Windows)

1. **Túnel SSH activo:**
   Para conectar por SSH/SCP a la Raspberry Pi, debe estar corriendo el cliente de túnel de Cloudflare en una consola en segundo plano:
   ```powershell
   cloudflared.exe access tcp --hostname ssh-camihogar.verkku.com --url localhost:9888
   ```
2. **Herramientas instaladas:**
   - `tar.exe` (nativo en Windows 10/11)
   - `ssh` y `scp` (OpenSSH nativo de Windows)
   - `bun` (gestor de paquetes y runtime para el Frontend)
   - `npx wrangler` (Cloudflare CLI autenticado)

---

## 3. Despliegue del Backend Modular en Raspberry Pi

El backend corre en un contenedor Docker con compilación nativa ARM64 (`linux/arm64`) dentro de la Raspberry Pi 5.

### Paso 3.1: Empaquetar el código fuente local
Desde PowerShell, genera el archivo comprimido excluyendo carpetas de compilación local (`bin`, `obj`, `.vs`):

```powershell
$backendDir = "f:\Verkku\Camihogar\.worktrees\refactor-modular-monolith\Ordina.Backend"
$archivePath = "$env:TEMP\modular-backend.tar.gz"

tar.exe -czf $archivePath --exclude="bin" --exclude="obj" --exclude=".vs" -C $backendDir .
```

### Paso 3.2: Transferir el paquete comprimido a la Raspberry Pi
Transfiere el archivo mediante `scp` a través del puerto 9888:

```powershell
scp -P 9888 -o StrictHostKeyChecking=no "$env:TEMP\modular-backend.tar.gz" sa@127.0.0.1:/home/sa/modular-backend.tar.gz
```

### Paso 3.3: Descomprimir en el directorio de trabajo del RPi
```powershell
ssh -p 9888 -o StrictHostKeyChecking=no sa@127.0.0.1 "tar -xzf /home/sa/modular-backend.tar.gz -C /home/sa/modular-monolith"
```

### Paso 3.4: Compilar la imagen Docker ARM64 y recrear el contenedor
En la Raspberry Pi, compila la imagen Docker `camihogar-modular-api:latest` y levanta el servicio `modular-api`:

```powershell
ssh -p 9888 -o StrictHostKeyChecking=no sa@127.0.0.1 "cd /home/sa/modular-monolith && sudo -n docker build -t camihogar-modular-api:latest -f src/Api/Dockerfile . && sudo -n docker compose -f docker-compose.modular.yml up -d --force-recreate modular-api"
```

> [!NOTE]
> En `docker-compose.modular.yml`, el nombre del servicio es **`modular-api`** (el contenedor resultante se llama `ordina-modular-api`).

### Paso 3.5: Verificar estado de los contenedores
```powershell
ssh -p 9888 -o StrictHostKeyChecking=no sa@127.0.0.1 "sudo docker ps --filter name=modular"
```
Debe listar:
- `ordina-modular-api` (puerto `8090->8080`)
- `ordina-modular-aspire-dashboard` (puerto `18889->18888`)

---

## 4. Despliegue del Frontend (Cloudflare Pages)

El frontend SPA Vite/React se compila localmente y se publica en Cloudflare Pages bajo el proyecto `camihogar-v2`.

### Paso 4.1: Compilar la aplicación Frontend
Asegúrate de estar en la carpeta del Frontend del worktree:

```powershell
cd f:\Verkku\Camihogar\.worktrees\refactor-modular-monolith\Ordina.Frontend
bun run build
```
Esto generará los assets optimizados en la carpeta `dist/`, incluyendo el Service Worker y el manifiesto PWA.

### Paso 4.2: Desplegar a Producción con Wrangler

> [!IMPORTANT]
> **El parámetro `--branch=main` es obligatorio.**
> Si ejecutas `wrangler pages deploy` desde una rama de desarrollo (como `feat/modular-monolith-refactor`) sin especificar `--branch=main`, Cloudflare lo desplegará como un entorno de *Preview* con URL temporal. El router en producción proxyfica a `camihogar-v2.pages.dev`, por lo que **debes** forzar el despliegue al entorno de producción usando `--branch=main`.

```powershell
npx wrangler pages deploy dist --project-name=camihogar-v2 --branch=main
```

### Paso 4.3: Validar el despliegue en Pages
Para comprobar que el despliegue figura como `Production`:
```powershell
npx wrangler pages deployment list --project-name=camihogar-v2
```

---

## 5. Despliegue del Router A/B (Cloudflare Workers)

El worker `camihogar-ab-router` intercepta el tráfico de `camihogar.verkku.com/*` e implementa:
- Gestión de la cookie `camihogar_version=v2` mediante query parameters `?beta=1` y `?beta=0`.
- Proxy transparente de llamadas `/api/*` al backend modular (`ch-api-v2.verkku.com`), eliminando peticiones CORS preflight `OPTIONS`.
- Sanitización de encabezados `Content-Disposition` en el Edge para evitar corrupción de nombres en descargas Excel.

Si realizas cambios en `camihogar-ab-router/src/index.ts`:

```powershell
cd f:\Verkku\Camihogar\.worktrees\refactor-modular-monolith\camihogar-ab-router
npx wrangler deploy
```

---

## 6. Comprobación y Uso del Sistema A/B

| Acción | URL | Resultado |
|---|---|---|
| **Activar V2 (Frontend SPA + Monolito)** | `https://camihogar.verkku.com/?beta=1` | Asigna la cookie `camihogar_version=v2` por 1 año y redirige a la nueva SPA. |
| **Revertir a V1 (Legacy Next.js)** | `https://camihogar.verkku.com/?beta=0` | Borra la cookie y devuelve al sistema legacy. |
| **Acceso directo SPA (sin router)** | `https://camihogar-v2.pages.dev` | Carga directa de la SPA en Cloudflare Pages. |
| **Monitoreo Aspire Dashboard** | `https://ch-admin-v2.verkku.com` | Métricas, trazas OTLP y logs estructurados del monolito. |

---

## 7. Preguntas Frecuentes y Solución de Problemas

### 1. ¿Por qué en Aspire Dashboard aparecen muchas instancias (`Ordina.Api-xxxxxxx`)?
Cada reinicio del proceso .NET genera un nuevo `service.instance.id` aleatorio. Aspire conserva en memoria el historial de instancias finalizadas (`Finished`) para auditoría de caídas. Si deseas limpiar el selector de logs y ver únicamente la instancia activa actual, reinicia el dashboard en el RPi:
```powershell
ssh -p 9888 -o StrictHostKeyChecking=no sa@127.0.0.1 "sudo docker restart ordina-modular-aspire-dashboard"
```

### 2. Error `no such service: ordina-modular-api` al ejecutar `docker compose`
En el archivo `docker-compose.modular.yml`, el nombre del servicio bajo `services:` es `modular-api`. Ejecuta:
```bash
sudo docker compose -f docker-compose.modular.yml up -d --force-recreate modular-api
```

### 3. El usuario ve la versión anterior tras publicar el frontend
Las Progressive Web Apps (PWA) y Service Workers almacenan en caché los bundles JavaScript anteriores en el navegador:
1. Pide al usuario realizar una recarga forzada: `Ctrl + Shift + R` (Windows) o `Cmd + Shift + R` (Mac).
2. O bien dirigirse a `Configuración -> Sistema` y pulsar el botón **Limpiar Datos Locales e IndexedDB**.

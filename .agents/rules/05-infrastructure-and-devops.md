# Regla 05: Infraestructura, Servidor (Raspberry Pi 5) y Operaciones DevOps

Este documento define la topología de red, especificaciones del servidor de producción, procedimiento de acceso remoto seguro (SSH), monitoreo y las restricciones de seguridad inquebrantables para el entorno de Camihogar / Ordina.

---

## 1. Topología de Infraestructura

```
[ Cliente Web / Móvil ]
         │
         ▼
[ Cloudflare (WAF + CDN + Pages) ]
         │
         ▼ (Cloudflare Tunnel seguro / TCP Proxy)
[ Raspberry Pi 5 (Servidor Producción) ]
  ├── OS: Debian 12 (Bookworm)
  ├── 16 GB RAM | 64 GB Almacenamiento
  ├── Cloudflared Daemon (/etc/cloudflared/config.yaml)
  └── Docker Engine
        ├── Ordina.Backend (.NET 10 API - ARM64 ReadyToRun)
        ├── MongoDB Container (Base de datos primaria)
        └── Aspire Dashboard (Monitoreo & Telemetría OTLP)
```

### Componentes Principales
1. **Cloudflare**:
   - **WAF y Seguridad**: Filtrado DDoS, reglas de rate limiting y firewall de aplicaciones web.
   - **CDN & Frontend Hosting**: Distribución de activos estáticos del frontend (PWA).
   - **Cloudflare Zero Trust / Tunnels**: Expone de manera segura el backend y túneles TCP sin necesidad de abrir puertos en el router (NAT traversal).

2. **Servidor Local de Producción (Raspberry Pi 5)**:
   - **Hardware**: Raspberry Pi 5 con 16 GB de RAM y 64 GB de almacenamiento.
   - **Sistema Operativo**: Debian 12 (Bookworm, arquitectura ARM64).
   - **Gestor de Túnel**: `cloudflared` administrado localmente (típicamente en `/etc/cloudflared/config.yaml` o `~/.cloudflared/`).
   - **Cargas de Trabajo Docker**:
     - `backend`: Contenedor .NET 10 optimizado para ARM64.
     - `database`: Contenedor MongoDB con persistencia en volumen Docker montado en host.
     - `aspire-dashboard`: Contenedor standalone de .NET Aspire para trazas, métricas y logs OTLP.

---

## 2. Procedimiento de Acceso Seguro por SSH

El acceso SSH al servidor no está expuesto directamente a internet; se realiza obligatoriamente a través del túnel TCP de Cloudflare Access.

### Paso 1: Abrir el túnel TCP local de Cloudflared
En la máquina local del desarrollador/agente, abrir el puerto local hacia el túnel:
```bash
cloudflared access tcp --hostname ssh-camihogar.verkku.com --url localhost:9888
```
*(Nota: Este comando inicia un proxy local escuchando en `localhost:9888`. Debe mantenerse en ejecución o correrse en segundo plano durante la sesión).*

### Paso 2: Conexión SSH mediante llave autorizada
En una terminal conectada al proxy local:
```bash
ssh sa@localhost -p 9888
```
- **Usuario**: `sa`
- **Puerto**: `9888`
- **Autenticación**: Llave SSH pública/privada (ya instalada y autorizada en el entorno local; **no** requiere contraseña).

---

## 3. REGLA DE SEGURIDAD ABSOLUTA: Comandos Destructivos Prohibidos

> [!CAUTION]
> **ESTRICTAMENTE PROHIBIDO EJECUTAR COMANDOS DESTRUCTIVOS SIN AUTORIZACIÓN EXPLÍCITA DEL USUARIO.**
> 
> Ningún agente AI tiene permiso para ejecutar acciones destructivas, de borrado de datos o que comprometan la continuidad del servicio sin solicitar y recibir confirmación directa del usuario humano.

### Acciones que REQUIEREN Aprobación Explícita:
1. **Base de Datos:**
   - `db.dropDatabase()`, `db.collection.drop()`, `mongosh` con operaciones `deleteMany({})` masivas.
   - Modificación o eliminación de directorios de datos de MongoDB (`/var/lib/mongodb`, volúmenes de Docker).
2. **Docker:**
   - `docker volume prune` o `docker volume rm` (riesgo inminente de pérdida de datos de la BD).
   - `docker system prune -a --volumes`.
   - `docker stop` o `docker rm -f` de los contenedores de producción en caliente sin plan de mantenimiento acordado.
3. **Sistema de Archivos y SO:**
   - `rm -rf` sobre directorios del sistema, configuraciones (`/etc/`) o rutas de la aplicación.
   - Cambios en `/etc/cloudflared/config.yaml` o reinicio del servicio de túnel que pueda cortar el acceso remoto.
   - `reboot`, `shutdown`, o modificaciones en reglas de firewall (`iptables`, `nftables`, `ufw`).

### Acciones Seguras y Frecuentes (Solo Lectura y Diagnóstico):
- Verificar estado del sistema: `uptime`, `htop`, `free -h`, `df -h`.
- Verificar temperatura y throttling del RPi 5: `vcgencmd measure_temp`, `vcgencmd get_throttled`.
- Estado de contenedores: `docker ps`, `docker stats --no-stream`.
- Lectura de logs: `docker logs --tail 100 <container_name>`.
- Estado del servicio túnel: `systemctl status cloudflared`.

---

## 4. Objetivos y Tareas Operativas Planificadas

### 1. Validación de Estatus del Servidor
- Monitoreo de recursos del host (uso de RAM sobre 16GB, espacio en disco sobre los 64GB).
- Alertas de temperatura y estado térmico del Raspberry Pi 5.
- Verificación periódica de salud de los endpoints de la API (`/api/health`) y MongoDB.

### 2. Publicación y Configuración del Aspire Dashboard
- Levantar y asegurar el contenedor `.NET Aspire Dashboard` en el host RPi 5.
- Exponer el dashboard a través del túnel de Cloudflare (`aspire.camihogar.verkku.com` o similar con Cloudflare Access).
- Configurar autenticación mediante `DOTNET_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS=false` y `BrowserToken`.
- Ingesta centralizada de telemetría OTLP (Backend .NET 10 y buffer de logs del Frontend).

### 3. Monitoreo de Base de Datos (MongoDB)
- Vigilar tamaño de colecciones, índices y estado de la caché WiredTiger.
- Métricas de conexiones activas del pool del backend.

### 4. Backups Periódicos Automatizados en la Nube
- Script automatizado de backup (`mongodump --gzip --archive=...`).
- Cifrado del archivo de backup.
- Subida programada (vía `cron` o contenedor de backup) a almacenamiento en la nube S3-compatible (Cloudflare R2, AWS S3 o Backblaze B2).
- Política de retención: rotación diaria (7 días), semanal (4 semanas) y mensual.

### 5. Scripts de Mantenimiento Seguro
- Limpieza de imágenes dangling de Docker (`docker image prune` sin tocar volúmenes).
- Rotación de logs de Docker para evitar que saturen el almacenamiento de 64GB (`max-size: "50m"`, `max-file: "3"`).

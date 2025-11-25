# 🚀 Guía de Despliegue - CamiHogar

Esta guía explica cómo desplegar CamiHogar en una Raspberry Pi usando Docker Hub y CI/CD automatizado.

## 📋 Requisitos Previos

- Raspberry Pi con Docker y Docker Compose instalados
- Cuenta de Docker Hub
- Repositorio en GitHub con el código

## 🔧 Configuración Inicial

### 1. Configurar GitHub Secrets

En tu repositorio de GitHub, ve a **Settings → Secrets and variables → Actions** y agrega:

- `DOCKER_USERNAME`: Tu usuario de Docker Hub
- `DOCKER_PASSWORD`: Token de acceso de Docker Hub (crear en Account Settings → Security → New Access Token)

### 2. Configurar la Raspberry Pi

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/camihogar.git
cd camihogar

# 2. Crear archivo .env desde el ejemplo
cp .env.example .env

# 3. Editar .env con tu usuario de Docker Hub
nano .env
# Cambiar: DOCKER_USERNAME=tu-usuario-dockerhub

# 4. Hacer el script de despliegue ejecutable
chmod +x deploy.sh

# 5. (Opcional) Si las imágenes son privadas, hacer login
docker login -u tu-usuario-dockerhub
```

## 🚀 Despliegue Inicial

```bash
# Ejecutar el script de despliegue
./deploy.sh
```

El script:
1. ✅ Verifica que Docker esté instalado
2. ✅ Carga las variables de entorno
3. ✅ Detiene contenedores existentes
4. ✅ Descarga las últimas imágenes de Docker Hub
5. ✅ Inicia todos los servicios
6. ✅ Muestra el estado de los contenedores

## 🔄 CI/CD Automatizado

### Flujo Completo

1. **Push a GitHub** → Se activa el workflow `.github/workflows/build-and-push.yml`
2. **GitHub Actions** → Compila todas las imágenes Docker
3. **Docker Hub** → Las imágenes se suben automáticamente
4. **Watchtower** → Detecta nuevas imágenes cada 5 minutos y actualiza los contenedores

### Imágenes Generadas

El workflow crea las siguientes imágenes en Docker Hub:

- `tu-usuario/camihogar-frontend:latest`
- `tu-usuario/camihogar-security-api:latest`
- `tu-usuario/camihogar-users-api:latest`
- `tu-usuario/camihogar-providers-api:latest`
- `tu-usuario/camihogar-orders-api:latest`
- `tu-usuario/camihogar-payments-api:latest`
- `tu-usuario/camihogar-apigateway:latest`

Cada imagen también se etiqueta con el SHA del commit para versionado.

## 📦 Watchtower - Actualización Automática

Watchtower está configurado para:

- ✅ Monitorear imágenes cada 5 minutos
- ✅ Actualizar automáticamente contenedores con nuevas imágenes
- ✅ Limpiar imágenes antiguas automáticamente
- ✅ Solo actualizar contenedores con la etiqueta `com.centurylinklabs.watchtower.enable=true`

### Configuración de Watchtower

En `docker-compose.prod.yml`:

```yaml
watchtower:
  environment:
    - WATCHTOWER_POLL_INTERVAL=300  # 5 minutos
    - WATCHTOWER_CLEANUP=true       # Limpiar imágenes antiguas
    - WATCHTOWER_LABEL_ENABLE=true  # Solo actualizar con label
```

## 🔧 Comandos Útiles

### Ver logs de todos los servicios
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Ver logs de un servicio específico
```bash
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f security-api
```

### Detener todos los servicios
```bash
docker-compose -f docker-compose.prod.yml down
```

### Reiniciar un servicio específico
```bash
docker-compose -f docker-compose.prod.yml restart frontend
```

### Ver estado de los contenedores
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Forzar actualización manual (sin esperar Watchtower)
```bash
./deploy.sh
```

### Ver logs de Watchtower
```bash
docker logs watchtower -f
```

## 🐛 Troubleshooting

### Las imágenes no se actualizan automáticamente

1. Verificar que Watchtower está corriendo:
   ```bash
   docker ps | grep watchtower
   ```

2. Verificar logs de Watchtower:
   ```bash
   docker logs watchtower
   ```

3. Verificar que los contenedores tienen el label correcto:
   ```bash
   docker inspect camihogar-frontend | grep watchtower
   ```

### Error al hacer pull de imágenes

1. Verificar que estás logueado en Docker Hub:
   ```bash
   docker login
   ```

2. Verificar que las imágenes existen en Docker Hub:
   ```bash
   docker pull tu-usuario/camihogar-frontend:latest
   ```

### Los servicios no inician

1. Verificar logs:
   ```bash
   docker-compose -f docker-compose.prod.yml logs
   ```

2. Verificar que las variables de entorno están correctas:
   ```bash
   cat .env
   ```

3. Verificar que los puertos no están ocupados:
   ```bash
   sudo netstat -tulpn | grep -E ':(3000|8080|8082|8083|8084|8085|8086)'
   ```

## 📝 Notas Importantes

- ⚠️ **Datos persistentes**: Los volúmenes de PostgreSQL, MongoDB y Redis se mantienen entre reinicios
- ⚠️ **Backups**: Asegúrate de hacer backups regulares de los volúmenes
- ⚠️ **Seguridad**: Cambia las contraseñas por defecto en producción
- ⚠️ **Red**: Los servicios están en la red `ordina-network` para comunicación interna

## 🔐 Seguridad en Producción

1. **Cambiar contraseñas por defecto** en `docker-compose.prod.yml`
2. **Usar variables de entorno** para secretos sensibles
3. **Configurar firewall** en la Raspberry Pi
4. **Usar HTTPS** con un reverse proxy (nginx, traefik)
5. **Hacer imágenes privadas** en Docker Hub si es necesario

## 📚 Recursos Adicionales

- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)
- [Watchtower Documentation](https://containrrr.dev/watchtower/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)


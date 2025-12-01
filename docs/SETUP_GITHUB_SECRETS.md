# 🔐 Configuración de GitHub Secrets

Este documento explica cómo configurar los secrets de GitHub para el CI/CD.

## 📋 Secrets Necesarios

Necesitas configurar los siguientes secrets en tu repositorio de GitHub:

1. **DOCKER_USERNAME**: Tu usuario de Docker Hub (ej: `verkkutech`)
2. **DOCKER_PASSWORD**: Tu token de acceso de Docker Hub (obtener en Account Settings → Security → New Access Token)

## 🚀 Pasos para Configurar

### 1. Ir a la Configuración del Repositorio

1. Ve a tu repositorio en GitHub
2. Haz clic en **Settings** (Configuración)
3. En el menú lateral, ve a **Secrets and variables** → **Actions**

### 2. Agregar DOCKER_USERNAME

1. Haz clic en **New repository secret**
2. **Name**: `DOCKER_USERNAME`
3. **Secret**: `verkkutech`
4. Haz clic en **Add secret**

### 3. Agregar DOCKER_PASSWORD

1. Haz clic en **New repository secret**
2. **Name**: `DOCKER_PASSWORD`
3. **Secret**: [Pega aquí tu token de acceso de Docker Hub]
   - Para obtener el token: ve a Docker Hub → Account Settings → Security → New Access Token
4. Haz clic en **Add secret**

## ✅ Verificación

Una vez configurados los secrets, puedes verificar que están correctos:

1. Ve a **Settings** → **Secrets and variables** → **Actions**
2. Deberías ver ambos secrets listados:
   - `DOCKER_USERNAME`
   - `DOCKER_PASSWORD`

## 🧪 Probar el Workflow

Para probar que todo funciona:

1. Haz un push a la rama `main` o `master`
2. Ve a la pestaña **Actions** en GitHub
3. Deberías ver el workflow "Build and Push Docker Images" ejecutándose
4. Si todo está bien, verás las imágenes subiéndose a Docker Hub

## 📦 Imágenes que se Crearán

Con estos secrets, las imágenes se crearán en Docker Hub como:

- `verkkutech/camihogar-frontend:latest`
- `verkkutech/camihogar-security-api:latest`
- `verkkutech/camihogar-users-api:latest`
- `verkkutech/camihogar-providers-api:latest`
- `verkkutech/camihogar-orders-api:latest`
- `verkkutech/camihogar-payments-api:latest`
- `verkkutech/camihogar-apigateway:latest`

## 🔒 Seguridad

⚠️ **IMPORTANTE**: 
- Los secrets son encriptados y solo visibles para los workflows
- Nunca hardcodees estos valores en el código
- Si necesitas rotar el token, crea uno nuevo en Docker Hub y actualiza el secret

## 🔄 Actualizar el Token

Si necesitas actualizar el token de Docker Hub:

1. Genera un nuevo token en Docker Hub (Account Settings → Security → New Access Token)
2. Ve a GitHub → Settings → Secrets and variables → Actions
3. Haz clic en el secret `DOCKER_PASSWORD`
4. Haz clic en **Update** y pega el nuevo token
5. Guarda los cambios


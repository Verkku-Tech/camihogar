#!/bin/bash
set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando despliegue de CamiHogar...${NC}"

# Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado. Por favor instálalo primero.${NC}"
    exit 1
fi

# Verificar que Docker Compose está instalado
if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose no está instalado. Por favor instálalo primero.${NC}"
    exit 1
fi

# Función para leer input del usuario
read_input() {
    local prompt=$1
    local default=$2
    local var_name=$3
    
    if [ -n "$default" ]; then
        echo -e "${BLUE}${prompt} [${default}]: ${NC}\c"
    else
        echo -e "${BLUE}${prompt}: ${NC}\c"
    fi
    
    read input
    if [ -z "$input" ] && [ -n "$default" ]; then
        input="$default"
    fi
    eval "$var_name='$input'"
}

# Función para configurar variables de entorno interactivamente
setup_env() {
    echo -e "${YELLOW}📝 Configuración de variables de entorno${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local username=""
    local frontend_image=""
    local apigateway_image=""
    local security_image=""
    local users_image=""
    local providers_image=""
    local orders_image=""
    local payments_image=""
    local ghcr_token=""
    
    read_input "Usuario de GitHub (para GHCR)" "" username
    read_input "Nombre de la imagen frontend" "camihogar-frontend" frontend_image
    read_input "Nombre de la imagen API Gateway" "camihogar-apigateway" apigateway_image
    read_input "Nombre de la imagen Security API" "camihogar-security-api" security_image
    read_input "Nombre de la imagen Users API" "camihogar-users-api" users_image
    read_input "Nombre de la imagen Providers API" "camihogar-providers-api" providers_image
    read_input "Nombre de la imagen Orders API" "camihogar-orders-api" orders_image
    read_input "Nombre de la imagen Payments API" "camihogar-payments-api" payments_image
    
    echo ""
    echo -e "${YELLOW}¿Las imágenes son privadas? (s/n)${NC}"
    read -p "> " is_private
    
    if [[ "$is_private" =~ ^[Ss]$ ]]; then
        read_input "Token de GitHub (GHCR_TOKEN)" "" ghcr_token
    fi
    
    # Crear archivo .env
    cat > .env << EOF
# GitHub Container Registry Configuration
# Generado automáticamente por deploy.sh

# Tu usuario de GitHub (para GHCR)
USERNAME=${username}

# Nombres de las imágenes
FRONTEND_IMAGE=${frontend_image}
APIGATEWAY_IMAGE=${apigateway_image}
SECURITY_IMAGE=${security_image}
USERS_IMAGE=${users_image}
PROVIDERS_IMAGE=${providers_image}
ORDERS_IMAGE=${orders_image}
PAYMENTS_IMAGE=${payments_image}

# Token de GitHub para pull de imágenes privadas (opcional)
EOF
    
    if [ -n "$ghcr_token" ]; then
        echo "GHCR_TOKEN=${ghcr_token}" >> .env
    else
        echo "# GHCR_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env
    fi
    
    echo ""
    echo -e "${GREEN}✅ Archivo .env creado exitosamente${NC}"
}

# Cargar o configurar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Variables de entorno cargadas desde .env${NC}"
    
    # Verificar si las variables necesarias están definidas
    if [ -z "$USERNAME" ]; then
        echo -e "${YELLOW}⚠️  USERNAME no está definido en .env${NC}"
        echo -e "${YELLOW}¿Deseas configurar las variables de entorno ahora? (s/n)${NC}"
        read -p "> " configure
        if [[ "$configure" =~ ^[Ss]$ ]]; then
            setup_env
            export $(cat .env | grep -v '^#' | xargs)
        else
            echo -e "${RED}❌ USERNAME es requerido. Por favor configura el archivo .env${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Archivo .env no encontrado.${NC}"
    if [ -f env.example ]; then
        echo -e "${YELLOW}¿Deseas configurar las variables de entorno ahora? (s/n)${NC}"
        read -p "> " configure
        if [[ "$configure" =~ ^[Ss]$ ]]; then
            setup_env
            export $(cat .env | grep -v '^#' | xargs)
        else
            echo -e "${YELLOW}   Creando .env desde env.example...${NC}"
            cp env.example .env
            echo -e "${RED}   ⚠️  IMPORTANTE: Edita el archivo .env con tus valores${NC}"
            echo -e "${RED}   Luego ejecuta este script nuevamente.${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}¿Deseas configurar las variables de entorno ahora? (s/n)${NC}"
        read -p "> " configure
        if [[ "$configure" =~ ^[Ss]$ ]]; then
            setup_env
            export $(cat .env | grep -v '^#' | xargs)
        else
            echo -e "${RED}❌ No se encontró .env ni env.example${NC}"
            exit 1
        fi
    fi
fi

# Verificar que USERNAME está definido
if [ -z "$USERNAME" ]; then
    echo -e "${RED}❌ USERNAME no está definido en .env${NC}"
    exit 1
fi

# Establecer valores por defecto si no están definidos
FRONTEND_IMAGE=${FRONTEND_IMAGE:-camihogar-frontend}
APIGATEWAY_IMAGE=${APIGATEWAY_IMAGE:-camihogar-apigateway}
SECURITY_IMAGE=${SECURITY_IMAGE:-camihogar-security-api}
USERS_IMAGE=${USERS_IMAGE:-camihogar-users-api}
PROVIDERS_IMAGE=${PROVIDERS_IMAGE:-camihogar-providers-api}
ORDERS_IMAGE=${ORDERS_IMAGE:-camihogar-orders-api}
PAYMENTS_IMAGE=${PAYMENTS_IMAGE:-camihogar-payments-api}

echo -e "${GREEN}📦 Configuración:${NC}"
echo -e "   Usuario GHCR: ${USERNAME}"
echo -e "   Frontend: ${FRONTEND_IMAGE}"
echo -e "   API Gateway: ${APIGATEWAY_IMAGE}"
echo -e "   Security API: ${SECURITY_IMAGE}"
echo -e "   Users API: ${USERS_IMAGE}"
echo -e "   Providers API: ${PROVIDERS_IMAGE}"
echo -e "   Orders API: ${ORDERS_IMAGE}"
echo -e "   Payments API: ${PAYMENTS_IMAGE}"

# Login a GHCR si es necesario
if [ -n "$GHCR_TOKEN" ]; then
    echo -e "${GREEN}🔐 Haciendo login en GHCR...${NC}"
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$USERNAME" --password-stdin 2>/dev/null || {
        echo -e "${YELLOW}⚠️  No se pudo hacer login automático. Verifica tu token.${NC}"
        echo -e "${YELLOW}   Puedes hacer login manualmente con:${NC}"
        echo -e "${YELLOW}   echo \$GHCR_TOKEN | docker login ghcr.io -u \$USERNAME --password-stdin${NC}"
    }
else
    echo -e "${YELLOW}ℹ️  GHCR_TOKEN no configurado. Asumiendo que las imágenes son públicas.${NC}"
fi

# Detener contenedores existentes
echo -e "${GREEN}📦 Deteniendo contenedores existentes...${NC}"
docker compose down || true

# Limpiar imágenes antiguas (opcional, comentado por defecto)
# echo -e "${GREEN}🧹 Limpiando imágenes antiguas...${NC}"
# docker system prune -f

# Pull de las últimas imágenes
echo -e "${GREEN}⬇️  Descargando últimas imágenes desde GHCR...${NC}"
docker compose pull || {
    echo -e "${RED}❌ Error al descargar imágenes. Verifica:${NC}"
    echo -e "${RED}   1. Que las imágenes existan en GHCR${NC}"
    echo -e "${RED}   2. Que tengas permisos para acceder a ellas${NC}"
    echo -e "${RED}   3. Que estés logueado si las imágenes son privadas${NC}"
    exit 1
}

# Iniciar servicios
echo -e "${GREEN}🚀 Iniciando servicios...${NC}"
docker compose up -d

# Esperar un momento para que los servicios inicien
echo -e "${GREEN}⏳ Esperando que los servicios inicien...${NC}"
sleep 10

# Mostrar estado
echo -e "${GREEN}✅ Despliegue completado!${NC}"
echo -e "${YELLOW}📊 Estado de los contenedores:${NC}"
docker compose ps

echo ""
echo -e "${GREEN}✨ Listo! Los servicios están ejecutándose.${NC}"
echo ""
echo -e "${YELLOW}📝 Comandos útiles:${NC}"
echo -e "   Ver logs:              docker compose logs -f"
echo -e "   Ver logs de un servicio: docker compose logs -f frontend"
echo -e "   Detener servicios:     docker compose down"
echo -e "   Reiniciar servicio:   docker compose restart frontend"
echo -e "   Ver estado:           docker compose ps"
echo ""
echo -e "${YELLOW}📝 Watchtower está configurado para actualizar automáticamente cada 30 segundos${NC}"
echo -e "${YELLOW}   Ver logs de Watchtower: docker logs watchtower -f${NC}"

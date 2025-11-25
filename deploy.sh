#!/bin/bash
set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando despliegue de CamiHogar...${NC}"

# Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado. Por favor instálalo primero.${NC}"
    exit 1
fi

# Verificar que Docker Compose está instalado
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose no está instalado. Por favor instálalo primero.${NC}"
    exit 1
fi

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Variables de entorno cargadas desde .env${NC}"
else
    echo -e "${YELLOW}⚠️  Archivo .env no encontrado.${NC}"
    echo -e "${YELLOW}   Creando .env desde .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${RED}   ⚠️  IMPORTANTE: Edita el archivo .env con tu usuario de Docker Hub${NC}"
        echo -e "${RED}   Luego ejecuta este script nuevamente.${NC}"
        exit 1
    else
        echo -e "${RED}❌ No se encontró .env ni .env.example${NC}"
        exit 1
    fi
fi

# Verificar que DOCKER_USERNAME está definido
if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${RED}❌ DOCKER_USERNAME no está definido en .env${NC}"
    exit 1
fi

echo -e "${GREEN}📦 Usuario de Docker Hub: ${DOCKER_USERNAME}${NC}"

# Detener contenedores existentes
echo -e "${GREEN}📦 Deteniendo contenedores existentes...${NC}"
docker-compose -f docker-compose.prod.yml down || true

# Limpiar imágenes antiguas (opcional, comentado por defecto)
# echo -e "${GREEN}🧹 Limpiando imágenes antiguas...${NC}"
# docker system prune -f

# Pull de las últimas imágenes
echo -e "${GREEN}⬇️  Descargando últimas imágenes desde Docker Hub...${NC}"
docker-compose -f docker-compose.prod.yml pull

# Iniciar servicios
echo -e "${GREEN}🚀 Iniciando servicios...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Esperar un momento para que los servicios inicien
echo -e "${GREEN}⏳ Esperando que los servicios inicien...${NC}"
sleep 10

# Mostrar estado
echo -e "${GREEN}✅ Despliegue completado!${NC}"
echo -e "${YELLOW}📊 Estado de los contenedores:${NC}"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}✨ Listo! Los servicios están ejecutándose.${NC}"
echo -e "${YELLOW}📝 Para ver los logs:${NC}"
echo -e "   docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo -e "${YELLOW}📝 Para detener los servicios:${NC}"
echo -e "   docker-compose -f docker-compose.prod.yml down"
echo ""
echo -e "${YELLOW}📝 Watchtower está configurado para actualizar automáticamente cada 5 minutos${NC}"


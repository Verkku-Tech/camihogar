-- Inicialización de Schemas para Base de Datos Única
-- Base de datos principal: ordina_main

-- Crear extensiones útiles a nivel de base de datos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Conceder permisos a usuarios de Supabase sobre la base de datos principal
GRANT CONNECT ON DATABASE ordina_main TO supabase_admin, supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_admin, supabase_auth_admin;

-- ================================================================
-- SECURITY SCHEMA
-- ================================================================
CREATE SCHEMA IF NOT EXISTS security;
GRANT ALL ON SCHEMA security TO postgres;
GRANT USAGE ON SCHEMA security TO supabase_admin, supabase_auth_admin;

-- Comentario del schema
COMMENT ON SCHEMA security IS 'Schema para el microservicio de Security - Autenticación y autorización';

-- ================================================================
-- USERS SCHEMA  
-- ================================================================
CREATE SCHEMA IF NOT EXISTS users;
GRANT ALL ON SCHEMA users TO postgres;
GRANT USAGE ON SCHEMA users TO supabase_admin, supabase_auth_admin;

-- Comentario del schema
COMMENT ON SCHEMA users IS 'Schema para el microservicio de Users - Gestión de usuarios y perfiles';

-- ================================================================
-- PROVIDERS SCHEMA
-- ================================================================
CREATE SCHEMA IF NOT EXISTS providers;
GRANT ALL ON SCHEMA providers TO postgres;
GRANT USAGE ON SCHEMA providers TO supabase_admin, supabase_auth_admin;

-- Comentario del schema
COMMENT ON SCHEMA providers IS 'Schema para el microservicio de Providers - Proveedores y catálogo de productos';

-- ================================================================
-- ORDERS SCHEMA
-- ================================================================
CREATE SCHEMA IF NOT EXISTS orders;
GRANT ALL ON SCHEMA orders TO postgres;
GRANT USAGE ON SCHEMA orders TO supabase_admin, supabase_auth_admin;

-- Comentario del schema
COMMENT ON SCHEMA orders IS 'Schema para el microservicio de Orders - Gestión de pedidos y líneas de pedido';

-- ================================================================
-- PAYMENTS SCHEMA
-- ================================================================
CREATE SCHEMA IF NOT EXISTS payments;
GRANT ALL ON SCHEMA payments TO postgres;
GRANT USAGE ON SCHEMA payments TO supabase_admin, supabase_auth_admin;

-- Comentario del schema
COMMENT ON SCHEMA payments IS 'Schema para el microservicio de Payments - Procesamiento de pagos y métodos de pago';

-- ================================================================
-- SHARED SCHEMA (opcional para datos compartidos)
-- ================================================================
CREATE SCHEMA IF NOT EXISTS shared;
GRANT ALL ON SCHEMA shared TO postgres;
GRANT USAGE ON SCHEMA shared TO supabase_admin, supabase_auth_admin;

-- Comentario del schema
COMMENT ON SCHEMA shared IS 'Schema compartido para datos transversales entre microservicios';

-- ================================================================
-- CONFIGURACIÓN DE SEARCH_PATH POR DEFECTO
-- ================================================================
-- Establecer search_path por defecto para facilitar el acceso
ALTER DATABASE ordina_main SET search_path TO public, security, users, providers, orders, payments, shared;

-- ================================================================
-- FUNCIONES ÚTILES COMPARTIDAS
-- ================================================================

-- Función para generar timestamps automáticos
CREATE OR REPLACE FUNCTION shared.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para generar UUIDs por defecto
CREATE OR REPLACE FUNCTION shared.generate_uuid()
RETURNS UUID AS $$
BEGIN
  RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- LOGGING Y AUDITORIA (opcional)
-- ================================================================

-- Tabla de auditoría general en schema shared
CREATE TABLE IF NOT EXISTS shared.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_name VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_audit_log_schema_table ON shared.audit_log(schema_name, table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON shared.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON shared.audit_log(user_id);

-- ================================================================
-- PERMISOS FINALES
-- ================================================================

-- Conceder permisos sobre todas las funciones en schema shared
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA shared TO postgres, supabase_admin;

-- Establecer permisos por defecto para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA security GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA users GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA providers GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA orders GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA payments GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared GRANT ALL ON TABLES TO postgres;

-- ================================================================
-- INFORMACIÓN DEL SETUP
-- ================================================================
DO $$ 
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Ordina Database Setup Completed Successfully!';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Database: ordina_main';
    RAISE NOTICE 'Schemas created:';
    RAISE NOTICE '  - security (Roles, Permissions)';
    RAISE NOTICE '  - users (Users, Profiles)'; 
    RAISE NOTICE '  - providers (Providers, Products)';
    RAISE NOTICE '  - orders (Orders, OrderItems)';
    RAISE NOTICE '  - payments (Payments, PaymentMethods)';
    RAISE NOTICE '  - shared (Common utilities)';
    RAISE NOTICE '================================================';
END $$; 
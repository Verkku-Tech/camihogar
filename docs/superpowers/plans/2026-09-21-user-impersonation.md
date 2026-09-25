# Impersonación de Usuarios para Superadministradores - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a los usuarios con rol Super Administrator impersonar temporalmente a otros usuarios activos del sistema para visualizar la aplicación con sus permisos y restricciones exactas, con un mecanismo inmediato de retorno a su sesión original.

**Architecture:** Endpoint de impersonación protegido en el backend emite un JWT del usuario destino con un claim de auditoría `impersonated_by`. El frontend respalda la sesión de Superadmin en `sessionStorage`, activa el nuevo token, muestra un banner global persistente y permite revertir la sesión con un solo clic.

**Tech Stack:** ASP.NET Core (.NET 10), JWT Claims, React 19, Vite, TanStack Query.

---

### Task 1: Backend - Interfaz de Token y Servicio de Autenticación

**Files:**
- Modify: `Ordina.Backend/src/Application/Security/IAuthService.cs`
- Modify: `Ordina.Backend/src/Infrastructure/Security/SecurityImplementations.cs`
- Modify: `Ordina.Backend/src/Application/Security/AuthService.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/AuthAndSecurityTests.cs`

- [ ] **Step 1: Escribir pruebas unitarias fallidas en AuthAndSecurityTests.cs**
- [ ] **Step 2: Ejecutar pruebas y verificar que fallen**
- [ ] **Step 3: Modificar IAuthService y JwtTokenGenerator para admitir impersonatedBy**
- [ ] **Step 4: Implementar ImpersonateUserAsync en AuthService**
- [ ] **Step 5: Ejecutar pruebas y verificar que pasen todas**

---

### Task 2: Backend - Endpoint en AuthController

**Files:**
- Modify: `Ordina.Backend/src/Api/Controllers/AuthController.cs`

- [ ] **Step 1: Agregar endpoint POST /api/auth/impersonate/{userId} con [Authorize(Roles = "Super Administrator")]**
- [ ] **Step 2: Probar compilación del backend**

---

### Task 3: Frontend - AuthContext y Banner de Impersonación

**Files:**
- Modify: `Ordina.Frontend/src/contexts/AuthContext.tsx`
- Create: `Ordina.Frontend/src/components/auth/impersonation-banner.tsx`
- Modify: `Ordina.Frontend/src/App.tsx`

- [ ] **Step 1: Agregar métodos impersonate y stopImpersonation con respaldo en sessionStorage a AuthContext**
- [ ] **Step 2: Crear componente ImpersonationBanner**
- [ ] **Step 3: Montar ImpersonationBanner en App.tsx**

---

### Task 4: Frontend - Botón de Impersonación en Tabla de Usuarios

**Files:**
- Modify: `Ordina.Frontend/src/components/users/users-page.tsx`

- [ ] **Step 1: Agregar botón de acción en cada fila de usuario para Superadministrador**
- [ ] **Step 2: Ejecutar build del frontend con npm run build**

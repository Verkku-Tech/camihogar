# Spec: Impersonación de Usuarios para Superadministradores

**Fecha:** 2026-09-21  
**Estado:** Aprobado  
**Objetivo:** Permitir a los usuarios con rol `Super Administrator` impersonar temporalmente a otros usuarios activos del sistema para visualizar la aplicación con sus permisos y restricciones exactas, con un mecanismo inmediato de retorno a su sesión original.

---

## 1. Alcance y Requerimientos

### 1.1 Requisitos Funcionales
1. **Acceso exclusivo**: La acción de impersonar solo está permitida y visible para usuarios con rol `Super Administrator`.
2. **Origen de la acción**: Botón en la columna de acciones de la tabla de usuarios (`/configuracion/usuarios`) en cada fila de usuario que no sea el mismo Superadmin autenticado.
3. **Restricciones**:
   - No se permite impersonar a uno mismo.
   - No se permite impersonar a usuarios con estado inactivo o desactivado.
4. **Emisión de credenciales temporales**:
   - El backend emite un token JWT con la identidad, rol, permisos y tienda del usuario impersonado, agregando el claim de auditoría `impersonated_by`.
5. **Barra de aviso persistente**:
   - Cuando hay una impersonación activa, se muestra un banner superior fijo y visible en todas las rutas del dashboard indicando:
     *"Modo Impersonación: Estás viendo el sistema como [Nombre de Usuario] ([Rol])"*
   - Contiene un botón prominente: *"Finalizar impersonación"*.
6. **Retorno seguro e instantáneo**:
   - Al hacer clic en *"Finalizar impersonación"*, el frontend restaura la sesión original del Superadmin guardada en `sessionStorage`, restablece el token activo y refresca el estado sin solicitar contraseña nuevamente.

---

## 2. Arquitectura de Solución

### 2.1 Backend (`Ordina.Backend`)
- **Controlador**: `AuthController.cs`
  - Endpoint: `POST /api/auth/impersonate/{userId}`
  - Atributo: `[Authorize(Roles = "Super Administrator")]`
  - Flujo:
    1. Obtiene `currentUserId` de los claims de la petición.
    2. Invoca `IAuthService.ImpersonateUserAsync(currentUserId, targetUserId, cancellationToken)`.
    3. Devuelve `LoginResponse` con el token generado del usuario objetivo y sus datos completos.
- **Servicio**: `AuthService.cs`
  - Valida que `targetUser != null`, `targetUser.Id != currentUserId` y `targetUser.Status == UserStatus.Active`.
  - Obtiene los permisos combinados del usuario destino mediante `GetUserPermissionsAsync(targetUser)`.
  - Invoca `_tokenService.GenerateToken(targetUser, permissions)` con el claim adicional `impersonated_by`.
- **Token**: `JwtTokenGenerator.cs`
  - Permite opcionalmente incluir un claim `impersonated_by`.

### 2.2 Frontend (`Ordina.Frontend`)
- **Estado de Autenticación**: `AuthContext.tsx`
  - Nuevas propiedades / métodos:
    - `isImpersonating: boolean`
    - `impersonate: (userId: string) => Promise<void>`
    - `stopImpersonation: () => void`
  - Persistencia en `sessionStorage`:
    - Clave: `ordina_superadmin_session` guardando `{ token, user }` del Superadmin antes del cambio.
- **Componente Banner**: `ImpersonationBanner.tsx`
  - Renderizado en el layout principal del dashboard.
  - Alerta visual amarilla/ámbar con texto y botón para salir de la impersonación.
- **Vista de Usuarios**: `users-page.tsx`
  - Columna de acciones: añade botón con icono `LogIn` / `UserCheck` si el usuario en sesión es `Super Administrator` y el `user.id !== currentUserId`.

---

## 3. Seguridad y Manejo de Errores
- **401 Unauthorized**: Si la llamada al backend no tiene token válido.
- **403 Forbidden**: Si quien invoca el endpoint no posee el rol `Super Administrator`.
- **400 Bad Request**: Si se intenta impersonar a uno mismo o a un usuario inactivo.
- **404 Not Found**: Si el `userId` objetivo no existe.

---

## 4. Estrategia de Pruebas
- **TDD Backend**: Pruebas unitarias en `Ordina.Application.Tests` (`AuthServiceTests` o `OrderCoreServiceTests`):
  - Superadmin impersona exitosamente a un usuario activo.
  - Falla si el usuario objetivo no existe.
  - Falla si el usuario objetivo está inactivo.
  - Falla si el usuario objetivo es el mismo solicitante.
- **Verificación Frontend**:
  - Build de Vite (`npm run build`).
  - Verificación manual / pruebas de componentes en React.

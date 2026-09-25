# Spec: Carga de Imágenes de Perfil (Avatares) para Usuarios

**Fecha:** 2026-09-21  
**Estado:** Aprobado  
**Objetivo:** Permitir a los administradores cargar, actualizar y eliminar imágenes de perfil para los usuarios desde la sección de Configuración > Usuarios, optimizando la imagen en el cliente y persistiendo el formato Data URL en MongoDB.

---

## 1. Alcance y Requerimientos

### 1.1 Requisitos Funcionales
1. **Acceso exclusivo en Configuración**: La carga y modificación de la imagen de perfil se realiza en los diálogos de creación y edición de usuarios (`/configuracion/usuarios`).
2. **Optimización en Cliente**:
   - Al seleccionar un archivo de imagen (PNG, JPG, WebP), se redimensiona a un tamaño cuadrado máximo (ej. 256x256 px) y se comprime en formato WebP/JPEG antes de enviarse al backend.
   - Tamaño máximo del resultado menor a 150 KB para preservar ligereza de carga y base de datos.
3. **Persistencia**:
   - El backend almacena la imagen como cadena Base64 / Data URL en el campo `AvatarUrl` del documento `User`.
4. **Visualización**:
   - En la tabla de usuarios (`users-page.tsx`): cada fila muestra el avatar circular junto al nombre del usuario, con fallback a las iniciales o ícono `User` si no posee foto.
   - En la barra lateral (`sidebar.tsx`): en el pie de página, el botón de perfil muestra el avatar del usuario autenticado si existe.
   - En el `UserDto` de autenticación (`AuthContext`): el usuario en sesión incluye su `avatarUrl`.

---

## 2. Arquitectura de Solución

### 2.1 Backend (`Ordina.Backend`)
- **Dominio**:
  - `User.cs`: Se agrega propiedad `[BsonElement("avatarUrl")] public string? AvatarUrl { get; set; }`.
- **DTOs**:
  - `UserResponseDto`: incluye `string? AvatarUrl`.
  - `CreateUserDto`: incluye `string? AvatarUrl = null`.
  - `UpdateUserDto`: incluye `string? AvatarUrl = null`.
  - `UserDto` (`Security`): incluye `string? AvatarUrl = null`.
- **Servicios**:
  - `UserService.cs`: Mapea `AvatarUrl` en creación, actualización y consultas.
  - `AuthService.cs`: Incluye `AvatarUrl` en respuestas de login, refresh e impersonate.

### 2.2 Frontend (`Ordina.Frontend`)
- **Componente**:
  - `AvatarUploader` o selector integrado con `Avatar`, `AvatarImage`, `AvatarFallback` y un input file oculto con botón de cambiar/eliminar foto.
- **Vistas**:
  - `users-page.tsx`:
    - En el diálogo de crear/editar usuario: selector de avatar con preview circular.
    - En la tabla de usuarios: columna con Avatar + Nombre + Usuario.
  - `sidebar.tsx`:
    - Pie de página del sidebar: renderiza `user.avatarUrl` en el botón de usuario.

---

## 3. Pruebas
- **TDD Backend**: Pruebas unitarias en `UserServiceTests` o `AuthAndSecurityTests` verificando que `CreateUserAsync` y `UpdateUserAsync` persisten y devuelven `AvatarUrl`.
- **Frontend**: `npm run build` sin errores de TypeScript y validación visual.

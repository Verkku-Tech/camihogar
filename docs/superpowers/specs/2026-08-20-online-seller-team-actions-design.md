# Vendedor Online: acciones sobre pedidos del equipo online

**Fecha:** 2026-08-20
**Estado:** Aprobado
**Alcance:** Backend (OrderService, RoleSeeder) + Frontend (pedidos, despachos, reservas)

## Objetivo

Extender las capacidades de gestión del rol **Online Seller** para que pueda actuar sobre los pedidos de **todo el equipo online** (cualquier usuario con rol Online Seller), no solo los suyos. Específicamente:

- **Editar** pedidos/reservas de cualquier vendedor online (hoy: solo propios).
- **Despachar a ruta** pedidos de cualquier vendedor online (hoy: solo propios; la regla "solo a ruta" se mantiene).
- **Cargar pagos** en pedidos de cualquier vendedor online, mediante una acción rápida "Editar pagos" (permiso `orders.payments.manage`).

**NO se otorga** el permiso `orders.delete`: el vendedor online **no podrá eliminar pedidos**.

## Contexto actual

| Comportamiento | Backend | Frontend |
|---|---|---|
| Visibilidad de equipo (ver) | `OrderService` aplica filtro de equipo vía `OnlineSellerVisibilityService` | `useOnlineSellerVisibility()` → `isTeamOrder` |
| Editar solo propios | `OrderService.EnsureOnlineSellerCanMutate` (línea 56-64) con `IsOwnedBySeller` | `canEditOrder`/`canDeleteOrder` usan `!isOwnOrder` |
| Despacho solo propios | — | `canOnlineSellerActOnOrder` usa `isOrderOwnedByOnlineSeller` |
| Despacho "solo a ruta" por rol | `EnsureDispatchLogisticsAuthorized` permite `isOnlineSeller` para ruta | `canSendToRoute` incluye `isOnlineSeller` |
| Permisos rol Online Seller | Sin `orders.payments.manage`, sin `orders.delete` (`RoleSeeder.cs:68-85`) | — |

## Cambios

### 1. Backend — regla de autorización de mutación

**Archivo:** `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/OrderService.cs`

- Reemplazar `EnsureOnlineSellerCanMutate(Order, string userId, string? callerRole)` (estático, verifica `IsOwnedBySeller`) por una versión **async** que verifica `OrderOnlineSellerVisibility.IsVisibleToTeam(order, ids)`:
  - Si el caller **no** es Online Seller → permitido (sin filtro).
  - Si es Online Seller → permitido solo si el pedido es visible al equipo online (`vendorId`, `referrerId` o `sourceReservationVendorId` pertenecen a algún usuario Online Seller).
  - Usa `_onlineSellerVisibility.GetOnlineSellerUserIdsAsync()`.
- Actualizar las llamadas:
  - `UpdateOrderAsync` (línea 1148).
  - `DeleteOrderAsync` (línea 1444): el backend sigue bloqueando el borrado porque el endpoint `DELETE /api/Orders/{id}` exige `orders.delete` (`OrdersController.cs:674`), que el rol no tendrá.

### 2. Backend — permisos del rol Online Seller

**Archivo:** `Ordina.Backend/src/Infrastructure/Ordina.Database/Seeders/RoleSeeder.cs`

- Agregar `Permissions.Orders.ManagePayments` (`orders.payments.manage`) a la lista de permisos del rol `"Online Seller"`.
- **No** agregar `Permissions.Orders.Delete`.
- Nota de migración: el seeder solo inserta roles inexistentes (`RoleSeeder.cs:96-101`). Para entornos ya desplegados, asignar `orders.payments.manage` al rol vía **Configuración > Roles** en la UI admin (documentado abajo).

### 3. Frontend — quitar gate de "propio"

**Archivo:** `Ordina.Frontend/app/pedidos/page.tsx`
- `canEditOrder` (línea 597-604): reemplazar `!isOwnOrder(order)` por `!isTeamOrder(order)`.
- `canDeleteOrder` (línea 606-611): reemplazar `!isOwnOrder(order)` por `!isTeamOrder(order)`. El online sigue sin poder eliminar porque el gate depende además de `hasPermission("orders.delete")`.
- Agregar botón rápido **"Editar pagos"**: visible para `order.type === "order"`, `hasPermission("orders.payments.manage")` y `isTeamOrder(order)`. Abre `editMode = "payments"` (ya soportado por `handleEdit`, líneas 586-591).

**Archivo:** `Ordina.Frontend/app/pedidos/despachos/page.tsx`
- `canOnlineSellerActOnOrder` (línea 403-410): reemplazar `isOrderOwnedByOnlineSeller(order, onlineSellerUserId)` por `isTeamOrder(order)`. Eliminar dependencia de `onlineSellerUserId`.

**Archivo:** `Ordina.Frontend/app/pedidos/reservas/page.tsx`
- Sin cambios funcionales: `canConfirmReservation` ya incluye al rol Online Seller por rol; no hay gate de propiedad. Verificar solo que el botón de eliminar siga condicionado a `orders.delete` (lo está, línea 119).

### 4. Despacho — regla "solo a ruta" intacta

`EnsureDispatchLogisticsAuthorized` no cambia: el online puede enviar a ruta por rol (`isOnlineSeller`), pero no confirmar entrega (`dispatch.confirm_delivery`) ni devolver a almacén (solo administradores).

## Migración de datos (entornos existentes)

1. UI admin → **Configuración > Roles** → rol **Online Seller** → agregar permiso `orders.payments.manage` (Gestionar pagos de pedidos).
2. Verificar que `orders.delete` NO esté asignado a ningún vendedor online (rol ni permisos individuales).

## Pruebas

- **Backend** (`tests/Ordina.Orders.Application.Tests`):
  - Un Online Seller puede actualizar pedidos del equipo (vendor/referrer/reserva = otro online).
  - Un Online Seller NO puede actualizar pedidos ajenos al equipo.
  - Un Online Seller no puede eliminar (exigencia de `orders.delete` a nivel de controller se valida manualmente; a nivel de servicio el gate de equipo no cambia el permiso).
  - Despacho "solo a ruta" se mantiene.
- **Frontend**: verificación manual — rol online ve "Editar pedido" y "Editar pagos" en pedidos del equipo, y no ve botón de eliminar.

## Archivos afectados

| Área | Archivo | Cambio |
|---|---|---|
| Backend | `src/Application/Orders/Ordina.Orders.Application/Services/OrderService.cs` | `EnsureOnlineSellerCanMutate` → team-wide async (`IsVisibleToTeam`) |
| Backend | `src/Infrastructure/Ordina.Database/Seeders/RoleSeeder.cs` | + `orders.payments.manage` al rol Online Seller |
| Frontend | `app/pedidos/page.tsx` | gates `!isOwnOrder`→`!isTeamOrder`; botón "Editar pagos" |
| Frontend | `app/pedidos/despachos/page.tsx` | `canOnlineSellerActOnOrder` → `isTeamOrder` |
| Tests | `tests/Ordina.Orders.Application.Tests` | casos de mutación team-wide |
# Reglas de Negocio: Seguridad, Roles y Permisos

**Módulo:** Seguridad, Autenticación y Autorización  
**Entidades Principales:** `User`, `UserProfile`, `Role`, `Permission`, `RefreshToken`, `AssignableUserPermissions`  
**Servicios de Aplicación:** `IAuthService`, `AuthService`, `IUserService`, `UserService`, `UserPermissionResolver`  

---

## 1. Matriz de Roles del Sistema (`UserRole`)

El acceso a las funcionalidades del ERP está restringido mediante un esquema de control de acceso basado en roles (**RBAC**):

| Rol | Alcance Operativo | Capacidades Críticas |
| :--- | :--- | :--- |
| **`Admin`** | Global e irrestricto. | Configuración del sistema, auditoría total, eliminación de órdenes y gestión de roles. |
| **`Manager`** | Supervisión comercial de tienda. | Aprobación de descuentos especiales, reactivación de órdenes y arqueo de caja. |
| **`Seller`** | Ventas en tienda física. | Creación de presupuestos y pedidos, visualización de clientes y registro de abonos propios. |
| **`Online Seller`** | Ventas digitales y omnicanal. | Gestión colaborativa de pedidos y abonos de **todo el equipo online**. Envío a ruta. |
| **`Workshop`** | Personal de taller y manufactura. | Avance de etapas en el tablero Kanban, asignación de artesanos y reporte de refabricaciones. |
| **`Dispatch`** | Personal de bodega y logística. | Armado de rutas de despacho, asignación de choferes/vehículos y confirmación de entregas. |
| **`Finance`** | Tesorería y contabilidad. | Conciliación de extractos bancarios, actualización de tasa BCV y liquidación de comisiones. |

---

## 2. Lista Blanca de Permisos Asignables Individualmente

Para evitar la degradación de la seguridad por asignación descontrolada de permisos de alto privilegio, el sistema implementa una **lista blanca cerrada** (`AssignableUserPermissions`) de permisos que un administrador puede otorgar de forma individual a un usuario particular:

```
                  ┌─────────────────────────────────────────┐
                  │    AssignableUserPermissions (WhiteList) │
                  └────────────────────┬────────────────────┘
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
dispatch.send_to_route       dispatch.confirm_delivery      manufacturing.manage
 ("Pasar pedido a ruta")       ("Confirmar entrega")       ("Gestionar fabricación")
```

> [!WARNING]
> Cualquier intento de asignar un permiso fuera de esta lista blanca (por ejemplo `orders.delete` o `finance.conciliate`) es rechazado por el backend arrojando un error de argumento inválido.

---

## 3. Reglas Especiales para el Rol Online Seller

El equipo de ventas digitales opera bajo un modelo de **alta colaboración**, ya que las conversaciones con clientes en WhatsApp o redes sociales pueden ser atendidas por distintos asesores según el turno:

### 1. Visibilidad Transversal de Equipo (`IsVisibleToTeam`):
- Un usuario con rol `Online Seller` tiene visibilidad no solo de sus propias órdenes, sino de **todas las órdenes generadas por cualquier miembro del equipo online**.
- Se evalúa si el `vendorId`, `referrerId` o `sourceReservationVendorId` pertenecen al conjunto de vendedores online activos.

### 2. Mutación y Carga de Pagos:
- Los vendedores online pueden editar y agregar pagos a cualquier orden de su equipo mediante el permiso `orders.payments.manage`.
- Esto agiliza la recepción de comprobantes de pago de clientes cuando el vendedor que abrió la orden se encuentra fuera de turno.

### 3. Prohibición Estricta de Eliminación:
- Ningún vendedor online posee el permiso `orders.delete`.
- Si una orden debe anularse, el asesor debe pasarla a estado `Declinado` documentando el motivo o solicitar la eliminación a un Administrador.

---

## 4. Políticas de Sesión y Seguridad Técnica

La autenticación combina máxima usabilidad con protección contra vectores de ataque web comunes:

1. **Inmunidad a XSS (Tokens en Memoria):**
   - El token de acceso JWT (`accessToken`) tiene una vida útil de **15 minutos** y reside exclusivamente en la variable de memoria volátil de React. Nunca se guarda en `localStorage`.
2. **Renovación Transparente (Silent Refresh):**
   - El token de renovación (`refreshToken`) viaja exclusivamente a través de cookies seguras `HttpOnly; SameSite=Strict` con vigencia de 7 días.
   - El endpoint `/api/auth/refresh` renueva el token en segundo plano al recargar la aplicación.
3. **Protección Anti-CSRF:**
   - Todo endpoint que consuma cookies exige la presencia de la cabecera personalizada:
     ```http
     X-Requested-With: XMLHttpRequest
     ```
   - Si la cabecera falta en una petición POST/PUT/DELETE, el middleware aborta inmediatamente la conexión con `403 Forbidden`.
4. **Idempotencia Distribuida:**
   - Cada acción de guardado genera un identificador UUIDv4 único enviado en la cabecera `X-Mutation-Id`.
   - MongoDB guarda el resultado de la mutación con un TTL de 24 horas; los reintentos por caídas de red retornan el resultado en caché sin reejecutar la lógica de negocio.

# Especificación de Diseño: Sistema de Notificaciones en Tiempo Real (SSE + MongoDB)

**Fecha:** 2026-09-20  
**Estado:** Aprobado para Plan de Implementación  
**Módulo:** Notificaciones / Comunicación Operativa en Tiempo Real  
**Proyecto:** Ordina ERP (Camihogar)

---

## 1. Contexto y Objetivos

El sistema ERP Ordina gestiona flujos críticos de ventas, presupuestos, reservas, manufactura en taller, despachos y conciliaciones financieras. Actualmente, la interfaz solo cuenta con un aviso estático en caso de ausencia de tasas de cambio.

Este diseño define la arquitectura integral para emitir, persistir y transmitir en tiempo real notificaciones dirigidas por eventos del servidor a través de **Server-Sent Events (SSE)** nativo de ASP.NET Core, persistencia en **MongoDB**, y visualización interactiva en el Frontend (campana con contador en el sidebar y navegación directa a registros filtrados).

---

## 2. Decisiones de Arquitectura

1. **Transporte en Tiempo Real: Server-Sent Events (SSE)**
   - Utiliza el endpoint HTTP `GET /api/notifications/stream` con `Content-Type: text/event-stream`.
   - Cero dependencias externas adicionales en cliente y servidor: aprovecha la API nativa `EventSource` del navegador y `System.Threading.Channels.Channel<Notification>` en ASP.NET Core.
   - Re-conexión automática nativa provista por la especificación de `EventSource`.

2. **Persistencia en MongoDB (Colección `notifications`)**
   - Garantiza que las notificaciones no se pierdan si el usuario estaba desconectado, cierra la pestaña o trabaja en modo offline.
   - Permite consultar el historial de notificaciones y el recuento de no leídas mediante REST (`GET /api/notifications` y `GET /api/notifications/unread-count`).
   - Permite registrar lecturas por usuario individual (`PUT /api/notifications/{id}/read` y `PUT /api/notifications/mark-all-read`).

3. **Notificaciones Consolidadas para Procesos Masivos**
   - Para evitar saturar al usuario con decenas de alertas individuales, eventos recurrentes como "Retrasos en Fabricación" o "Reservas Vencidas" se agrupan en **una sola notificación consolidada** que redirige a la pantalla respectiva con los pedidos ya filtrados.

---

## 3. Modelo de Datos y Esquema de Dominio

### Entidad `Notification` (Colección `notifications`)
```csharp
namespace Ordina.Domain.Notifications;

public class Notification : BaseEntity
{
    [BsonElement("type")]
    public string Type { get; set; } = string.Empty;
    // Valores estándar:
    // - "ExchangeRateChanged"
    // - "ExchangeRateMissing"
    // - "ManufacturingDelay"
    // - "ReservationExpiring"
    // - "OfflineSyncConflict"
    // - "EmergencyPinUsed"

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("message")]
    public string Message { get; set; } = string.Empty;

    [BsonElement("severity")]
    public string Severity { get; set; } = "info"; // "info" | "warning" | "error" | "success"

    [BsonElement("link")]
    public string? Link { get; set; } // Ruta frontend: ej. "/pedidos/fabricacion?filter=delayed"

    [BsonElement("targetUserId")]
    public string? TargetUserId { get; set; } // Si es para un usuario específico (ej. Vendedor)

    [BsonElement("targetRoles")]
    public List<string> TargetRoles { get; set; } = new(); // Si es para roles específicos. Vacío = Todos los usuarios.

    [BsonElement("readByUserIds")]
    public List<string> ReadByUserIds { get; set; } = new(); // Registra IDs de usuarios que la leyeron

    [BsonElement("metadata")]
    public Dictionary<string, object>? Metadata { get; set; }
}
```

---

## 4. Catálogo de Eventos y Reglas de Negocio

| Evento | Disparador (Trigger) | Audiencia | Severidad | Acción / Enlace | Consolidación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Tasa de cambio actualizada / faltante** | Al crear o modificar una tasa de cambio en `ExchangeRateService`, o si al iniciar el día no existe tasa activa. | **Todos los usuarios** (`TargetRoles = []`) | `info` / `warning` | `/configuracion/tasas` | 1 alerta por cambio de divisa |
| **2. Retraso en Fabricación (> 25 días)** | Pedidos en fabricación donde `(ManufacturingStartedAt ?? Order.UpdatedAt ?? Order.CreatedAt) < Now - 25 días` y estado `!= "almacen_no_fabricado"`. | **Supervisor, Administrator, Super Administrator** | `warning` | `/pedidos/fabricacion?filter=delayed` | **Consolidada**: 1 alerta con el conteo total |
| **3. Reserva Vencida (> 30 días)** | Pedidos con `Type == "Reservation"`, `Status == "Reserva"` y `CreatedAt < Now - 30 días`. | **Vendedor asignado al pedido** (`TargetUserId = VendorId`) | `warning` | `/pedidos/reservas?filter=expired` | **Consolidada por Vendedor**: 1 alerta por vendedor con sus reservas vencidas |
| **4. Conflicto Sincronización Offline** | Al fallar una mutación offline encolada con error `409 Conflict` o error de cliente no recuperable. | **Local al usuario** (Toast) + **Admins en Backend** (`TargetRoles = ["Administrator", "Super Administrator"]`) | `error` | Notificación administrativa con detalle técnico | 1 por conflicto |
| **5. Uso de PIN de Emergencia** | Al validar y consumir un PIN de acceso temporal en `AccessPinService`. | **Administrator, Super Administrator** | `info` | `/configuracion/pin-acceso` | 1 por uso de PIN |

---

## 5. Filtros de Navegación en Frontend

Para cumplir con el requerimiento de que las notificaciones consolidadas lleven a la pantalla con los registros ya filtrados:

1. **Pantalla de Fabricación (`/pedidos/fabricacion`)**:
   - Se incorpora la opción **`"Pedidos con retraso (> 25 días)"`** (`filter=delayed`) en el selector de estados de la barra de filtros.
   - Al seleccionar esta opción o ingresar con el query param `?filter=delayed`, se listan exclusivamente los pedidos en fabricación cuya última actualización o inicio supere los 25 días.

2. **Pantalla de Reservas (`/pedidos/reservas`)**:
   - Se incorpora el filtro **`"Reservas vencidas (> 30 días)"`** (`filter=expired`).
   - Al seleccionarlo o ingresar mediante `?filter=expired`, la tabla muestra únicamente las reservas con más de 30 días de antigüedad.

---

## 6. Componentes del Frontend

1. **Servicio y Hook `useNotifications`**:
   - Se conecta al endpoint SSE `/api/notifications/stream` pasando el token de autenticación (o cookie HttpOnly).
   - Recibe eventos en tiempo real y actualiza el contador reactivo en memoria.
   - Sincroniza el listado inicial desde `GET /api/notifications`.

2. **Campanita de Notificaciones en `sidebar.tsx`**:
   - Muestra el ícono de campana con un badge numérico dinámico rojo cuando hay notificaciones no leídas (`unreadCount > 0`).
   - El desplegable lista las notificaciones ordenadas cronológicamente con:
     - Icono por severidad (azul informativo, amarillo advertencia, rojo error).
     - Título y mensaje.
     - Enlace clickeable directo hacia la pantalla correspondiente.
     - Botón para marcar individualmente como leída o botón "Marcar todas como leídas".

---

## 7. Plan de Verificación

1. **Pruebas Unitarias Backend (`Ordina.Application.Tests`)**:
   - Pruebas para `NotificationService` (creación, filtrado por rol/usuario, marcado de lectura).
   - Pruebas para detección de pedidos con retraso (> 25 días) y reservas vencidas (> 30 días).
2. **Pruebas de Compilación**:
   - `dotnet build` sin errores ni advertencias.
   - `npm run build` en `Ordina.Frontend` para validar tipado estricto y bundling.
3. **Verificación Manual**:
   - Crear o modificar una tasa de cambio y verificar que llega el evento por SSE a todos los usuarios conectados.
   - Validar un PIN de acceso y confirmar que el Superadmin recibe la notificación.
   - Cliquear en la notificación de fabricación con retraso y comprobar que la pantalla `/pedidos/fabricacion` se abre con el filtro de retraso activo.

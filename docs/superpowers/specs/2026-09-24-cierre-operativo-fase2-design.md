# Especificación de Diseño: Cierre Operativo Fase 2
## Inventario, Transferencias, Fabricación para Stock y Notificaciones

**Fecha:** 24 de Septiembre de 2026  
**Estado:** Propuesta de Diseño para Aprobación  
**Rama:** `feat/modular-monolith-refactor`

---

## 1. Visión General del Alcance

Este documento detalla la arquitectura y diseño técnico para culminar los 4 módulos operativos de la Fase 2 según la minuta y acuerdos de negocio:
1. **Cierre del ciclo Reserva ➡️ Pedido:** Vinculación directa desde el apartado temporal de mostrador hacia la creación del pedido, extensión a 30 min y deducción física definitiva del stock.
2. **Transferencias / Traspasos entre Sedes y Almacenes:** Generación de orden de traslado desde Existencias Inmediatas, bloqueo en estado *"Pendiente de transferencia / En tránsito"*, y pantalla dedicada para gestionar y marcar *"Transferida"* con acreditación automática en la sede destino.
3. **Órdenes de Fabricación Interna para Stock:** Pestaña dedicada en la pantalla de Fabricación, correlativo propio (ej. `OF-XXXX`), campo "Solicitante", aislamiento de métricas financieras de ventas comerciales, y exportador Excel con 2 hojas independientes (Pedidos de clientes y Órdenes de Stock).
4. **Notificaciones y Alertas Sonoras:** Timbre sonoro en navegador vía Web Audio API para toda notificación entrante; disparadores automáticos para *Retiro por tienda*, *Retiro por almacén*, *Despacho Express*, alerta de reposición para almacén central y alerta CRM de repesca de presupuestos/reservas > 30 días.

---

## 2. Módulo 1: Ciclo Reserva ➡️ Pedido & Deducción de Stock

### 2.1. Flujo de Usuario
1. El vendedor aparta una pieza en mostrador en `/inventario/existencias` (reserva de 10 min).
2. Pulsa el botón **"Continuar a Pedido"**.
3. Navega a `/pedidos?newOrder=true&stockId={stockId}&productId={productId}&reservationId={reservationId}`.
4. El diálogo [`new-order-dialog.tsx`](file:///f:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/Ordina.Frontend/src/components/orders/new-order-dialog.tsx) detecta estos parámetros:
   - Precarga automáticamente el producto, variante de tela/color/medida, y fija la sede física de salida (`deliveryLocationId = stockItem.locationId`).
   - Muestra un banner visual: *"Artículo reservado temporalmente en mostrador: {ProductName} ({LocationName})"*.
5. Si el vendedor guarda como **"Reserva"**:
   - Se invoca `POST /api/stock/reservations/{reservationId}/extend` enviando el `orderNumber`.
   - La reserva pasa a tipo `"formal"` con tiempo extendido a 30 minutos.
6. Si el vendedor guarda como **"Pedido / Venta Concretada"**:
   - Se invoca `POST /api/stock/reservations/{reservationId}/confirm` vinculando el `orderNumber`.
   - Se reduce atómicamente la cantidad física `quantity -= reservedQuantity` y se limpia `reservedQuantity`, dejando la trazabilidad en el pedido.
   - Si se vende un artículo de stock sin reserva previa con entrega inmediata/retiro tienda, el backend descuenta directamente de `PhysicalStock`.

---

## 3. Módulo 2: Transferencias y Traspasos entre Sedes y Almacenes

### 3.1. Modelo de Datos (`StockTransfer`)
```csharp
public class StockTransfer : BaseEntity
{
    public string TransferNumber { get; set; } = string.Empty; // ej. TRF-0001
    public string StockId { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string VariantKey { get; set; } = string.Empty;
    public Dictionary<string, string> Attributes { get; set; } = new();

    public string OriginLocationId { get; set; } = string.Empty;
    public string OriginLocationName { get; set; } = string.Empty;
    public string OriginLocationType { get; set; } = string.Empty; // "store" | "warehouse"

    public string DestinationLocationId { get; set; } = string.Empty;
    public string DestinationLocationName { get; set; } = string.Empty;
    public string DestinationLocationType { get; set; } = string.Empty; // "store" | "warehouse"

    public int Quantity { get; set; } = 1;
    public string Status { get; set; } = "in_transit"; // "pending" | "in_transit" | "transferred" | "cancelled"
    public string RequestedBy { get; set; } = string.Empty;
    public string? TransferredBy { get; set; }
    public string? Reason { get; set; } // ej. "Reposición por tope de exhibición"
    public DateTime? TransferredAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

### 3.2. Reglas de Negocio de Stock en Tránsito
- Al crear la transferencia:
  - En la sede origen, la cantidad a transferir se resta de `availableQuantity` y se coloca en `inTransitQuantity` o se reduce de disponible en `PhysicalStock`.
  - **Ni la sede origen ni la sede destino ven esa cantidad como stock disponible inmediato**.
- Al confirmar la transferencia (botón *"Marcar como Transferida"* en la sede destino o almacén):
  - Se descuenta definitivamente de la sede origen en `PhysicalStock`.
  - Se acredita (o crea si no existía el registro de variante) en la sede destino en `PhysicalStock`.
  - La transferencia pasa a estatus `"transferred"`.
- Si se cancela la transferencia:
  - El stock vuelve a sumarse a la sede origen como disponible y el estado pasa a `"cancelled"`.

### 3.3. Interfaz de Usuario
1. **Acción en Existencias Inmediatas (`/inventario/existencias`):**
   - Botón en cada fila o tarjeta de stock: *"Solicitar Traslado"*.
   - Diálogo simple: selección de Sede Destino (otra tienda o almacén), Cantidad y Motivo (con opción de botón rápido *"Reponer Tope de Tienda"*).
2. **Pantalla de Gestión de Transferencias (`/inventario/transferencias`):**
   - Agregada a la navegación bajo Inventario.
   - Tabla con filtros por estado (`Todos`, `En Tránsito`, `Transferidas`, `Canceladas`), búsqueda por producto/código y filtro por sede origen/destino.
   - Botón de acción para operarios autorizados: **"Confirmar Recepción / Marcar Transferida"**.

---

## 4. Módulo 3: Órdenes de Fabricación Interna para Stock

### 4.1. Concepto y Aislamiento Contable
- Las órdenes de fabricación de stock reponen el Almacén Central Terrinca o el piso de exhibición de las tiendas.
- **Entidad o Discriminador:** Se añade `OrderType = "ManufacturingOrder"` o `IsStockReplenishment = true` en las entidades de órdenes/fabricación.
- **Correlativo:** Serie independiente `OF-0001`, `OF-0002`...
- **Campos del Formulario:**
  - `Solicitante` (en vez de Vendedor; toma el usuario actual, ej. Aarón).
  - `Sede Destino` (Almacén Terrinca, Tienda Guatire, Tienda Las Mercedes).
  - `Taller / Proveedor asignado` (Misma lógica de talleres que en pedidos).
  - `Detalle de Productos / Variantes / Telas`.
  - `Fecha Estimada de Entrega`.
  - `Notas de Producción`.
- **Aislamiento en Métricas y BI:**
  - Excluidas de `GetTotalRevenueAsync`, `GetTotalCollectionsAsync`, ranking de comisiones de vendedores y cobranzas.
  - Se consideran **gastos operativos de taller** (la integración contable de costos se deja para la fase financiera posterior).

### 4.2. UI en Fabricación y Exportación a Excel
1. **Tabs en `/pedidos/fabricacion`:**
   - **Tab 1: Pedidos de Clientes** (Ventas normales).
   - **Tab 2: Órdenes de Fabricación (Stock)**:
     - Botón destacado: *"Nueva Orden de Fabricación"*.
     - Filtros por taller, estado de fabricación y solicitante.
     - Mismo flujo de avance de estado de taller (*En Espera*, *En Estructura*, *En Tapicería*, *Terminado*).
     - Al marcarse *Terminado*, se ofrece la opción de dar entrada automática al `PhysicalStock` de la sede destino.
2. **Reporte de Fabricación en Excel (`/reportes/fabricacion`):**
   - Al descargar el reporte en Excel mediante ClosedXML:
     - **Hoja 1:** *Fabricación de Pedidos* (ventas a clientes con sus columnas de entrega y cliente).
     - **Hoja 2:** *Órdenes de Fabricación (Stock)* (órdenes internas con solicitante, sede destino y fecha estimada).

---

## 5. Módulo 4: Notificaciones Automáticas, Alertas Sonoras y Reglas Operativas

### 5.1. Alertas Sonoras en Navegador
- En [`use-notifications.ts`](file:///f:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/Ordina.Frontend/src/hooks/use-notifications.ts):
  - Integración con Web Audio API (`AudioContext`) para reproducir un chime agradable y profesional en cualquier notificación entrante sin necesidad de cargar archivos `.mp3` externos pesados.
  - Indicador / Toggle en el header del menú de notificaciones para silenciar/activar sonido si el usuario lo desea.

### 5.2. Disparadores Automáticos en Backend
1. **Cambio de estatus de despacho:**
   - Evento cuando un pedido pasa o se crea con:
     - `Retiro por tienda`: Alerta a la tienda indicada.
     - `Retiro por almacén`: Alerta al Almacén Central Terrinca.
     - `Despacho Express`: Alerta de alta prioridad a Coordinación de Transporte.
2. **Alerta de Reposición a Almacén Central:**
   - Cuando se descuenta una unidad física vendida en tienda, si la existencia en tienda queda por debajo del tope configurado, se emite una notificación automática al rol `Encargado de Almacén` / `Administrator`:
     - *"Alerta de Reposición: Se vendió {Producto} en {Tienda}. Preparar reposición desde Terrinca."*
3. **Alerta CRM de "Repesca" de Presupuestos (> 30 días):**
   - Tarea periódica o consulta al iniciar sesión para el rol `Vendedor Online` / `Store Seller`:
     - *"Oportunidad de Repesca: El presupuesto/reserva {OrderNumber} de {ClientName} tiene más de 30 días. Contactar para reactivación."*

---

## 6. Arquitectura y Tecnologías
- **Backend:** C# 13, .NET 10, MongoDB Driver, ClosedXML.
- **Frontend:** React 19, TypeScript, Tailwind CSS, Radix UI, Lucide Icons, Sonner.
- **TDD:** Pruebas unitarias en `Ordina.Application.Tests` para `StockTransferService`, `StockReservationService`, `ManufacturingOrderService` y exportación Excel.
- **Restricciones:** No hacer git commit automático (el usuario lo realiza manualmente). Ponytail Full: código mínimo y directo sin sobreingeniería.

---

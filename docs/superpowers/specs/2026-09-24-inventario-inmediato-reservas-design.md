# Especificación de Diseño: Inventario Inmediato, Multisede y Reservas Temporales

**Fecha:** 24 de Septiembre de 2026  
**Rama:** `feat/modular-monolith-refactor`  
**Estado:** Propuesta de Diseño para Aprobación  
**Módulos Afectados:** Backend (`Ordina.Backend`), Frontend (`Ordina.Frontend`), Base de Datos (`MongoDB`)

---

## 1. Visión General y Objetivos

El objetivo de este módulo es sustituir el control manual de existencias que hoy en día se realiza de forma desestructurada mediante listas de texto en WhatsApp y carpetas en Google Drive.

La solución proporciona:
1. **Multisede:** Capacidad de gestionar existencias diferenciadas por Tienda física (*Tienda Guatire*, *Tienda Caracas*) y Almacén central (*Depósito Central Terrinca*), con topes de capacidad física de exhibición configurables.
2. **Carga y Actualización:** Mecanismo de importación masiva en formato Excel (`.xlsx`) y formulario rápido de alta manual para recepción de piezas recién fabricadas en taller.
3. **Consulta Interactiva en Mostrador:** Pantalla moderna para que vendedores de tienda y online verifiquen al instante qué piezas exactas (por tela, color y medida) están disponibles para entrega inmediata.
4. **Mecanismo de Reserva Temporal Anti-Duplicidad:** Bloqueo atómico de 5-10 minutos mientras se atiende en mostrador para evitar que dos tiendas vendan la misma pieza única simultáneamente, extensible automáticamente a 30 minutos al formalizar una orden de tipo *Reserva*, con liberación por inactividad.
5. **Alimentación Real de BI:** Conectar estas existencias reales con los tableros de BI existentes (*Ocupación Física de Tiendas*, *Sugerencias de Reposición*, *Rotación de Stock*).

---

## 2. Modelo de Datos y Esquema MongoDB

### A. Extensión de `Store` (Colección `stores`)
Se añade a la entidad de tienda existente la propiedad para controlar el límite físico de unidades:
```csharp
public class Store : BaseEntity
{
    // Campos existentes: Name, Code, Address, Phone, Email, Rif, Status...
    
    [BsonElement("maxCapacity")]
    public int MaxCapacity { get; set; } = 25; // Tope físico de unidades exhibidas
}
```

### B. Nueva Entidad `Warehouse` (Colección `warehouses`)
Entidad para depósitos y almacenes centrales (ej. Terrinca):
```csharp
public class Warehouse : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty; // Ej: "Depósito Central Terrinca"

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty; // Ej: "TERRINCA-01"

    [BsonElement("address")]
    public string Address { get; set; } = string.Empty;

    [BsonElement("phone")]
    public string Phone { get; set; } = string.Empty;

    [BsonElement("maxCapacity")]
    public int MaxCapacity { get; set; } = 100;

    [BsonElement("isCentral")]
    public bool IsCentral { get; set; } = false; // Flag para depósito distribuidor

    [BsonElement("status")]
    public string Status { get; set; } = "active";
}
```

### C. Nueva Entidad `PhysicalStock` (Colección `physical_stocks`)
Control de stock físico unitario por producto base, variante específica y sede física:
```csharp
public class PhysicalStock : BaseEntity
{
    [BsonElement("productId")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("sku")]
    public string Sku { get; set; } = string.Empty;

    [BsonElement("categoryId")]
    public string CategoryId { get; set; } = string.Empty;

    [BsonElement("categoryName")]
    public string CategoryName { get; set; } = string.Empty;

    // Sede física
    [BsonElement("locationType")]
    public string LocationType { get; set; } = "store"; // "store" | "warehouse"

    [BsonElement("locationId")]
    public string LocationId { get; set; } = string.Empty; // StoreId o WarehouseId

    [BsonElement("locationName")]
    public string LocationName { get; set; } = string.Empty;

    // Desglose de variante
    [BsonElement("attributes")]
    public Dictionary<string, string> Attributes { get; set; } = new(); 
    // Ej: { "Tela": "Lino", "Color": "Gris Plomo", "Medida": "Queen (1.60x1.90)" }

    [BsonElement("variantKey")]
    public string VariantKey { get; set; } = string.Empty; 
    // Hash normalizado en minúsculas: "lino|gris plomo|queen (1.60x1.90)" para indexación O(1)

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 0; // Existencia física total

    [BsonElement("reservedQuantity")]
    public int ReservedQuantity { get; set; } = 0; // En proceso de venta/reserva

    [BsonIgnore]
    public int AvailableQuantity => Math.Max(0, Quantity - ReservedQuantity);

    [BsonElement("priceUsd")]
    public decimal PriceUsd { get; set; } = 0m;

    [BsonElement("costUsd")]
    public decimal CostUsd { get; set; } = 0m;
}
```

### D. Nueva Entidad `StockReservation` (Colección `stock_reservations`)
Control de bloqueos temporales anti-duplicidad:
```csharp
public class StockReservation : BaseEntity
{
    [BsonElement("stockId")]
    public string StockId { get; set; } = string.Empty;

    [BsonElement("productId")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("locationId")]
    public string LocationId { get; set; } = string.Empty;

    [BsonElement("locationName")]
    public string LocationName { get; set; } = string.Empty;

    [BsonElement("vendorId")]
    public string VendorId { get; set; } = string.Empty;

    [BsonElement("vendorName")]
    public string VendorName { get; set; } = string.Empty;

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 1;

    [BsonElement("reservationType")]
    public string ReservationType { get; set; } = "counter"; // "counter" (10 min) | "formal" (30 min)

    [BsonElement("orderNumber")]
    public string? OrderNumber { get; set; }

    [BsonElement("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "active"; // "active" | "released" | "converted"
}
```

---

## 3. Lógica de Negocio y Flujo de Operaciones

### A. Reserva Temporal Anti-Duplicidad
1. **Atención en Mostrador (Bloqueo Efímero 10 min):**
   - El vendedor presiona el botón *"Apartar en Mostrador"* sobre una pieza específica.
   - El backend ejecuta una operación atómica en MongoDB:
     ```csharp
     // ponytail: atomic update ensures no race conditions between two concurrent clicks
     var filter = Builders<PhysicalStock>.Filter.Where(s => s.Id == stockId && (s.Quantity - s.ReservedQuantity) >= requestedQty);
     var update = Builders<PhysicalStock>.Update.Inc(s => s.ReservedQuantity, requestedQty);
     ```
   - Si tiene éxito, se crea el documento `StockReservation` con `ExpiresAt = Now + 10 min`.
   - Si otro vendedor intenta apartarlo en la misma fracción de segundo, la consulta atómica falla y el sistema responde: *"La pieza acaba de ser apartada por [Nombre Vendedor] en [Sede]"*.
2. **Formalización a Pedido / Reserva (Extensión a 30 min):**
   - Al pasar a la pantalla de crear orden de tipo *Reserva*, el endpoint `/api/stock/reservations/{id}/extend` actualiza el tiempo de vencimiento a `Now + 30 min` asociando el número de orden.
3. **Liberación y Worker en Segundo Plano:**
   - Si el vendedor descarta el carrito o se vence el tiempo sin concretar, un `IHostedService` (`StockReservationCleanupWorker`) que corre cada 60 segundos busca reservas vencidas (`ExpiresAt < Now && Status == "active"`), las marca como `released` y restaura el stock disponible mediante `$inc: { ReservedQuantity: -qty }`.

### B. Carga Masiva (Excel) y Plantilla Oficial
- **Endpoint:** `POST /api/stock/import-excel` (Multipart/form-data).
- **Librería:** `ClosedXML` (ya instalada y probada en el backend).
- **Estructura del Excel:**
  | Sede | Tipo Sede | Producto / SKU | Categoría | Tela | Color | Medida | Cantidad | Precio USD |
  |---|---|---|---|---|---|---|---|---|
  | Guatire | Tienda | Cama Turín | Camas | Lino | Gris Plomo | Queen (1.60x1.90) | 2 | 280.00 |
  | Terrinca | Almacén | Cama Viena | Camas | Chenille | Beige | Matrimonial (1.40x1.90) | 5 | 260.00 |
- **Endpoint Auxiliar:** `GET /api/stock/import-template` genera y descarga al instante el Excel preformateado con listas desplegables de sedes y categorías.

### C. Alta Manual Rápida para Taller
- **Endpoint:** `POST /api/stock/manual-entry`
- Formulario ágil diseñado para recepción de piezas recién salidas de taller:
  - Sede de destino (Tienda o Almacén Terrinca).
  - Selector con autocompletado de Producto base.
  - Atributos (Tela, Color, Medida).
  - Cantidad a ingresar (por defecto 1).
  - Motivo / Nota de recepción (ej. *"Taller Aarón - Lote 14"*).

---

## 4. Diseño de la Interfaz de Usuario (Frontend)

### A. Configuración de Tiendas y CRUD de Almacenes
1. **Tiendas (`/tiendas`):**
   - En `StoresPage`, se agrega el campo *"Capacidad Máxima / Tope de Stock"* en los diálogos de creación y edición.
   - En la tabla de tiendas, se añade la columna *"Tope Exhibición"*.
2. **Almacenes (`/configuracion/almacenes` o vista unificada de Sedes):**
   - CRUD completo con listado, modal de creación/edición, estado activo/inactivo y flag de depósito central.

### B. Pantalla Interactiva de Consulta de Stock (`/inventario/existencias`)
- **Ruta:** Nueva ruta dedicada en la barra lateral bajo la sección de Inventario (`/inventario/existencias`).
- **Barra Superior de Herramientas:**
  - Contadores rápidos: Total piezas en stock, Total piezas disponibles, Total piezas apartadas temporalmente.
  - Botones de acción: *"Ingreso Rápido de Taller"*, *"Carga Masiva Excel"*, *"Descargar Plantilla"*.
- **Barra de Filtros:**
  - Selector de Sede: *Todas las sedes*, *Tienda Guatire*, *Tienda Caracas*, *Almacén Terrinca*.
  - Selector de Categoría.
  - Buscador en tiempo real por texto (nombre, tela, color, medida).
  - Switch: *"Solo disponibles para entrega inmediata"*.
- **Grid de Existencias:**
  - Tarjetas limpias y ordenadas con badges visuales de variante:
    - Etiqueta de sede (`bg-blue-500/10 text-blue-600` para tiendas, `bg-amber-500/10 text-amber-600` para almacén).
    - Nombre del producto en negrita y precio en USD.
    - Píldoras de variante: Tela (ej. Lino), Color (ej. Gris), Medida (ej. Queen).
    - Indicador de disponibilidad:
      - Verde `Disponible (X unidades)`.
      - Ámbar `Apartado temporal (expira en mm:ss)`.
  - Botón de Acción Principal:
    - *"Apartar en Mostrador (10 min)"* $\rightarrow$ Al hacer clic, inicia temporizador regresivo personal y bloquea la pieza para otros usuarios en tiempo real.
    - Si ya está apartada por el usuario activo: botón *"Continuar a Pedido"*.

---

## 5. Pruebas y Criterios de Aceptación (TDD)

1. **Pruebas Unitarias / Integración Backend (`Ordina.Application.Tests`):**
   - `WarehouseServiceTests`: CRUD de almacenes, validación de códigos únicos.
   - `PhysicalStockServiceTests`: Creación, actualización por importación Excel y actualización manual.
   - `StockReservationTests`:
     - Reserva exitosa decrementa `AvailableQuantity`.
     - Intento de doble reserva simultánea rechaza con error de concurrencia.
     - Extensión formal a 30 minutos actualiza fecha de expiración.
     - Liberación devuelve stock a disponible.
     - Background worker libera reservas expiradas automáticamente.
2. **Pruebas de Validación Frontend:**
   - Renderizado y filtrado en `/inventario/existencias`.
   - Diálogos de Carga Masiva y Alta Manual con validaciones de campos requeridos.
   - Cuenta regresiva del temporizador de reserva temporal.

---

## 6. Próximo Paso
Tras la revisión y aprobación de esta especificación de diseño por parte del usuario, se procederá a invocar la habilidad `writing-plans` para desglosar el plan de tareas paso a paso listo para ejecución.

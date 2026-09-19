# Reglas de Negocio: Manufactura y Taller

**Módulo:** Taller, Producción y Manufactura  
**Entidades Principales:** `WorkOrder`, `OrderProduct`, `RefabricationRecord`, `ManufacturingStage`  
**Servicios de Aplicación:** `IManufacturingService`, `ManufacturingService`  

---

## 1. Alcance y Visión del Taller

El módulo de **Manufactura** coordina la confección, carpintería, tapicería y acabado de muebles a medida o productos bajo encargo (`SaleType.CustomOrder`). La unidad fundamental de seguimiento es el **ítem individual** (`OrderProduct`) dentro del pedido, permitiendo que un mismo pedido contenga productos en tienda y productos en confección simultáneamente.

---

## 2. Etapas del Tablero Kanban (`ManufacturingStage`)

El flujo operativo se modela como un tablero Kanban con cuatro columnas o estados estrictos:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌────────────────────────┐
│  Debe Fabricar  │ ──► │  Por Fabricar   │ ──► │   Fabricando    │ ──► │ Almacén (No Fabricado) │
│ (debe_fabricar) │     │ (por_fabricar)  │     │  (fabricando)   │     │ (almacen_no_fabricado) │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └────────────────────────┘
         ▲                                                                           │
         │                                                                           │
         └─────────────────────── [ Refabricación ] ─────────────────────────────────┘
                                  (Falla o defecto)
```

| Etapa | Código Enum | Ubicación Física | Estado Logístico | Descripción Operativa |
| :--- | :--- | :--- | :--- | :--- |
| **Debe Fabricar** | `MustManufacture` | `FABRICACION` | `Generado` / `Fabricándose` | Ítem recién creado por venta o resultante de una orden de refabricación. Pendiente de asignación de taller. |
| **Por Fabricar** | `ToManufacture` | `FABRICACION` | `Fabricándose` | Ítem asignado formalmente a un taller o artesano externo con fecha estimada. |
| **Fabricando** | `Manufacturing` | `FABRICACION` | `Fabricándose` | Trabajo activo en corte, ensamblado, tapicería o acabado. |
| **Almacén No Fabricado** | `WarehouseUnmanufactured` | `EN TIENDA` / `ALMACEN` | `En Almacén` | Producto terminado en taller y recibido en bodega/tienda, listo para inspección y despacho. |

---

## 3. Transiciones Automáticas de Estado

Al mover un producto entre las columnas del tablero Kanban, el sistema dispara mutaciones atómicas sobre sus campos de auditoría y ubicación:

### 1. Transición hacia `fabricando`:
- `product.ManufacturingStartedAt`: Se inicializa con la marca de tiempo UTC actual (`DateTime.UtcNow`) si estaba vacía.
- `product.LocationStatus`: Muta automáticamente a **`"FABRICACION"`**.
- `product.LogisticStatus`: Muta automáticamente a **`"Fabricándose"`**.

### 2. Transición hacia `almacen_no_fabricado`:
- `product.ManufacturingCompletedAt`: Se registra la fecha y hora exacta de terminación (`DateTime.UtcNow`).
- `product.LocationStatus`: Muta automáticamente a **`"EN TIENDA"`**.
- `product.LogisticStatus`: Muta automáticamente a **`"En Almacén"`**.
- El producto queda habilitado para ingresar inmediatamente a la **Cola de Despacho**.

---

## 4. Asignación de Proveedores y Talleres Artesanales

1. Cada producto en taller puede asociarse a un artesano o taller específico mediante:
   - `ManufacturingProviderId`: Identificador único del proveedor en el catálogo.
   - `ManufacturingProviderName`: Nombre comercial del taller.
2. El tablero Kanban permite filtrado por proveedor, de modo que cada taller o encargado de área visualiza exclusivamente sus órdenes en curso.
3. Las notas de confección (`ManufacturingNotes`) permiten documentar instrucciones técnicas especiales (códigos de tela, variaciones de medidas, refuerzos estructurales).

---

## 5. Ciclo de Refabricación (*Refabrication Record*)

Cuando un producto completado o en etapa final no supera los estándares de calidad de Camihogar o presenta una observación insalvable:

```
                            [ Reporte de Falla ]
                                     │
                                     ▼
                   Registro de Historial de Refabricación
                    • Motivo (Reason)
                    • Artesano Original (PreviousProvider)
                    • Nuevo Artesano (NewProvider)
                    • Fecha/Hora UTC (RefabricatedAt)
                                     │
                                     ▼
                   Reversión Automática del Producto:
                    • Etapa ➔ "debe_fabricar"
                    • Ubicación ➔ "FABRICACION"
                    • Logística ➔ "Fabricándose"
```

### Reglas de Refabricación:
1. **Historial Acumulativo:** Cada evento de refabricación se almacena en una lista inmutable `RefabricationHistory` dentro del producto.
2. **Reasignación Flexible:** La refabricación puede asignarse al mismo proveedor original o reasignarse a un taller distinto.
3. **Reingreso al Tablero:** El ítem reaparece en la columna *"Debe Fabricar"* con la indicación visual de refabricación y el motivo documentado.

---

## 6. Métrica de Productos por Fabricar

El Dashboard de administración calcula la métrica global **"Productos por Fabricar"** considerando todos los productos que demanden mano de obra en taller:

$$\text{Productos por Fabricar} = \sum \text{Cantidad}$$
Donde la orden está activa (`Status != Cancelado, Declinado`) y el producto cumple cualquiera de estas condiciones:
- `ManufacturingStatus` es `"debe_fabricar"`
- `ManufacturingStatus` es `"por_fabricar"`
- `LocationStatus` es `"FABRICACION"`

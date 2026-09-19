# Reglas de Negocio: Bodega, Despacho y Rutas

**Módulo:** Logística, Almacén y Distribución  
**Entidades Principales:** `DispatchRoute`, `DispatchItem`, `OrderProduct`, `DeliveryServices`  
**Servicios de Aplicación:** `IDispatchService`, `DispatchService`  

---

## 1. Alcance y Filosofía Logística

El módulo de **Despacho** gestiona la consolidación de productos terminados en bodega, la planificación de rutas terrestres y la confirmación de entrega física en el domicilio del cliente. El sistema opera a nivel de **ítem individual de pedido**, permitiendo entregas parciales cuando una orden combina productos listos y productos aún en taller.

---

## 2. Cola de Despacho (*Dispatch Queue*)

La cola de despacho representa el inventario físico en bodega disponible para ser cargado en un vehículo de transporte.

### Criterios de Elegibilidad para Entrar a la Cola:
Un ítem califica automáticamente para la cola si cumple **todas** las siguientes condiciones:
1. El pedido es una venta en firme (`Type == "Order"`).
2. El pedido no está cancelado (`Status != "Cancelado"`).
3. El pedido contempla servicio de entrega a domicilio (`HasDelivery == true`).
4. El producto está físicamente en bodega o tienda (`LocationStatus` en `"EN TIENDA"` o `"ALMACEN"`).
5. El producto no ha sido entregado previamente (`LogisticStatus != "Completado"`).

```
                      [ Producto en Almacén ]
                      • LocationStatus: EN TIENDA / ALMACEN
                      • HasDelivery: true
                      • LogisticStatus != Completado
                                 │
                                 ▼
                     [ Cola de Despacho Activa ]
                     (Filtrable por Zona y Fecha)
```

---

## 3. Zonas de Despacho y Servicios Adicionales

### 1. Zonas de Entrega (`DeliveryZone`):
Las rutas se planifican agrupando pedidos por cuadrantes geográficos para optimizar combustible y tiempos de traslado:
- `caracas`: Área metropolitana central.
- `guatire_guarenas`: Eje Plaza-Zamora.
- `altos_mirandinos`: San Antonio, Los Teques.
- `valles_del_tuy`: Charallave, Cúa, Ocumare.
- `la_guaira`: Eje costero.
- `nacional`: Envíos por encomienda fuera de la región capital.

### 2. Servicios Conexos (`DeliveryServices`):
Además del flete estándar, el cliente puede contratar servicios especializados:
- **Delivery Express (`DeliveryExpress`):** Despacho prioritario en menos de 24 horas.
- **Servicio de Acarreo (`ServicioAcarreo`):** Subida manual de muebles pesados por escaleras o accesos difíciles.
- **Servicio de Armado (`ServicioArmado`):** Ensamble y ajuste de estructuras en el domicilio por personal técnico.

---

## 4. Planificación y Creación de Rutas (`DispatchRoute`)

Una ruta de despacho formaliza la salida de un vehículo con una carga consolidada:

### Datos Obligatorios:
- **Identificación:** Nombre descriptivo de la ruta (ej. *"Ruta Este - Camión 2 - 19/09"*).
- **Conductor:** Nombre (`DriverName`) y teléfono de contacto (`DriverPhone`).
- **Transporte:** Placa del vehículo (`VehiclePlate`).
- **Programación:** Fecha de ruta (`RouteDate`) y zona geográfica (`Zone`).

### Efectos Inmediatos al Guardar la Ruta:
1. Se crea la entidad `DispatchRoute` con estado `"Generado"`.
2. Todos los ítems asignados dentro de la ruta pasan a estado `"EN RUTA"`.
3. **Mutación en la Orden Original:** Para cada ítem incluido, el producto en su pedido respectivo muta atómicamente a:
   - `LocationStatus = "EN RUTA"`
   - `LogisticStatus = "En Ruta"`

---

## 5. Protocolo de Confirmación de Entrega

La entrega de la mercancía no es un proceso ciego por orden completa; se confirma **ítem por ítem** cuando el chofer entrega y el cliente inspecciona:

```
                  [ Chofer Entrega Ítem en Destino ]
                                 │
                                 ▼
                   Confirmación (ConfirmDelivery)
                    • RouteId + OrderId + ProductLineId
                                 │
        ┌────────────────────────┴────────────────────────┐
        ▼                                                 ▼
[ En la Ruta de Despacho ]                       [ En el Pedido Original ]
• Ítem marcado "DESPACHADO"                      • Producto marcado "DESPACHADO"
• DeliveredAt: DateTime.UtcNow                   • LogisticStatus: "Completado"
• Si todos los ítems fueron despachados:          • DeliveredAt: DateTime.UtcNow
  Ruta pasa a "Completado"                                │
                                                          ▼
                                            [ Validación de Cierre ]
                                             ¿Todos los productos del
                                              pedido están DESPACHADO?
                                             ├── SÍ ➔ Pedido: "Completado"
                                             └── NO ➔ Pedido sigue "Pendiente"
```

### Regla de Cierre Automático:
Cuando el **100% de los productos de un pedido** alcanzan la ubicación `"DESPACHADO"`, el pedido muta de forma automática a estado **`"Completado"`**, cerrando el ciclo logístico.

---

## 6. Devoluciones a Bodega / Taller

Si un ítem en ruta es rechazado o presenta observaciones al momento de la entrega:
1. No se confirma la entrega (`DESPACHADO`).
2. Se registran las observaciones en `dispatchObservations`.
3. El ítem puede reingresarse a `"ALMACEN"` o retornarse a `"FABRICACION"` si requiere ajuste técnico.

---

## 7. Matriz de Autorización para Vendedores Online

Los usuarios con rol **Online Seller** cuentan con permisos diferenciados en el flujo de despacho:
- **Habilitado:** Pueden enviar pedidos de cualquier miembro de su equipo a ruta (`dispatch.send_to_route`).
- **Restringido:** No pueden confirmar entregas finales (`dispatch.confirm_delivery`) ni eliminar rutas de transporte (reservado exclusivamente para personal de bodega y administración).

# Reglas de Negocio: Pedidos, Presupuestos y Ventas

**Módulo:** Órdenes Comerciales  
**Entidades Principales:** `Order`, `OrderProduct`, `PaymentDetails`, `PartialPayment`, `DeliveryServices`  
**Servicios de Aplicación:** `IOrderCoreService`, `OrderCoreService`  

---

## 1. Tipos de Orden y Nomenclatura

El sistema gestiona tres tipologías de documentos comerciales mediante el enumerador `OrderType`:

| Tipo | Código Enum | Prefijo de Numeración | Propósito Operativo |
| :--- | :--- | :--- | :--- |
| **Pedido / Venta** | `OrderType.Order` | `ORD-XXXXXX` | Venta en firme. Compromete inventario y/o genera órdenes de taller. |
| **Presupuesto** | `OrderType.Budget` | `PRE-XXXXXX` | Cotización formal emitida al cliente. No afecta inventario ni compromete producción. |
| **Reserva** | `OrderType.Reservation` | `RES-XXXXXX` | Apartado temporal de mercancía sujeto a confirmación o anticipo. |

### Reglas de Numeración:
1. La numeración es **autoincremental y correlativa por prefijo**, generada de forma atómica en base de datos.
2. Un pedido creado directamente nace con prefijo `ORD-`.
3. Un presupuesto nace con prefijo `PRE-` y puede convertirse posteriormente a `ORD-`.

---

## 2. Modalidades de Venta (`SaleType`)

Todo pedido formal debe clasificarse en una de las tres modalidades de venta admitidas:

```
                  ┌─────────────────┐
                  │    SaleType     │
                  └────────┬────────┘
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
     Entrega            Encargo        Sistema de Apartado
  (Mercancía en      (Fabricación     (Reserva con abono,
   stock / tienda)     a medida)       máximo 90 días)
```

1. **Entrega (`entrega`):**
   - Corresponde a productos existentes en inventario físico (tienda o almacén central).
   - Los productos nacen con ubicación `EN TIENDA` o `ALMACEN` y estado de disponibilidad `disponible`.
   - No requieren pasar por el tablero de taller salvo que presenten observaciones.

2. **Encargo (`encargo`):**
   - Fabricación a solicitud con especificaciones personalizadas (medidas, tipo de tela, color de madera).
   - Los productos nacen con estado de fabricación `debe_fabricar` y ubicación `FABRICACION`.

3. **Sistema de Apartado (`sistema_apartado`):**
   - El cliente reserva uno o varios productos abonando un porcentaje inicial.
   - **Plazo máximo de liquidación:** 90 días calendario continuos.
   - Si transcurren más de 90 días y el pedido mantiene saldo pendiente, se clasifica automáticamente como **SA Vencido**, habilitando la gestión de cobranza o liberación del inventario.

---

## 3. Estados de la Orden (`OrderStatus`) y Ciclo de Vida

El estado general del pedido sintetiza la condición operativa y de cobranza:

| Estado | Significado Comercial |
| :--- | :--- |
| **`Pendiente`** | Pedido creado con pagos pendientes o en proceso de fabricación/despacho. |
| **`Apartado`** | Pedido bajo modalidad de Sistema de Apartado con saldo deudor dentro del plazo legal. |
| **`Completado`** | 100% de los productos despachados exitosamente y cuenta saldada (o con crédito formal aprobado). |
| **`Cancelado`** | Pedido anulado antes de iniciar procesos logísticos o de taller. |
| **`Declinado`** | Pedido rechazado comercialmente por cliente o administración (sujeto a regla de *Smart Decline*). |

---

## 4. Estructura Matemática y Cálculo Financiero

El cálculo de totales de un pedido es determinista y sigue una fórmula estricta para evitar discrepancias por redondeo:

### Fórmulas de Cálculo:
1. **Total por Línea de Producto:**
   $$\text{Total Producto} = (\text{Precio Unitario} \times \text{Cantidad}) - \text{Descuento Línea}$$
2. **Subtotal Base del Pedido:**
   $$\text{Subtotal} = \sum_{i=1}^{n} \text{Total Producto}_i$$
3. **Subtotal Antes de Descuentos:**
   $$\text{Subtotal Antes de Descuentos} = \text{Subtotal} + \sum_{i=1}^{n} \text{Descuento Línea}_i$$
4. **Descuento General:**
   - Si se especifica porcentaje ($P$):
     $$\text{Descuento General} = \text{Round}\left(\text{Subtotal} \times \frac{P}{100}, 2\right)$$
   - Si se especifica monto fijo ($M$):
     $$\text{Descuento General} = M$$
5. **Total Neto a Pagar:**
   $$\text{Total} = \max\left(0, \text{Subtotal} + \text{Costo Delivery} - \text{Descuento General} - \text{Saldo a Favor Aplicado}\right)$$

> [!IMPORTANT]
> El total nunca puede resultar en un número negativo ($\text{Total} \ge 0$). Si la suma de descuentos y saldos a favor supera el subtotal más delivery, el total final será exactamente `$0.00`.

---

## 5. Conversión de Presupuesto a Pedido

Un presupuesto (`PRE-XXXXXX`) puede convertirse en pedido en firme cuando el cliente confirma la compra:

1. **Validación de Tipo:**
   - La orden debe poseer estrictamente `Type == "Budget"`. Intentar convertir una orden que ya es `Order` arroja una excepción de regla de negocio.
2. **Generación de Nuevo Identificador:**
   - Se genera un nuevo código correlativo oficial con prefijo `ORD-XXXXXX`.
3. **Trazabilidad Histórica:**
   - El código anterior del presupuesto se almacena permanentemente en el campo `convertedFromNumber` (ej. `PRE-001234`).
4. **Transición de Estado:**
   - El tipo muta a `"Order"`.
   - El estado se inicializa en `"Pendiente"`.
   - Se asocian el vendedor que concretó el cierre (`VendorId`, `VendorName`) y las condiciones de pago pactadas.

---

## 6. Regla de Declinado Inteligente (*Smart Decline*)

Para evitar que órdenes canceladas o declinadas hagan desaparecer ítems valiosos que ya están en proceso de manufactura o en ruta de despacho, se aplica la regla de **Declinado Inteligente**:

```
                         [ Acción: Declinar Pedido ]
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
        [ Estados Blandos ]                     [ Estados Protegidos ]
        • Generado                              • Fabricándose / En Taller
        • Validado                              • En Almacén
                 │                              • En Ruta
                 ▼                              • Despachado / Completado
      Pasan a: "Declinado"                               │
                                                         ▼
                                               CONSERVAN SU ESTADO
                                            (Visibles en auditoría y taller)
```

### Reglas del Declinado:
1. **Solo los productos en estados "blandos" (`Generado`, `Validado`) mutan a `Declinado`.**
2. **Los productos protegidos** (`Fabricándose`, `En Almacén`, `En Ruta`, `Despachado`) **conservan su estado intacto.**
3. **Razón del Declinado (`declineReason`):**
   - Campo de texto obligatorio o sugerido al momento de declinar, editable posteriormente por administradores.
   - Queda registrado en el historial de auditoría de la orden.
4. **Reactivación de Pedido:**
   - Al reactivar un pedido declinado, se limpia el campo `declineReason = null` y únicamente los productos en estado `Declinado` se revierten a `Generado`. Los productos protegidos continúan su flujo normal.

---

## 7. Concurrencia Optimista

Para prevenir la sobrescritura ciega cuando múltiples vendedores o cajeros abren y modifican el mismo pedido simultáneamente:

1. **Cabecera `If-Match` o `expectedUpdatedAt`:**
   - Toda actualización envía la fecha/hora UTC exacta de la última versión leída (`expectedUpdatedAt`).
2. **Validación Atómica en Servidor:**
   - El backend ejecuta una actualización condicional en MongoDB donde `_id == OrderId && UpdatedAt == expectedUpdatedAt`.
3. **Resolución de Conflictos:**
   - Si otro usuario guardó cambios en el milisegundo intermedio, la condición no coincide y el servidor responde con un código **`409 Conflict`** con el mensaje:
     > *"CONFLICT: El pedido ha sido modificado por otro usuario o proceso. Recargue la página."*

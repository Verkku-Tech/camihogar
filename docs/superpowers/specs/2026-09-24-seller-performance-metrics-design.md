# Spec: Métricas de Rendimiento de Vendedores en Ranking BI

## 1. Contexto y Objetivos
El dashboard de BI cuenta con el componente `TopSellersChart` ("Ranking de Vendedores y Comisiones"). Actualmente muestra únicamente el volumen facturado en USD y la comisión estimada.
El objetivo es enriquecer las métricas de los vendedores tomando en cuenta **exclusivamente pedidos concretados** (excluyendo presupuestos `PRE-`, reservas `RES-` y cancelados según `IsValidOrder(o)`).
Se dotará a la tarjeta de un selector reactivo de métricas para que el usuario pueda alternar entre diferentes dimensiones comerciales:

1. **Facturación Total ($):** Volumen total en USD de pedidos concretados.
2. **Ticket Promedio ($):** Facturación total / Cantidad de pedidos concretados.
3. **Pedidos Concretados (#):** Número de ventas cerradas válidas.
4. **Unidades por Pedido (UPT):** Promedio de productos por pedido (`sum(quantity) / ordersCount`).
5. **Descuento Promedio (%):** Porcentaje promedio de descuento otorgado sobre el subtotal bruto.
6. **Conversión de Reservas (%):** Pedidos convertidos provenientes de reservas / Total de reservas gestionadas.
7. **Comisión Estimada ($):** Comisión ganada según reglas de tipo de venta.

---

## 2. Definición y Fórmulas de Métricas

### 2.1 Criterio de Pedido Concretado
Solo se consideran órdenes donde `IsValidOrder(o) == true`:
- `o.Type is not (OrderType.Budget or OrderType.Reservation)`
- `o.OrderNumber` no comienza con `RES-`, `PCF-`, ni `PRE-`.
- `o.StatusString` no es `Cancelado` ni `Declinado`.

### 2.2 Cálculos en `DashboardService`
Para cada vendedor con órdenes concretadas en el período:
- **`TotalUsd`**: Suma en USD de las órdenes concretadas.
- **`OrdersCount`**: Cantidad de órdenes concretadas.
- **`AverageTicketUsd`**: `OrdersCount > 0 ? Math.Round(TotalUsd / OrdersCount, 2) : 0m`.
- **`UnitsPerOrder`**: `OrdersCount > 0 ? Math.Round((double)TotalUnits / OrdersCount, 2) : 0`.
- **`AverageDiscountPercent`**:
  Calculado sobre cada orden como:
  `SubtotalBase = Subtotal + (ProductDiscountTotal ?? 0) + (GeneralDiscountAmount ?? 0)`
  `TotalDiscount = (ProductDiscountTotal ?? 0) + (GeneralDiscountAmount ?? 0)`
  `Pct = SubtotalBase > 0 ? (TotalDiscount / SubtotalBase) * 100 : 0`
  Promedio ponderado del vendedor: `(Sum(TotalDiscount) / Sum(SubtotalBase)) * 100`.
- **`ReservationConversionRate`**:
  De todas las órdenes en el período asignadas al vendedor (vía `VendorId` o `SourceReservationVendorId`):
  - Reservas activas/creadas: `Type == Reservation || OrderNumber.StartsWith("RES-")`
  - Pedidos concretados convertidos: `IsValidOrder(o) && (!string.IsNullOrWhiteSpace(o.ConvertedFromNumber) || !string.IsNullOrWhiteSpace(o.SourceReservationVendorId))`
  - Total oportunidades = `Reservas + Convertidos`.
  - `% Conversión` = `TotalOportunidades > 0 ? Math.Round(((decimal)Convertidos / TotalOportunidades) * 100, 1) : 0m`.
- **`EstimatedCommissionUsd`**: Cálculo existente basado en reglas de comisión por tipo de venta.

---

## 3. Modelo de Datos y Contratos de API

### 3.1 Backend DTO (`TopSellerDto`)
```csharp
public record TopSellerDto(
    string VendorId,
    string VendorName,
    int OrdersCount,
    decimal TotalUsd,
    decimal? EstimatedCommissionUsd,
    decimal AverageTicketUsd = 0m,
    double UnitsPerOrder = 0,
    decimal AverageDiscountPercent = 0m,
    decimal ReservationConversionRate = 0m,
    int ConvertedReservationsCount = 0
);
```

### 3.2 Frontend Interface (`TopSeller`)
```ts
export interface TopSeller {
  vendorId: string;
  vendorName: string;
  ordersCount: number;
  totalUsd: number;
  estimatedCommissionUsd?: number;
  averageTicketUsd: number;
  unitsPerOrder: number;
  averageDiscountPercent: number;
  reservationConversionRate: number;
  convertedReservationsCount: number;
}
```

---

## 4. UI / UX en `TopSellersChart`
1. **Selector de Métrica en el Header:**
   Un selector (`Select` o botones estilizados) en la cabecera de la tarjeta con las opciones:
   - Facturación ($)
   - Ticket Promedio ($)
   - Pedidos Concretados (#)
   - Unidades / Pedido (UPT)
   - Descuento Promedio (%)
   - Conversión de Reservas (%)
   - Comisión Estimada ($)
2. **Reordenamiento Reactivo:**
   Al cambiar de métrica, el ranking se ordena descendentemente según la métrica seleccionada.
3. **Formateo Dinámico del Eje X y Tooltip:**
   - Moneda (`$XX.Xk` o `$XXX`) para facturación, ticket y comisión.
   - Entero (`X pedidos`, `X uds`) para pedidos y UPT.
   - Porcentaje (`XX.X%`) para descuento y conversión de reservas.
4. **Paleta de Colores de Podio:**
   Consistente con el diseño actual de Camihogar (verde esmeralda para el #1, verde, cyan, azul, índigo...).

---

## 5. Pruebas y Validación
- Pruebas unitarias en `DashboardComprehensiveBiTests` y `DashboardService` validando:
  - Exclusión estricta de reservas y presupuestos para conteo de pedidos y volumen.
  - Cálculo correcto de `AverageTicketUsd`, `UnitsPerOrder`, `AverageDiscountPercent` y `ReservationConversionRate`.
- Verificación de compilación y tipado de frontend.

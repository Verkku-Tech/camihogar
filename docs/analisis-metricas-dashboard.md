# Analisis de Metricas del Dashboard

## 1. Total Facturado

**Que es:** La suma de los totales de todos los pedidos creados en el periodo seleccionado, expresados en USD comercial.

**Donde se calcula:**
- Backend: `OrderRepository.cs:696-701` - Suma `o.Total` de todos los pedidos validos creados en el periodo
- Frontend (fallback): `storage.ts:4432-4434` - Usa `getCommercialTotalUsd(order)` que convierte el total a USD usando la tasa de cambio del pedido

**Que incluye:**
- Pedidos creados en el periodo (filtrado por `CreatedAt`)
- Excluye: Budget, Reservation, PendingConfirmation, Declinado, Cancelado, pedidos con prefijo RES- o PCF-

**Formula:** `SUMA(order.Total)` de pedidos validos creados en el periodo

> **Nota:** "Total Facturado" NO es lo mismo que "Total Cobrado". Facturado = pedidos generados (deuda total). Cobrado = dinero efectivamente recibido.

---

## 2. Total Cobrado

**Que es:** La suma de todos los pagos (abonos) recibidos en el periodo, expresados en USD.

**Donde se calcula:**
- Backend: `OrderRepository.cs:737-762` - Itera `PartialPayments` y `MixedPayments` con fecha en el periodo
- Frontend (fallback): `storage.ts:4447-4457` - Misma logica usando `getActivePaymentsList()`

**Que incluye:**
- Solo pagos en `PartialPayments` o `MixedPayments` (abonos registrados)
- Conversion a USD: si el pago es en Bs, usa la tasa del pago -> order -> tasa del dia

**Filtro de pedidos:**
- Excluye Declinado y Cancelado
- Busca pedidos que tengan al menos un pago con fecha en el periodo

**Formula:** `SUMA(ConvertPaymentToUsd(pago))` para cada pago en PartialPayments/MixedPayments con fecha en el periodo

---

## 3. Reporte Detallado de Pagos

**Que es:** Listado fila por fila de cada pago registrado, con filtros por fecha, metodo y cuenta.

**Donde se calcula:**
- Backend: `ReportService.cs:934-1084` (`GetFilteredPaymentsDataAsync`)
- Frontend (fallback): `payments-report.tsx:524-703` (`generateLocalReportData`)

**Que incluye:**
- Pagos en `PartialPayments` o `MixedPayments` (si existen)
- SI NO hay abonos en listas: usa el **pago principal** (`order.PaymentDetails`) con fecha de la orden

**Filtro de pedidos:**
- Excluye Budget, Reservation, Declinado
- **NO excluye Cancelado** (diferencia clave con el dashboard)

---

## 4. Diferencias clave que causan el descuadre

### Diferencia A: Pedidos cancelados

| Metrica | Excluye Cancelado? |
|---------|-------------------|
| Total Cobrado (dashboard) | SI - filtra `fb.Nin(o.Status, ["Declinado", "Cancelado"])` |
| Reporte de Pagos | NO - solo excluye Declinado |

**Impacto:** Si hay pedidos cancelados con pagos registrados, el reporte los incluye pero el dashboard NO.

### Diferencia B: Pago principal vs abonos

| Metrica | Que suma? |
|---------|----------|
| Total Cobrado (dashboard) | SOLO PartialPayments + MixedPayments |
| Reporte de Pagos | PartialPayments + MixedPayments, O el pago principal (PaymentDetails) si no hay abonos |

**Impacto:** Un pedido sin abonos (solo pago principal en `order.PaymentDetails`) aparece en el reporte pero NO en el Total Cobrado del dashboard.

### Diferencia C: Manejo de fechas

| Metrica | Como maneja la fecha? |
|---------|----------------------|
| Total Cobrado (dashboard) | Comparacion directa UTC con offset -4h manual (`OrderRepository.cs:757`) |
| Reporte de Pagos | `PaymentCalendarDate.ToCalendarDate()` que normaliza a fecha calendario VE (`ReportService.cs:974`) |

**Impacto:** Pagos entre medianoche VE y 04:00 UTC podrian caer en dias diferentes segun la metrica.

### Diferencia D: Conversion a USD

| Metrica | Como convierte? |
|---------|----------------|
| Total Cobrado (dashboard) | `ConvertPaymentToUsd` - usa tasa del pago, luego order, luego live rate |
| Reporte de Pagos | Muestra monto original en moneda original + monto en Bs por separado |

**Impacto:** El reporte NO muestra un total en USD. El dashboard si. Son vistas diferentes del mismo dato.

---

## 5. Que preguntar al cliente

1. **El descuadre es con pedidos cancelados?** - El dashboard excluye cancelados, el reporte no.
2. **Hay pedidos sin abonos (solo pago principal)?** - El dashboard no los cuenta como cobrados, el reporte si.
3. **Cual es la referencia que usa el cliente para validar?** - El total de la columna "Monto" del reporte vs el Total Cobrado del dashboard.
4. **Que entiende el cliente por "Total Cobrado"?** - Si espera ver todo lo que entro al sistema (incluyendo cancelados y pagos principales), el dashboard esta filtrando de mas.

---

## 6. Resumen rapido para la reunion

```
Total Facturado = Suma de totales de pedidos creados en el periodo (deuda generada)
Total Cobrado   = Suma de abonos recibidos en el periodo (dinero real recibido)
Reporte Pagos   = Listado detallado de CADA pago (puede incluir cancelados y pagos principales)
```

**El descuadre probable viene de:**
1. Pedidos cancelados que el reporte incluye y el dashboard excluye
2. Pedidos con solo pago principal (sin abonos) que el reporte incluye y el dashboard excluye
3. Diferencias menores en manejo de fechas y zonas horarias

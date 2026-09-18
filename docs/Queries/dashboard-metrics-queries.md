# Guía de Consultas MongoDB: Métricas del Dashboard (mongosh)

Esta guía contiene los scripts para auditar y verificar directamente en la base de datos de MongoDB (`ordina_db`) las **7 métricas de negocio** del Dashboard de administración:

1. **Total Ventas**: Cantidad de pedidos generados en el período.
2. **Total Facturado**: Monto total comercial (USD y Bs.) de pedidos generados en el período (excluye presupuestos y anulados).
3. **Total Cobrado**: Ingresos reales recibidos en el período (abonos parciales y mixtos en USD y Bs. convertidos según la tasa respectiva).
4. **Ticket Promedio**: Facturación total dividida entre el número de pedidos generados (`Total Facturado / Total Ventas`).
5. **Abonos por Recaudar**: Saldo pendiente global por cobrar de todos los pedidos activos.
6. **SA Vencidos**: Monto adeudado y cantidad de Sistemas de Apartado con más de 90 días de antigüedad.
7. **Productos por Fabricar**: Unidades en estado de fabricación o pendientes por fabricar en taller.

---

## 🛠️ Cómo Ejecutar

1. Abre tu terminal y conéctate a la instancia de MongoDB (por ejemplo, vía `mongosh` o extensión de MongoDB en VS Code):
   ```bash
   mongosh "mongodb://localhost:27017/ordina_db"
   ```
2. Copia y pega el bloque completo a continuación.

---

## 🚀 Script Completo de Verificación

```javascript
// ==========================================================
// 1. RANGO DE FECHAS (Horario local Venezuela UTC-4)
// ==========================================================
var startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);

var endOfDay = new Date();
endOfDay.setHours(23, 59, 59, 999);

// ==========================================================
// 2. OBTENCIÓN DE TASA ACTIVA USD DEL DÍA
// ==========================================================
var activeRateDoc = db.exchangeRates.find({ toCurrency: "USD", isActive: true }).sort({ effectiveDate: -1 }).limit(1).toArray()[0]
                 || db.exchangeRates.find({ toCurrency: "USD" }).sort({ createdAt: -1 }).limit(1).toArray()[0];

var liveUsdRate = activeRateDoc ? Number(activeRateDoc.rate) : 1.0;

print("\n==================================================");
print("📊 VERIFICACIÓN DE MÉTRICAS DEL DASHBOARD");
print("Rango: " + startOfDay.toISOString() + " -> " + endOfDay.toISOString());
print("Tasa USD del Día: Bs. " + liveUsdRate);
print("==================================================\n");

// ==========================================================
// 3. TOTAL VENTAS, FACTURADO Y TICKET PROMEDIO
// ==========================================================
var ventasRaw = db.orders.aggregate([
  {
    $match: {
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      type: { $nin: ["Budget", "Reservation", "PendingConfirmation", "budget", "reservation"] },
      status: { $nin: ["Declinado", "Cancelado"] },
      orderNumber: { $not: /^RES-/i, $not: /^PCF-/i }
    }
  },
  {
    $group: {
      _id: null,
      cant: { $sum: 1 },
      facturadoUsd: { $sum: "$total" }
    }
  }
]).toArray()[0] || { cant: 0, facturadoUsd: 0 };

var cantVentas = Number(ventasRaw.cant || 0);
var totalFacturadoUsd = Number(ventasRaw.facturadoUsd || 0);

// ==========================================================
// 4. TOTAL COBRADO (Pagos recibidos en el período)
// ==========================================================
var totalCobradoUsd = 0;

var ordersConPagos = db.orders.find({
  status: { $nin: ["Declinado", "Cancelado"] },
  $or: [
    { "partialPayments.date": { $gte: startOfDay, $lte: endOfDay } },
    { "mixedPayments.date": { $gte: startOfDay, $lte: endOfDay } }
  ]
}).toArray();

ordersConPagos.forEach(order => {
  var allPayments = (order.partialPayments || []).concat(order.mixedPayments || []);
  allPayments.forEach(p => {
    if (p.date >= startOfDay && p.date <= endOfDay) {
      var det = p.paymentDetails || {};
      var currency = det.originalCurrency || p.currency || "Bs";
      var amount = Number(det.originalAmount || p.amount || 0);
      var paymentRate = Number(
        det.exchangeRate || 
        (order.exchangeRatesAtCreation && order.exchangeRatesAtCreation.USD ? order.exchangeRatesAtCreation.USD.rate : null) || 
        liveUsdRate
      );

      if (currency === "USD") {
        totalCobradoUsd += amount;
      } else if (currency === "Bs") {
        totalCobradoUsd += paymentRate > 0 ? (amount / paymentRate) : 0;
      }
    }
  });
});

// ==========================================================
// 5. ABONOS POR RECAUDAR (Saldo pendiente global)
// ==========================================================
var abonosPorRecaudarUsd = 0;

var activeOrders = db.orders.find({
  type: { $nin: ["Budget", "Reservation", "PendingConfirmation", "budget", "reservation"] },
  status: { $nin: ["Declinado", "Cancelado", "Entregado", "Completado", "Completada"] }
}).toArray();

activeOrders.forEach(order => {
  var orderTotal = Number(order.total || 0);
  var allPayments = (order.partialPayments || []).concat(order.mixedPayments || []);
  var paidUsd = 0;

  allPayments.forEach(p => {
    var det = p.paymentDetails || {};
    var currency = det.originalCurrency || p.currency || "Bs";
    var amount = Number(det.originalAmount || p.amount || 0);
    var paymentRate = Number(
      det.exchangeRate || 
      (order.exchangeRatesAtCreation && order.exchangeRatesAtCreation.USD ? order.exchangeRatesAtCreation.USD.rate : null) || 
      liveUsdRate
    );

    if (currency === "USD") {
      paidUsd += amount;
    } else if (currency === "Bs") {
      paidUsd += paymentRate > 0 ? (amount / paymentRate) : 0;
    }
  });

  var pending = orderTotal - paidUsd;
  if (pending > 0.01) {
    abonosPorRecaudarUsd += pending;
  }
});

// ==========================================================
// 6. SA VENCIDOS (Sistemas de apartado > 90 días con deuda)
// ==========================================================
var hace90Dias = new Date();
hace90Dias.setDate(hace90Dias.getDate() - 90);

var saVencidosUsd = 0;
var saVencidosCount = 0;

var saOrders = db.orders.find({
  saleType: "sistema_apartado",
  createdAt: { $lt: hace90Dias },
  status: { $nin: ["Declinado", "Cancelado", "Entregado", "Completado", "Completada"] }
}).toArray();

saOrders.forEach(order => {
  var orderTotal = Number(order.total || 0);
  var allPayments = (order.partialPayments || []).concat(order.mixedPayments || []);
  var paidUsd = 0;

  allPayments.forEach(p => {
    var det = p.paymentDetails || {};
    var currency = det.originalCurrency || p.currency || "Bs";
    var amount = Number(det.originalAmount || p.amount || 0);
    var paymentRate = Number(
      det.exchangeRate || 
      (order.exchangeRatesAtCreation && order.exchangeRatesAtCreation.USD ? order.exchangeRatesAtCreation.USD.rate : null) || 
      liveUsdRate
    );

    if (currency === "USD") {
      paidUsd += amount;
    } else if (currency === "Bs") {
      paidUsd += paymentRate > 0 ? (amount / paymentRate) : 0;
    }
  });

  var pending = orderTotal - paidUsd;
  if (pending > 0.01) {
    saVencidosUsd += pending;
    saVencidosCount++;
  }
});

// ==========================================================
// 7. PRODUCTOS POR FABRICAR
// ==========================================================
var productosPorFabricarRaw = db.orders.aggregate([
  {
    $match: {
      type: { $nin: ["Budget", "Reservation", "PendingConfirmation", "budget", "reservation"] },
      status: { $nin: ["Declinado", "Cancelado"] }
    }
  },
  { $unwind: "$products" },
  {
    $match: {
      $or: [
        { "products.manufacturingStatus": "por_fabricar" },
        { "products.manufacturingStatus": "debe_fabricar" },
        { "products.locationStatus": "FABRICACION" }
      ]
    }
  },
  {
    $group: {
      _id: null,
      totalUnidades: { $sum: { $ifNull: ["$products.quantity", 1] } }
    }
  }
]).toArray()[0] || { totalUnidades: 0 };

var productosPorFabricar = Number(productosPorFabricarRaw.totalUnidades || 0);

// ==========================================================
// 8. CONVERSIONES Y REPORTE FINAL EN CONSOLA
// ==========================================================
var totalFacturadoBs  = totalFacturadoUsd * liveUsdRate;
var totalCobradoBs    = totalCobradoUsd * liveUsdRate;
var abonosBs          = abonosPorRecaudarUsd * liveUsdRate;
var saBs              = saVencidosUsd * liveUsdRate;
var ticketPromedioUsd = cantVentas > 0 ? (totalFacturadoUsd / cantVentas) : 0;
var ticketPromedioBs  = ticketPromedioUsd * liveUsdRate;

print("1. Total Ventas (Generados): " + cantVentas);
print("2. Total Facturado:          $" + totalFacturadoUsd.toFixed(2) + " (Bs. " + totalFacturadoBs.toLocaleString('es-VE', {minimumFractionDigits: 2}) + ")");
print("3. Total Cobrado:            $" + totalCobradoUsd.toFixed(2) + " (Bs. " + totalCobradoBs.toLocaleString('es-VE', {minimumFractionDigits: 2}) + ")");
print("4. Ticket Promedio:          $" + ticketPromedioUsd.toFixed(2) + " (Bs. " + ticketPromedioBs.toLocaleString('es-VE', {minimumFractionDigits: 2}) + ")");
print("5. Abonos por Recaudar:      $" + abonosPorRecaudarUsd.toFixed(2) + " (Bs. " + abonosBs.toLocaleString('es-VE', {minimumFractionDigits: 2}) + ")");
print("6. SA Vencidos:              $" + saVencidosUsd.toFixed(2) + " (Bs. " + saBs.toLocaleString('es-VE', {minimumFractionDigits: 2}) + ") [" + saVencidosCount + " apartados]");
print("7. Productos por Fabricar:   " + productosPorFabricar);
print("\n==================================================\n");
```

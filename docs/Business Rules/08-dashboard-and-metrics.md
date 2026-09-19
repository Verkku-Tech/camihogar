# Reglas de Negocio: Métricas del Dashboard y Auditoría

**Módulo:** Inteligencia de Negocio, Reportes y Auditoría  
**Entidades Principales:** `Order`, `PartialPayment`, `ExchangeRate`, `OrderAuditLog`  
**Servicios de Aplicación:** `IReportService`, `ReportService`  

---

## 1. Definición Funcional y Matemática de las 7 Métricas Clave

El Dashboard de administración de Camihogar consolida en tiempo real la salud comercial, financiera y operativa del negocio a través de **7 indicadores clave de rendimiento (KPIs)** calculados directamente sobre MongoDB:

```
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│     1. TOTAL VENTAS     │  │   2. TOTAL FACTURADO    │  │    3. TOTAL COBRADO     │
│ Cantidad de pedidos     │  │ Monto total vendido     │  │ Ingresos reales en caja │
│ confirmados en período  │  │ en USD y contravalor Bs │  │ (abonos en USD y Bs)    │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│   4. TICKET PROMEDIO    │  │ 5. ABONOS POR RECAUDAR  │  │     6. SA VENCIDOS      │
│ Facturación total /     │  │ Saldo pendiente global  │  │ Apartados > 90 días con │
│ Número de pedidos       │  │ de órdenes activas      │  │ deuda pendiente         │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
                             ┌─────────────────────────┐
                             │ 7. PRODUCTOS A FABRICAR │
                             │ Unidades en taller o    │
                             │ pendientes por iniciar  │
                             └─────────────────────────┘
```

---

### 1. Total Ventas (Pedidos Generados)
- **Definición:** Cantidad de órdenes formales emitidas dentro del rango de fecha seleccionado (horario local UTC-4).
- **Filtros de Exclusión:**
  - Se descartan presupuestos (`type == "Budget"`), reservas temporales (`type == "Reservation"`) y códigos provisionales (`RES-`, `PCF-`).
  - Se descartan pedidos en estado `Declinado` o `Cancelado`.
- **Fórmula:**
  $$\text{Total Ventas} = \text{Count}(\text{Orders}_{\text{válidas}})$$

---

### 2. Total Facturado
- **Definición:** Volumen monetario total comprometido en ventas durante el período.
- **Fórmula:**
  $$\text{Total Facturado USD} = \sum \text{order.total}$$
  $$\text{Total Facturado Bs.} = \text{Total Facturado USD} \times \text{Tasa BCV del Día}$$
- **Criterio de Moneda:** Si bien cada pedido puede tener productos con precios unitarios diversos, el total de la orden en USD es la medida estándar de agregación.

---

### 3. Total Cobrado (Recaudación Real en Caja)
- **Definición:** Flujo de dinero efectivamente recibido en cuentas bancarias o en efectivo durante el período.
- **Diferenciación Clave:** No se basa en la fecha de creación del pedido, sino en la **fecha real del comprobante de pago** (`partialPayments.date` o `mixedPayments.date`).
- **Fórmula de Conversión:**
  Para cada pago recibido en el período:
  - Si se pagó en **USD**: suma directa del monto.
  - Si se pagó en **Bs.**: se convierte a USD dividiendo entre la tasa registrada en el comprobante (o tasa contractual de la orden).
  $$\text{Total Cobrado USD} = \sum \text{Pagos USD} + \sum \left(\frac{\text{Pagos Bs.}}{\text{Tasa de Pago}}\right)$$

---

### 4. Ticket Promedio
- **Definición:** Valor medio facturado por cada transacción de venta cerrada en el período.
- **Fórmula:**
  $$\text{Ticket Promedio USD} = \begin{cases} \frac{\text{Total Facturado USD}}{\text{Total Ventas}}, & \text{si Total Ventas} > 0 \\ 0, & \text{en otro caso} \end{cases}$$

---

### 5. Abonos por Recaudar (Cuentas por Cobrar Activas)
- **Definición:** Cartera viva de dinero pendiente de cobro de todos los pedidos históricos que aún no han sido finiquitados.
- **Filtro de Órdenes Elegibles:**
  - Órdenes comerciales (`type != "Budget"`, `type != "Reservation"`).
  - Órdenes no cerradas ni anuladas (`status` no está en `["Declinado", "Cancelado", "Entregado", "Completado"]`).
- **Fórmula:**
  $$\text{Abonos por Recaudar USD} = \sum_{\text{órdenes activas}} \left(\text{Total Pedido} - \text{Total Pagado Histórico}\right)$$

---

### 6. Sistemas de Apartado Vencidos (SA Vencidos)
- **Definición:** Monitoreo de riesgo crediticio para órdenes de Sistema de Apartado cuya antigüedad superó el límite comercial de 90 días y aún mantienen saldo deudor.
- **Condición Estricta:**
  $$\text{saleType} == \text{"sistema\_apartado"} \quad \land \quad \text{createdAt} < (\text{Hoy} - 90 \text{ días}) \quad \land \quad \text{Saldo Pendiente} > \$0.01$$
- **Métricas Reportadas:**
  - Monto total adeudado en USD y Bs.
  - Número de clientes/apartados en situación de vencimiento.

---

### 7. Productos por Fabricar
- **Definición:** Carga de trabajo pendiente en los talleres de manufactura.
- **Condición:** Suma de cantidades de todas las líneas de producto en órdenes no canceladas ni declinadas donde:
  - `manufacturingStatus == "por_fabricar"` $\lor$
  - `manufacturingStatus == "debe_fabricar"` $\lor$
  - `locationStatus == "FABRICACION"`

---

## 2. Pistas de Auditoría (*Order Audit Log*)

Para garantizar la no-repudiación y el control interno de operaciones comerciales, se registra un log inmutable en `OrderAuditLog` para los siguientes eventos críticos:
1. **Creación de Orden o Conversión de Presupuesto:** Usuario que generó el documento, cliente, fecha y monto inicial.
2. **Declinación de Pedido:** Documentación del usuario actuante y la **razón del declinado** (`declineReason`).
3. **Reversión de Declinación:** Justificación del levantamiento de la anulación.
4. **Registro o Anulación de Pagos:** Referencia bancaria, banco, monto y usuario responsable.
5. **Modificación de Etapas de Fabricación y Despacho:** Registro de artesano asignado o chofer en ruta.

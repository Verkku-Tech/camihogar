# Plan Maestro de Nuevos Requerimientos y Dashboard de BI Integral

**Fecha de Actualización:** 21 de Septiembre de 2026  
**Rama:** `feat/modular-monolith-refactor`  
**Objetivo:** Consolidar en una hoja de ruta única los requerimientos operativos de la reunión de producción (`docs/minuta.md`) y el sistema integral de Business Intelligence (BI) para la toma de decisiones gerenciales.

---

## 1. Tablero de Control de BI: Estado y Porcentajes de Avance

El Dashboard de Analítica Gerencial se estructura en 4 pilares bajo el estándar de Business Intelligence, Administración de Operaciones y Dirección Financiera:

### Pilar I: Eficiencia Comercial y Embudo de Ventas (Funnel)

| Ítem | Indicador / Métrica | Estado Actual | % Avance | Detalle / Lo que falta |
|---|---|:---:|:---:|---|
| **I.1** | **Facturación Total en Periodo** | Completado | **100%** | Suma en USD comercial con selector de periodo (Día/Semana/Mes/Año) y comparación contra periodo anterior. |
| **I.2** | **Cobranza Total Efectiva** | Completado | **100%** | Suma de abonos reales en divisas y Bs normalizados con tasa BCV/pedido. |
| **I.3** | **Tendencia y Proyección (Holt-Winters)** | Completado | **100%** | Gráfico de área con proyección predictiva fin de mes basada en suavizado exponencial triple. |
| **I.4** | **Top Productos y Variantes Reales** | Completado | **100%** | Donut de concentración Top 3 variantes completas con auditoría de pedidos reales certificables + desglose de atributos independientes. |
| **I.5** | **Mix por Tipo de Venta** | Completado | **100%** | Gráfico Donut (Showroom, WhatsApp, Web, etc.). |
| **I.6** | **Top Vendedores y Rendimiento** | Parcial | **80%** | Implementado volumen de venta y comisiones. Falta cruzar tasa de conversión individual. |
| **I.7** | **Ticket Promedio (AOV)** | Parcial | **75%** | Visible en KPIs globales. Falta desglose comparativo por sede (Guatire vs. Caracas). |
| **I.8** | **Win Rate: Conversión de Reservas a Pedidos** | Pendiente | **0%** | Ratio de reservas temporales convertidas a pedidos en firme vs. reservas expiradas/canceladas. |
| **I.9** | **Velocidad de Cierre (Lead-to-Order)** | Pendiente | **0%** | Días/horas promedio transcurridas desde la reserva hasta el pago inicial. |

---

### Pilar II: Operaciones y Cadena de Suministro (Fabricación y Logística)

| Ítem | Indicador / Métrica | Estado Actual | % Avance | Detalle / Lo que falta |
|---|---|:---:|:---:|---|
| **II.1** | **Distribución del Pipeline de Pedidos** | Completado | **90%** | Gráfico de barras horizontal con volumen de pedidos y montos por cada estado del flujo de trabajo. |
| **II.2** | **Tiempo de Ciclo de Fabricación (Lead Time)** | Pendiente | **0%** | Días promedio desde estatus *En Fabricación* hasta *Terminado en Almacén*, desglosado por categoría (Camas vs Closets vs Comedores). |
| **II.3** | **Cumplimiento de Fecha Pactada (OTIF)** | Pendiente | **0%** | % de despachos/entregas realizadas en o antes de la fecha prometida al cliente. |
| **II.4** | **Cuellos de Botella del Pipeline** | Pendiente | **0%** | Días promedio de permanencia por etapa (*Pendiente Validación $\rightarrow$ Fábrica $\rightarrow$ Almacén $\rightarrow$ Despacho*). |
| **II.5** | **Tasa de Despacho Inmediato vs Fabricación** | Pendiente | **0%** | Proporción de ventas atendidas con stock existente vs encargadas a taller. |

---

### Pilar III: Finanzas, Cobranza y Flujo de Caja

| Ítem | Indicador / Métrica | Estado Actual | % Avance | Detalle / Lo que falta |
|---|---|:---:|:---:|---|
| **III.1** | **Facturado vs. Cobrado por Intervalo** | Completado | **100%** | Gráfico comparativo de barras semanales para visualizar brecha de liquidez. |
| **III.2** | **Antigüedad de Saldos / Apartados Vencidos** | Completado | **85%** | Gráfico de barras por tramos (30, 60, 90+ días) para identificar capital estancado. |
| **III.3** | **Saldos Pendientes por Cobrar (Aging Pedidos)** | Parcial | **40%** | Existe en reportes planos; falta widget ejecutivo de pedidos listos para despacho sin liquidar. |
| **III.4** | **Mix de Medios de Pago y Exposición de Divisas** | Parcial | **30%** | Falta gráfico gerencial: % Efectivo Divisas vs Zelle vs Transferencias Bs (BCV). |

---

### Pilar IV: Inventario y Rendimiento de Stock (Disponibilidad Inmediata)

| Ítem | Indicador / Métrica | Estado Actual | % Avance | Detalle / Lo que falta |
|---|---|:---:|:---:|---|
| **IV.1** | **Rotación de Stock Terminado (Turnover)** | Pendiente | **0%** | Días promedio en almacén de productos terminados en Terrinca/Guatire. (Requiere Módulo de Inventario). |
| **IV.2** | **Tasa de Quiebre de Stock (Stockouts)** | Pendiente | **0%** | Consultas sin disponibilidad inmediata local. (Requiere Módulo de Inventario). |
| **IV.3** | **Capacidad y Ocupación Física en Tiendas** | Pendiente | **0%** | % de piezas en exhibición vs capacidad máxima física de cada local. |

---

## 2. Plan Maestro de Requerimientos Operativos (Minuta de Reunión)

| Módulo | Alcance Clave | Estado | % Avance | Dependencia con BI |
|---|---|:---:|:---:|---|
| **Módulo 1: Notificaciones y Alertas Web** | • Push de navegador + Centro in-app (campana)<br>• Alerta sonora en almacén/despacho<br>• Triggers automáticos: *Retiro por tienda*, *Retiro por almacén*, *Express* | En progreso | **45%** | El backend tiene SSE (`/api/notifications/stream`). Falta disparadores por estatus de pedido, audio y permisos push. |
| **Módulo 2: Inventario Inmediato y Reserva Temporal** | • Centralización de stock físico por sede (Terrinca y Guatire)<br>• Exclusión de depósito de socios Caracas<br>• Carga y actualización masiva Excel<br>• Reserva concurrente temporal con timeout (5-10 min) | Por iniciar | **10%** | Alimenta directamente los KPIs del **Pilar IV (Inventario)** y el **Win Rate de Reservas**. |
| **Módulo 3: Órdenes de Fabricación Interna (Fase 2)** | • Creación de órdenes de reposición para stock (Aarón)<br>• Separación total de ventas comerciales (no inflar ingresos) | Por iniciar | **0%** | Garantiza la integridad de las métricas de **Facturación** y **Lead Time de Fabricación**. |
| **Módulo 4: Catálogo Visual y Galería** | • Galería con etiquetas (modelo, tela, color)<br>• Prototipo exploratorio de renderizado de acabados | Por iniciar | **0%** | Apoyo a ventas para reducir tiempo de cierre. |
| **Módulo 5: Propuesta de Mantenimiento** | • Redacción de propuesta formal (Plan mensual vs Horas bajo demanda) | Por iniciar | **0%** | Tarea documental/comercial sin código. |

---

## 3. Resumen Consolidado del Avance Global del Dashboard

$$\text{Avance Ponderado del Dashboard de BI} \approx \mathbf{58\%}$$

- **Completado al 100%**: 7 componentes principales (Facturación, Cobranza, Holt-Winters, Top Productos + Variantes Reales completas, Mix Venta, Facturado vs Cobrado, Pipeline base).
- **En Progreso (30% - 85%)**: 4 componentes (Top Vendedores, Ticket Promedio por sede, Apartados vencidos, Saldos por cobrar).
- **Nuevos Requerimientos Pendientes (0%)**: Win Rate de Reservas, Lead Time de Fabricación, Cumplimiento OTIF, Cuellos de Botella y Rotación de Stock.

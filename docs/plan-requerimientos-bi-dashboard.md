# Plan Maestro Consolidado de Requerimientos y Dashboard de BI

**Fecha de Actualización:** 21 de Septiembre de 2026  
**Rama:** `feat/modular-monolith-refactor`  
**Objetivo:** Consolidar en una especificación y tabla única todos los requerimientos operativos de la minuta de reunión (`docs/minuta.md`) y el sistema integral de Business Intelligence (BI) para la toma de decisiones gerenciales, con sus porcentajes de avance, horas estimadas (ejecutadas y restantes) y definiciones arquitectónicas aprobadas.

---

## 1. Definiciones Arquitectónicas y Reglas de Negocio Aprobadas

### A. Deducción y Proximidad de Inventario (Cálculo Invisible en Segundo Plano)
1. **Retiro por tienda:** El stock se descuenta de forma directa de la **tienda física seleccionada** en el pedido.
2. **Retiro por almacén:** El stock se descuenta de forma directa del **almacén central seleccionado** (Terrinca).
3. **Despacho Express (Entrega a domicilio con Cálculo Invisible):**
   - **Sin Mapas en Pantalla:** El sistema no despliega componentes de mapas interactivos que ralenticen la interfaz ni exijan arrastrar pines al usuario.
   - **Cálculo de Proximidad en Segundo Plano:** A partir de la dirección/zona de entrega del cliente, el backend ejecuta el cálculo de distancia geográfica mediante la fórmula matemática de **Haversine** (0.001 ms, sin costos de APIs externas) contra las coordenadas lat/long registradas de las sedes que tengan stock físico real del producto.
   - **Sugerencia Automática:** Durante la generación del pedido o al momento de su despacho, el sistema sugiere automáticamente la sede óptima (tienda o almacén más cercano con stock), permitiendo al usuario confirmarla o ajustarla manualmente con un solo clic.

### B. Ciclo de Reserva Temporal y Prevención de Concurrencia
- **Atención en Mostrador / Mostrando Stock:** Al apartar un ítem en la pantalla interactiva de inventario, se genera un bloqueo efímero de **5 a 10 minutos** para que dos vendedores en distintas tiendas no vendan la misma pieza única en el mismo minuto.
- **Extensión a Reserva Formal:** Si el cliente decide apartar y se emite la orden de tipo *Reserva*, el bloqueo del producto en inventario se extiende automáticamente a **30 minutos** (o el plazo que establezca la política comercial).
- **Liberación Automática (Timeout):** Transcurrido el tiempo sin confirmación de pago o pedido, el ítem se libera automáticamente al inventario disponible.

### C. Alertas de Reposición, "Repesca" de Ventas y Roles de Usuario
- **Notificación de Salida (Almacén):** Cuando un producto sale de una tienda (por venta inmediata o express), el sistema emite una alerta web automática (SSE + campana in-app + alerta sonora) a los **Encargados de Almacén** para coordinar la reposición desde depósito central (Terrinca).
- **Notificación de "Repesca" de Presupuestos (Ventas Online / CRM):** Las órdenes en estatus *Reserva* operan como presupuestos acordados con los clientes. Cuando una reserva acumula **más de 30 días sin concretarse en venta real**, el sistema emite una notificación centralizada al equipo de **Ventas Online** para que puedan recontactar al cliente (vía WhatsApp / llamada) y rescatar la venta.
- **Nuevos Roles Operativos:**
  1. `Encargado de Inventario`: Visión y validación global del stock físico en tiendas y almacenes.
  2. `Encargado de Almacén`: Visión de depósito central, control de existencia física, carga masiva/manual y recepción de alertas de reposición.
  3. `Vendedor Online`: Gestión de pedidos digitales, reservas web y recepción de alertas de repesca.

### D. Catálogo Visual, Almacenamiento de Fotos Reales y Simulador Interactivo
1. **Alojamiento y Almacenamiento Propio en el Sistema:**
   - Módulo de subida de fotos (upload multipart) con compresión automática a formato WebP optimizado para web.
   - Almacenamiento local persistente (`/uploads/gallery/` o CDN) con etiquetado por producto, modelo, tela, color y tamaño.
2. **Fase Inicial (Opción 2 - Swatch Picker + Galería de Taller):**
   - **Selectores Swatch:** Muestras macro de texturas y colores reales de telas.
   - **Galería de Fotos Reales:** Accesible tanto desde la **web pública** (al configurar la cama/producto) como desde la **pantalla de inventario del vendedor**, permitiendo filtrar y mostrar fotos de camas reales terminadas en taller con esa combinación exacta.
3. **Fase Avanzada (Opción 1 - Simulador Interactivo Canvas/CSS):**
   - Motor de previsualización en tiempo real sobre la foto base del producto mediante capas de fusión y máscaras de tapizado.
   - **Convivencia:** El cliente y vendedor tendrán ambas herramientas: el simulador interactivo para ver el cambio instantáneo y la pestaña de fotos reales para validar el acabado real del producto.

### E. Inteligencia de Reposición en BI
- El módulo de BI cruzará el inventario actual de cada tienda/almacén contra el **ranking de variantes más vendidas (Top 3 completas) y menos vendidas** para generar sugerencias automáticas de fabricación y reposición prioritaria.

---

## 2. Tabla Única Consolidada: Requerimientos, BI, Estado y Horas

| # | Módulo / Área | Requerimiento / Actividad | Origen | Estado | % Avance | Horas Est. | Horas Ejec. | Horas Rest. |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **1** | **Notificaciones Web** | Servicio base de SSE y streaming en backend (`/api/notifications/stream`) | Minuta (A) | Completado | **100%** | 6 h | 6 h | 0 h |
| **2** | **Notificaciones Web** | Centro de notificaciones in-app (icono campana, contador no leídas, dropdown) | Minuta (A) | En progreso | **60%** | 8 h | 5 h | 3 h |
| **3** | **Notificaciones Web** | Sistema de alertas sonoras en navegador para personal de almacén/coordinación | Minuta (A) | Pendiente | **0%** | 4 h | 0 h | 4 h |
| **4** | **Notificaciones Web** | Disparo automático de alertas al cambiar a: *Retiro tienda*, *Retiro almacén*, *Express* | Minuta (A) | Pendiente | **0%** | 6 h | 0 h | 6 h |
| **5** | **Inventario Inmediato** | CRUD de Almacenes y Tiendas con configuración de manejo de stock, topes de exhibición y costo de fabricación | Minuta (B) / Alineación | Pendiente | **0%** | 14 h | 0 h | 14 h |
| **6** | **Inventario Inmediato** | Carga masiva (Excel) y registro individual manual de productos/variantes en almacén y tienda | Minuta (B) / Alineación | Pendiente | **0%** | 12 h | 0 h | 12 h |
| **7** | **Inventario Inmediato** | Pantalla interactiva de consulta de stock con galería fotográfica real integrada para vendedores | Minuta (B) / Alineación | Pendiente | **0%** | 14 h | 0 h | 14 h |
| **8** | **Inventario Inmediato** | Reserva temporal en atención (5-10 min) y extensión automática a 30 min al formalizar Reserva | Minuta (B/Nota 1) | Pendiente | **0%** | 16 h | 0 h | 16 h |
| **9** | **Inventario Inmediato** | Descuento y sugerencia de stock por proximidad invisible (Cálculo Haversine en backend C# sin mapas) | Minuta (B) / Alineación | Pendiente | **0%** | 14 h | 0 h | 14 h |
| **10** | **Notificaciones Stock** | Alerta automática a Encargados de Almacén cuando sale un producto de tienda para reposición | Alineación Stock | Pendiente | **0%** | 6 h | 0 h | 6 h |
| **11** | **Seguridad & Roles** | Nuevos roles: `Encargado de Inventario` (tiendas + almacén) y `Encargado de Almacén` (depósitos) | Alineación Stock | Pendiente | **0%** | 6 h | 0 h | 6 h |
| **12** | **Fabricación Interna** | Flujo de registro de órdenes de reposición para stock/exhibición (Aarón) | Minuta (C) | Pendiente | **0%** | 12 h | 0 h | 12 h |
| **13** | **Fabricación Interna** | Aislamiento contable/financiero de reposiciones (excluir de ventas para no inflar ingresos) | Minuta (C/Regla 3) | Pendiente | **0%** | 6 h | 0 h | 6 h |
| **14** | **Catálogo Visual** | Servicio backend de alojamiento y almacenamiento de fotos reales (upload, optimización WebP, etiquetado) | Minuta (D) / Alineación | Pendiente | **0%** | 14 h | 0 h | 14 h |
| **15** | **Catálogo Visual** | Fase 1: Swatch Picker de telas/colores y visor de fotos reales de taller (en catálogo web e inventario) | Minuta (D) / Alineación | Pendiente | **0%** | 14 h | 0 h | 14 h |
| **16** | **Catálogo Visual** | Fase 2: Simulador interactivo por capas (Canvas 2D/CSS multiply sobre fotos base de modelos) | Minuta (D) / Alineación | Pendiente | **0%** | 18 h | 0 h | 18 h |
| **17** | **BI: Ventas & Funnel** | Facturación Total en USD con selectores temporales (Día/Semana/Mes/Año) y comparativa | BI Dashboard | Completado | **100%** | 6 h | 6 h | 0 h |
| **18** | **BI: Ventas & Funnel** | Cobranza Total Efectiva con conversión multicurrency (USD y Bs BCV/pedido) | BI Dashboard | Completado | **100%** | 6 h | 6 h | 0 h |
| **19** | **BI: Ventas & Funnel** | Tendencia y Proyección predictiva fin de mes con suavizado triple Holt-Winters | BI Dashboard | Completado | **100%** | 14 h | 14 h | 0 h |
| **20** | **BI: Ventas & Funnel** | Top Productos y Concentración de Top 3 Variantes Reales completas con auditoría de pedidos | BI Dashboard | Completado | **100%** | 18 h | 18 h | 0 h |
| **21** | **BI: Ventas & Funnel** | Distribución y gráfico Donut por Tipo de Venta (Showroom, WhatsApp, etc.) | BI Dashboard | Completado | **100%** | 6 h | 6 h | 0 h |
| **22** | **BI: Ventas & Funnel** | Top Vendedores con volumen de ventas, comisiones y ranking | BI Dashboard | En progreso | **80%** | 8 h | 6.5 h | 1.5 h |
| **23** | **BI: Ventas & Funnel** | Ticket Promedio (AOV) global y desglose comparativo por sede (Guatire vs Caracas) | BI Dashboard | En progreso | **75%** | 6 h | 4.5 h | 1.5 h |
| **24** | **BI: Ventas & Funnel** | Win Rate: Tasa de Conversión de Reservas a Pedidos formalizados | BI Dashboard | Pendiente | **0%** | 8 h | 0 h | 8 h |
| **25** | **BI: Ventas & Funnel** | Velocidad de Cierre (Lead-to-Order Time): Tiempo promedio desde reserva hasta primer pago | BI Dashboard | Pendiente | **0%** | 6 h | 0 h | 6 h |
| **26** | **BI: Operaciones** | Pipeline de Estados de Pedidos con volumen y monto por etapa | BI Dashboard | Completado | **90%** | 8 h | 7 h | 1 h |
| **27** | **BI: Operaciones** | Manufacturing Lead Time: Tiempo de fabricación promedio por categoría (Camas vs Closets vs Comedores) | BI Dashboard | Pendiente | **0%** | 10 h | 0 h | 10 h |
| **28** | **BI: Operaciones** | OTIF: Cumplimiento de Fecha de Entrega pactada vs fecha real | BI Dashboard | Pendiente | **0%** | 8 h | 0 h | 8 h |
| **29** | **BI: Operaciones** | Cuellos de Botella: Tiempo medio de permanencia por etapa del pedido | BI Dashboard | Pendiente | **0%** | 8 h | 0 h | 8 h |
| **30** | **BI: Operaciones** | Tasa de Despacho Inmediato vs Fabricación bajo pedido | BI Dashboard | Pendiente | **0%** | 6 h | 0 h | 6 h |
| **31** | **BI: Finanzas** | Facturado vs Cobrado por intervalos semanales para análisis de liquidez | BI Dashboard | Completado | **100%** | 8 h | 8 h | 0 h |
| **32** | **BI: Finanzas** | Antigüedad de Apartados Vencidos por tramos (30, 60, 90+ días) | BI Dashboard | Completado | **85%** | 8 h | 7 h | 1 h |
| **33** | **BI: Finanzas** | Saldos Pendientes por Cobrar (Aging de pedidos terminados no liquidados) | BI Dashboard | En progreso | **40%** | 6 h | 2.5 h | 3.5 h |
| **34** | **BI: Finanzas** | Mix de Medios de Pago y Exposición de Divisas (% Efectivo USD vs Zelle vs Transferencias Bs) | BI Dashboard | En progreso | **30%** | 6 h | 2 h | 4 h |
| **35** | **BI: Inventario** | BI: Recomendaciones inteligentes de reposición según variantes más y menos vendidas | Alineación Stock | Pendiente | **0%** | 10 h | 0 h | 10 h |
| **36** | **BI: Inventario** | Rotación de Stock Terminado (Días de permanencia en Terrinca/Guatire) | BI Dashboard | Pendiente | **0%** | 8 h | 0 h | 8 h |
| **37** | **BI: Inventario** | Tasa de Quiebre de Stock (Stockouts por consultas sin disponibilidad local) | BI Dashboard | Pendiente | **0%** | 6 h | 0 h | 6 h |
| **38** | **BI: Inventario** | Ocupación Física de Tiendas (% piezas exhibidas vs tope físico de tienda) | BI Dashboard | Pendiente | **0%** | 6 h | 0 h | 6 h |
| **TOTALES** | **Todas las áreas** | **38 requerimientos consolidados** | — | — | **~33% Global** | **322 h** | **104.5 h** | **217.5 h** |

---

## 3. Resumen Ejecutivo de Horas
- **Total Horas Estimadas:** **322 horas**.
- **Horas ya Ejecutadas:** **104.5 horas** (~33% global; ~58% en el Dashboard actual).
- **Horas Restantes por Desarrollar:** **217.5 horas**.

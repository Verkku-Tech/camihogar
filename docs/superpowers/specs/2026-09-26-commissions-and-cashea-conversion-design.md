# Design Spec: Reporte de Comisiones 1:1 con Main y Corrección de Conversión Cashea

## 1. Contexto y Objetivos
1. **Reporte de Comisiones:** En el monolito modular, el reporte de comisiones (`/reportes/comisiones`) tenía una implementación de prueba (3% plano) con 7 columnas que no correspondía con las reglas de negocio de Camihogar. Se requiere portar la lógica 1:1 desde `main`, incluyendo tiers de tipo de venta ($2.5, $5.0, $7.5 USD/u), comisión por familia/categoría, exclusividad del vendedor (exclusivo, exclusivo con referido, compartido) y el archivo Excel oficial de 12 columnas.
2. **Error en Conversión de Reserva con Cashea:** Al convertir una reserva a pedido con condición Cashea y pago inicial en bolívares (p. ej. Pago Móvil por Bs. 55.671,10 ~ $64.96 en una orden de $324.80), la aplicación arrojaba:
   `Cashea: la suma de cobros en tienda supera el total a cubrir.`
   - La causa raíz identificada: la reserva carecía de tasas congeladas (`exchangeRatesAtCreation`), por lo que `usdRate` quedaba `undefined`. Al fallar la ruta USD, el sistema caía en la comparación legacy comparando la suma en bolívares (`55.671,10`) contra el total en dólares (`324.80`), concluyendo erróneamente que el abono superaba el total.
   - Además, el diálogo capturaba el error mostrando un toast genérico ("Error al actualizar el pedido"), ocultando el mensaje real de error.

## 2. Solución Técnica

### Componente A: Motor de Comisiones (Backend)
1. **Módulos de Comisión:** Crear `Ordina.Application.Commission`:
   - `CommissionLineSources.cs`: Constantes de fuentes de línea (`reservation_unchanged`, `store_modified`, `store_added`, `store_substitution`).
   - `SaleTypeCommissionTierResolver.cs`: Resolución de tier ($2.5, $5.0, $7.5 USD/u) y selección de regla `SaleTypeCommissionRule`.
   - `CommissionExclusivityCalculator.cs`: Distribución de montos entre vendedor principal, referido y postventa según modo de exclusividad y reglas de venta.
   - `CommissionLineClassifier.cs`: Clasificación de líneas de pedido al confirmar/modificar reservas.
2. **DTOs:** Actualizar `CommissionReportRowDto` en `Ordina.Application.Reports` con las 21 propiedades estándar de `main` (`Fecha`, `Cliente`, `Vendedor`, `Pedido`, `Descripcion`, `CantidadArticulos`, `TipoVenta`, `ComisionFamiliaUsdPorUnidad`, `Comision`, `VendedorSecundario`, `ComisionSecundaria`, `VendedorPostventa`, `ComisionPostventa`, `SueldoBase`, `TotalComisionMasSueldo`, `TasaComisionBase`, `TasaAplicadaVendedor`, `TasaAplicadaReferido`, `TasaAplicadaPostventa`, `EsVentaCompartida`, `EsVendedorExclusivo`).
3. **Servicio de Reportes (`ReportService.cs`):**
   - Implementar `GetCommissionReportAsync` con filtros de rango de fechas (normalizadas a inicio/fin de día), vendedor, tienda, tipo de vendedor y referido.
   - Omitir reservas, pedidos cancelados/declinados y pedidos `pago_a_entrega` sin cobro registrado.
   - Calcular comisiones por producto resolviendo contexto de línea y categoría en `productCommissions`.
   - Formatear descripción del producto con atributos.
   - Exportar Excel con las 12 columnas oficiales usando `ExcelReportBuilder`.
4. **Controlador (`ReportsController.cs`):**
   - Aceptar parámetros `storeId`, `sellerType`, `referrerId` en los endpoints de preview y descarga Excel.
   - Implementar `commissions/referrers` para llenar el filtro dinámico de referidos en el rango.

### Componente B: Validación Cashea y Transparencia de Errores (Frontend)
1. **Transparencia en Toasts:** En `edit-order-dialog.tsx`, `confirm-order-dialog.tsx` y `new-order-dialog.tsx`, mostrar `error instanceof Error ? error.message : "..."` en los toasts de error.
2. **Normalización de Tasas:**
   - En `currency-utils.ts` (`normalizeExchangeRatesAtCreation`): si `usd.rate` es un número positivo válido, no descartarlo si falta `effectiveDate` (proveer fallback con fecha actual).
3. **Resolución Robusta de Tasa USD para Cashea:**
   - En `use-edit-order-form.tsx` y `confirm-order-dialog.tsx`: si la orden/reserva no tiene tasas comerciales congeladas, usar automáticamente las tasas activas (`liveExchangeRates`).
   - En `order-payments.ts` (`buildCasheaPaymentsForSave`, `getCasheaTotalDueBs`, `casheaInStorePaymentsExceedTotal`):
     - Resolver `usdRate` con cadena de fallbacks: parámetro `usdRate` -> `order.liveRates` -> `order.exchangeRatesAtCreation` -> tasa registrada en los cobros de tienda (`payment.paymentDetails.exchangeRate`).
     - Si la orden es en base USD (`useUsdTotals: true`), jamás comparar directamente montos en Bs contra el total en USD; garantizar que la conversión se aplique siempre.

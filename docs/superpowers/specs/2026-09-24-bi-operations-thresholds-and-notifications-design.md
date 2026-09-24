# Especificación de Diseño: Umbrales de Métricas de Operaciones BI y Gestión de Notificaciones

**Fecha:** 2026-09-24  
**Rama:** `feat/modular-monolith-refactor`  
**Estado:** Aprobado  

---

## 1. Resumen Ejecutivo
Permitir a los usuarios administradores personalizar los umbrales estándar y tolerancias de desvío para las 4 métricas del componente `OperationsMetricsCard`:
1. **Lead Time Taller** (por categoría de producto).
2. **Cumplimiento OTIF** (% de efectividad a tiempo y completo).
3. **Permanencia por Etapa** (días máximos por cuello de botella).
4. **Abastecimiento** (ratio de entrega por stock inmediato vs fabricación a medida).

Las barras y valores reflejan reactivamente los colores estándar:
- 🟢 **Verde**: Por debajo del estándar (óptimo).
- 🔵 **Azul**: En rango estándar.
- 🟠 **Naranja**: Por encima del estándar (+30% de tolerancia por defecto - advertencia).
- 🔴 **Rojo**: Muy por encima del estándar (+50% de tolerancia por defecto - crítico).

Asimismo, el sistema incorpora un worker en segundo plano para notificar automáticamente a los administradores cada lunes a las 9:00 AM (parametrizable) en caso de detectar métricas fuera de rango, y centraliza el control de todas las alertas del sistema en una nueva pantalla `/configuracion/notificaciones`.

---

## 2. Arquitectura de Backend (`Ordina.Backend`)

### 2.1 Entidad de Dominio: `OperationsMetricsSettings`
Ubicada en `Ordina.Domain/Analytics/OperationsMetricsSettings.cs`, hereda de `BaseEntity`.

- **Colección MongoDB:** `operations_metrics_settings`
- **ID:** `"default"` (registro singleton por tenant/organización)
- **Estructura:**
  - `DefaultLeadTime`: `LeadTimeCategoryThreshold` con `MinStandardDays = 5`, `MaxStandardDays = 7`, `WarningExtraPercentage = 30`, `CriticalExtraPercentage = 50`.
  - `CategoryLeadTimes`: `Dictionary<string, LeadTimeCategoryThreshold>` para `"Cama"`, `"Box solo"`, `"Colchones"`, `"Mueble"`, `"Copete solo"`, `"ComboHogar"`.
  - `Otif`: `OtifThreshold` con `TargetPercentage = 95`, `WarningPercentage = 90`, `CriticalPercentage = 80`.
  - `StageMaxStandardDays`: `Dictionary<string, double>` para `"Aprobación / Pago"`, `"Cola Taller / Fabricación"`, `"Almacén Central (Terrinca)"`, `"Ruta y Despacho"`.
  - `Fulfillment`: `FulfillmentThreshold` con `TargetImmediatePercentage = 60`, `WarningImmediatePercentage = 50`, `CriticalImmediatePercentage = 40`.
  - `LastAlertSentUtc`: `DateTime?` para evitar reenvío duplicado en la misma semana.

### 2.2 Entidad y Gestión de Reglas de Notificaciones: `NotificationRuleSettings`
Ubicada en `Ordina.Domain/Notifications/NotificationRuleSettings.cs`, hereda de `BaseEntity`.

- **Colección MongoDB:** `notification_settings`
- **Estructura:**
  - **Programación de Métricas BI:**
    - `BiAlertsEnabled`: `bool` (true)
    - `BiFrequency`: `"Weekly"` | `"Daily"`
    - `BiDayOfWeek`: `DayOfWeek.Monday`
    - `BiHourOfDay`: `9` (9:00 AM)
    - `BiTargetRoles`: `["Administrator", "Super Administrator"]`
  - **Reglas Operativas:**
    - `ManufacturingDelay`: `bool Enabled = true`, `int ThresholdDays = 25`, `List<string> TargetRoles`
    - `ReservationExpiring`: `bool Enabled = true`, `int ThresholdDays = 30`, `List<string> TargetRoles`
  - **Reglas de Sistema:**
    - `EmergencyPinUsed`: `bool Enabled = true`
    - `ExchangeRateChanged`: `bool Enabled = true`
    - `SyncConflict`: `bool Enabled = true`
  - **Preferencias:**
    - `SoundEnabled`: `bool Enabled = true`

### 2.3 Endpoints API
Ubicados en `Ordina.Api/Controllers/OperationsMetricsSettingsController.cs` y `NotificationSettingsController.cs`:
- `GET /api/operations-metrics/settings`: Obtiene umbrales actuales o crea los defaults.
- `PUT /api/operations-metrics/settings`: Actualiza los umbrales de métricas operativas.
- `GET /api/notifications/settings`: Obtiene las reglas y programación de notificaciones.
- `PUT /api/notifications/settings`: Actualiza las reglas y programación de notificaciones.
- `POST /api/notifications/test-alert`: Dispara una alerta de prueba inmediata a los roles administradores.

### 2.4 Worker de Fondo: `OperationsMetricsAlertWorker`
Ubicado en `Ordina.Infrastructure/BackgroundServices/OperationsMetricsAlertWorker.cs`:
- Despierta cada 15 minutos.
- Si `BiAlertsEnabled == true` y coincide el día y hora configurados (ej. Lunes >= 9:00 AM hora Venezuela UTC-4) y no se ha emitido alerta en los últimos 6 días:
  - Invoca `IDashboardService` para obtener los promedios del mes.
  - Evalúa cada métrica contra sus umbrales.
  - Si hay desvíos en Naranja o Rojo, invoca `INotificationService.PublishAsync`:
    - `Type`: `"OperationsMetricsAlert"`
    - `Title`: `"Reporte Semanal: Métricas Operativas Fuera de Rango"`
    - `Severity`: `"error"` (si hay desvío rojo) o `"warning"` (si solo naranja).
    - `Link`: `"/dashboard"`
  - Actualiza `LastAlertSentUtc = DateTime.UtcNow`.

### 2.5 Actualización en `DelayedOrdersNotifierWorker` y `NotificationService`
- `DelayedOrdersNotifierWorker` consulta `NotificationRuleSettings` para usar los días configurados dinámicamente en lugar de `25` y `30` fijos.
- `NotificationService.PublishAsync` valida si el tipo de notificación entrante está activo en `NotificationRuleSettings` antes de persistir y propagar a SSE.

---

## 3. Arquitectura de Frontend (`Ordina.Frontend`)

### 3.1 Modal de Umbrales en `OperationsMetricsCard`
- **Ubicación:** `src/components/analytics/operations-threshold-dialog.tsx`.
- **Gatillo:** Botón con icono `<Settings2 />` en la cabecera de `OperationsMetricsCard`.
- **Estructura en Pestañas:**
  1. *Lead Time Taller*: Selectores de días mínimos y máximos por categoría + tolerancias % con barra preview.
  2. *Cumplimiento OTIF*: Meta %, umbral advertencia y crítico.
  3. *Permanencia x Etapa*: Días máximos tolerados por etapa.
  4. *Abastecimiento*: % meta de entrega de stock inmediato.
- **Feedback:** Guardado vía `apiClient.updateOperationsMetricsSettings` con mensaje de éxito mediante `sonner` (`toast.success`).

### 3.2 Utilidad de Colores Dinámicos
- **Ubicación:** `src/lib/metrics-thresholds.ts`:
  - `getLeadTimeColor(days, threshold)` $\rightarrow$ clase de color y badge label (Verde, Azul, Naranja, Rojo).
  - `getOtifColor(rate, threshold)` $\rightarrow$ clase de color.
  - `getDwellTimeColor(days, maxStandard)` $\rightarrow$ clase de color.
  - `getFulfillmentColor(immediateRate, threshold)` $\rightarrow$ clase de color.

### 3.3 Nueva Pantalla `/configuracion/notificaciones`
- **Ubicación:** `src/app/configuracion/notificaciones/page.tsx`.
- **Ruta:** Agregada en `App.tsx` y en el menú de navegación de `sidebar.tsx` bajo Configuración.
- **Secciones:**
  1. **Alertas de Métricas BI**: Toggle On/Off, frecuencia (Semanal), día (Lunes), hora (09:00 AM), selector de roles.
  2. **Reglas Operativas**: Toggles y días de tolerancia para `ManufacturingDelay` y `ReservationExpiring`.
  3. **Alertas del Sistema**: Toggles para `EmergencyPinUsed`, `ExchangeRateChanged`, `SyncConflict`.
  4. **Preferencias y Acciones**: Toggle de sonido y botón *"Enviar Alerta de Prueba Ahora"*.

---

## 4. Estrategia de Pruebas (TDD) y Verificación

1. **Backend Unit Tests**:
   - `OperationsMetricsSettingsControllerTests`: Valida obtención y actualización de umbrales con autorización.
   - `OperationsMetricsAlertWorkerTests`: Valida evaluación correcta de rangos (verde, azul, naranja, rojo) y disparo único semanal.
   - `NotificationSettingsTests`: Valida que `PublishAsync` descarte notificaciones cuando su switch esté deshabilitado.
2. **Frontend Unit Tests**:
   - `metrics-thresholds.test.ts`: Pruebas de cálculo de rangos con los 4 colores para todas las métricas.
   - `operations-metrics-card.test.tsx`: Verifica que el botón abra el modal y que los colores cambien reactivamente.
3. **Verificación Manual e Integrada**:
   - `npm run test` / `dotnet test`.
   - Navegación al dashboard para probar el modal de configuración de umbrales y verificar los colores dinámicos.
   - Navegación a `/configuracion/notificaciones` para verificar la persistencia de reglas y el botón de prueba.

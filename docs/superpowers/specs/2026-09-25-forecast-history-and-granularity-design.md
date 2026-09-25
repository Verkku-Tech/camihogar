# Especificación de Diseño: Historial de Proyecciones de Venta y Granularidad Semanal/Diaria

## 1. Contexto y Objetivos
El dashboard de analítica cuenta actualmente con proyecciones mensuales y anuales basadas en el modelo Holt-Winters amortiguado. Se requiere:
1. **Historial y Versionado de Proyecciones**: Persistir cada proyección calculada en MongoDB (`sales_projections`) con versión incremental ("Proyección 1", "Proyección 2", etc.) y rango temporal.
2. **Idempotencia Diaria**:
   - Si no hay cambios en los valores proyectados para el mismo día y período, no se genera una nueva versión; solo se actualizan los valores reales transcurridos (`actualInvoiced`, `actualCollected`).
   - Si las proyecciones cambian respecto a la versión anterior, se genera una nueva proyección (`Proyecciones nuevas = Gráficas nuevas`).
3. **Modal de Historial y Detalle**:
   - Listar proyecciones guardadas con su rango y resumen.
   - Al seleccionar una proyección, expandir/cambiar de vista dentro del modal para visualizar la gráfica histórica snapshot.
4. **Modo Semanal (`week`) con Carrusel**:
   - Gráfica de 7 días (Lunes a Domingo).
   - Carrusel para navegar entre la semana actual (`weekOffset = 0`) y hasta 3 semanas siguientes (`weekOffset = 1, 2, 3`).
5. **Modo Diario (`day`) de 24 Horas**:
   - Granularidad de 24 horas (00:00 a 23:00) combinando horas transcurridas (ventas reales) con horas restantes proyectadas mediante el perfil horario histórico (últimos 90 días).

---

## 2. Modelo de Datos y Persistencia

### Entidad `SalesForecastRecord`
Colección MongoDB: `sales_projections`
Archivo: `Ordina.Backend/src/Domain/Dashboard/SalesForecastRecord.cs`

```csharp
public class SalesForecastRecord : BaseEntity
{
    [BsonElement("versionNumber")]
    public int VersionNumber { get; set; }

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty; // "Proyección 2 - 02/09 al 30/09"

    [BsonElement("period")]
    public string Period { get; set; } = "month"; // "day", "week", "month", "year"

    [BsonElement("weekOffset")]
    public int WeekOffset { get; set; } = 0;

    [BsonElement("startDate")]
    public DateTime StartDate { get; set; }

    [BsonElement("endDate")]
    public DateTime EndDate { get; set; }

    [BsonElement("projectionsHash")]
    public string ProjectionsHash { get; set; } = string.Empty;

    [BsonElement("points")]
    public List<ForecastDataPointDto> Points { get; set; } = new();

    [BsonElement("summary")]
    public ForecastSummaryDto Summary { get; set; } = null!;
}
```

### Reglas de Idempotencia y Guardado
1. Hash SHA256 generado sobre la secuencia: `string.Join("|", points.Select(p => $"{p.ProjectedInvoiced}:{p.ProjectedCollected}"))`.
2. Búsqueda por `Period`, `WeekOffset` y ventana de fechas.
3. Si existe y el hash es idéntico: Actualizar `Points` (los campos `ActualInvoiced` y `ActualCollected`), `Summary` y `UpdatedAt`.
4. Si no existe o el hash es diferente: Incrementar `versionNumber = (maxVersion en el sistema) + 1`, generar título descriptivo e insertar nuevo documento.

---

## 3. Motores de Cálculo

### 3.1 Modo Semanal con Carrusel (`week`, `weekOffset: 0..3`)
- **Rango**: Lunes `00:00` a Domingo `23:59:59` de la semana `SemanaActual + weekOffset`.
- **weekOffset = 0**:
  - Días ya ocurridos: `ActualInvoiced` y `ActualCollected` reales.
  - Días de hoy en adelante: Proyectados mediante Holt-Winters con estacionalidad semanal.
- **weekOffset = 1, 2, 3**:
  - Horizonte extendido de predicción (pasos 8..14 para sem +1, 15..21 para sem +2, 22..28 para sem +3).
  - Valores reales en `null`, 100% valores proyectados.

### 3.2 Modo Diario por Horas (`day`)
- **Rango**: 24 puntos (`00:00` a `23:00` hora local de Venezuela).
- **Horas pasadas ($h < \text{horaActual}$)**: Suma real de facturación y cobranza en esa hora hoy.
- **Horas futuras ($h \ge \text{horaActual}$)**:
  - Distribución porcentual $W_h$ de los últimos 90 días para el mismo día de la semana.
  - $\text{ProyFact}_h = \text{MetaDiaria} \times W_h$.
  - $\text{ProyCobro}_h = \text{ProyFact}_h \times \text{CollectionRate}$.

---

## 4. Contrato de API

### Nuevos Endpoints en `DashboardController`
1. `GET /api/dashboard/forecast?period={day|week|month|year}&weekOffset={0..3}`
   - Retorna: `SalesForecastResponseDto` (calcula y aplica idempotencia/guardado).
2. `GET /api/dashboard/forecast/history?period={period}`
   - Retorna: `IReadOnlyList<SalesForecastHistoryItemDto>` ordenado por `CreatedAt` descendente.
3. `GET /api/dashboard/forecast/history/{id}`
   - Retorna: `SalesForecastRecordDto` con puntos y resumen completo de la proyección guardada.

---

## 5. Frontend y Componentes UI

1. **`api-client.ts`**:
   - `getSalesForecast(period, weekOffset, signal)`
   - `getSalesForecastHistory(period, signal)`
   - `getSalesForecastHistoryById(id, signal)`
2. **`TrendChart.tsx`**:
   - Si `period === "week"`: Control de carrusel `<` `Semana Actual (22/09 - 28/09)` `>` (desplazamiento 0 a 3).
   - Si `period === "day"`: Eje X con franjas horarias 00:00 - 23:00.
   - Botón `[ Historial ]` en el CardHeader para abrir `ForecastHistoryModal`.
3. **`ForecastHistoryModal.tsx`**:
   - Vista 1: Listado de proyecciones con título (`Proyección 2 - 02/09 al 30/09`), fecha de guardado y badges de totales.
   - Vista 2: Detalle interactivo con botón de regreso `← Volver` y renderizado de la gráfica histórica snapshot.

---

## 6. Pruebas y Criterios de Aceptación
1. Test unitario de idempotencia: Segunda llamada con mismas proyecciones actualiza datos reales sin crear nuevo registro.
2. Test unitario de versionado: Llamada con proyecciones alteradas genera una nueva versión incrementada.
3. Test unitario de cálculo semanal (`weekOffset = 0` y `weekOffset = 1..3`).
4. Test unitario de cálculo horario (24 puntos de `00:00` a `23:00`).
5. Verificación visual y funcional en el navegador del carrusel semanal y el modal de historial/detalle.

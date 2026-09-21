# Design Document: Desglose de Versiones y Atributos para Top Productos Más Vendidos

- **Fecha**: 2026-09-21
- **Módulo**: Dashboard de Métricas / Analítica (`Ordina.Backend` & `Ordina.Frontend`)
- **Estado**: Aprobado por el usuario

---

## 1. Contexto y Objetivos

En el dashboard de analítica (`/dashboard`), la tabla de **Top Productos Más Vendidos** (`TopProductsTable`) muestra el ranking general de productos ordenados por volumen de ventas y facturación.
Sin embargo, para productos configurables que pertenecen a categorías con múltiples atributos (por ejemplo, "Cama Matrimonial" con atributos como "Copete", "Box", "Tela", "Color"), los usuarios administradores necesitan conocer en detalle qué variantes u opciones específicas son las más vendidas dentro del período seleccionado.

### Objetivos Principales:
1. **Detección Dinámica de Atributos**: Indicar en la tabla de top productos si el producto/categoría posee atributos personalizables (`HasAttributes`).
2. **Interactividad Condicional**: Permitir click únicamente en los registros de productos que posean atributos. Para productos estándar sin atributos (colchones, closets simples), la fila se mantiene estática.
3. **Cálculo Eficiente en Backend**: Proveer un endpoint bajo demanda (`GET /api/dashboard/top-products/attribute-breakdown`) que compute la distribución y ranking de cada atributo según las órdenes del período.
4. **Modal de Métricas Detalladas**: Desplegar un modal con tarjetas/secciones por atributo, ordenando las opciones de mayor a menor según unidades vendidas, acompañadas de barras de progreso y porcentajes.

---

## 2. Arquitectura y Modelos (Backend)

### 2.1 DTOs (`Ordina.Application.Dashboard`)

```csharp
public record TopProductDto(
    string ProductName,
    string Category,
    int UnitsSold,
    decimal TotalUsd,
    bool HasAttributes = false);

public record AttributeOptionStatDto(
    string Value,
    int UnitsSold,
    decimal Percentage);

public record AttributeBreakdownDto(
    string AttributeId,
    string AttributeTitle,
    int TotalUnitsWithAttribute,
    IReadOnlyList<AttributeOptionStatDto> Options);

public record ProductAttributeBreakdownResponseDto(
    string ProductName,
    string Category,
    int TotalUnitsSold,
    IReadOnlyList<AttributeBreakdownDto> Attributes);
```

### 2.2 Repositorio y Servicio (`DashboardService`)

1. **`GetTopProductsAsync`**:
   - Al agrupar los productos por nombre y calcular unidades y total facturado, se cargan las categorías existentes de la base de datos (`_categoryRepository.GetAllAsync`).
   - Se determina `HasAttributes`: `true` si la categoría asociada al producto existe y contiene al menos un atributo en `Category.Attributes`.
2. **`GetProductAttributeBreakdownAsync`**:
   - Parámetros: `string productName`, `string period = "month"`, `CancellationToken ct = default`.
   - Filtra órdenes válidas dentro del rango del período (`CreatedAt >= periodStart`).
   - Selecciona los `OrderProduct` cuyo `Name` coincida con `productName` (o categoría correspondiente).
   - Localiza la `Category` en la base de datos para obtener los metadatos de los atributos (`Title`, `Values` / labels).
   - Para cada atributo de la categoría:
     - Mapea el valor seleccionado en `p.Attributes` (manejando tanto nombres textuales como claves de ID).
     - Suma `Quantity` por opción.
     - Calcula el porcentaje sobre el total de unidades del producto.
     - Ordena las opciones descendentemente por unidades vendidas.
   - Retorna `ProductAttributeBreakdownResponseDto`.

### 2.3 Controlador (`DashboardController`)

```csharp
[HttpGet("top-products/attribute-breakdown")]
public async Task<ActionResult<ProductAttributeBreakdownResponseDto>> GetProductAttributeBreakdown(
    [FromQuery] string productName,
    [FromQuery] string period = "month",
    CancellationToken ct = default)
{
    if (string.IsNullOrWhiteSpace(productName))
        return BadRequest("El nombre del producto es requerido.");

    var result = await _dashboardService.GetProductAttributeBreakdownAsync(productName, period, ct);
    return Ok(result);
}
```

---

## 3. Frontend: Componentes e Interacción

### 3.1 Tipos en `src/lib/api-client.ts`

```typescript
export interface AttributeOptionStat {
  value: string;
  unitsSold: number;
  percentage: number;
}

export interface AttributeBreakdown {
  attributeId: string;
  attributeTitle: string;
  totalUnitsWithAttribute: number;
  options: AttributeOptionStat[];
}

export interface ProductAttributeBreakdownResponse {
  productName: string;
  category: string;
  totalUnitsSold: number;
  attributes: AttributeBreakdown[];
}

export interface TopProduct {
  productName: string;
  category: string;
  unitsSold: number;
  totalUsd: number;
  hasAttributes?: boolean;
}
```

Método en `ApiClientClass`:
```typescript
async getProductAttributeBreakdown(
  productName: string,
  period = 'month',
  signal?: AbortSignal
): Promise<ProductAttributeBreakdownResponse> {
  const query = new URLSearchParams({ productName, period });
  return apiFetch<ProductAttributeBreakdownResponse>(
    `/api/dashboard/top-products/attribute-breakdown?${query.toString()}`,
    { signal }
  );
}
```

### 3.2 Tabla `TopProductsTable` (`src/components/analytics/top-products-table.tsx`)

- Acepta prop opcional `period: string`.
- Renderizado de filas:
  - Si `p.hasAttributes === true`:
    - Clase `cursor-pointer hover:bg-muted/50`.
    - Columna de acciones o badge interactivo junto al nombre: `<SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />`.
    - Evento `onClick` que abre el modal para ese producto.
  - Si `p.hasAttributes === false`:
    - Fila estándar sin hover interactivo ni click.

### 3.3 Modal `ProductAttributeBreakdownDialog` (`src/components/analytics/product-attribute-breakdown-dialog.tsx`)

- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `productName: string | null`
  - `category: string | null`
  - `period: string`
- **Comportamiento**:
  - Al abrirse con `productName`, llama a `apiClient.getProductAttributeBreakdown`.
  - Si está cargando: Muestra skeletons animados de las tarjetas de atributos.
  - Al recibir datos:
    - Renderiza un encabezado con el nombre del producto, badge de la categoría y total de unidades.
    - Renderiza una tarjeta (`Card`) por cada atributo (ej. "Copete", "Box", "Tela", "Color").
    - Dentro de cada tarjeta, lista las opciones con ranking (1, 2, 3...), nombre de la opción, unidades vendidas, porcentaje y una barra de progreso esmeralda horizontal.
  - Manejo de error o estado sin atributos con alerta amigable.

---

## 4. Plan de Pruebas y Validación

1. **Pruebas de Backend**:
   - Prueba unitaria o de integración de `GetProductAttributeBreakdownAsync` verificando que agrupe correctamente los atributos y ordene descendentemente por unidades vendidas.
   - Verificación de que productos sin atributos en su categoría devuelvan `HasAttributes = false`.
2. **Pruebas de Frontend (`bun test`)**:
   - Validar que las interfaces y llamadas del `apiClient` compilen y pasen pruebas existentes.
3. **Validación de Compilación y Visual**:
   - `npm run build` en el frontend y `dotnet build` en el backend.
   - Comprobación manual en el navegador abriendo `/dashboard`, haciendo click en una cama matrimonial con atributos y comprobando el modal.

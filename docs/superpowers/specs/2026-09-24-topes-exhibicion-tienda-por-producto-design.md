# Especificación de Diseño: Topes de Exhibición por Producto en Tiendas

**Fecha:** 2026-09-24  
**Estado:** Aprobado para Planificación  
**Área:** Inventario Multisede, Gestión de Tiendas y Sugerencias de Reposición BI

---

## 1. Contexto y Objetivos

En CamiHogar, cada tienda física (showroom) cuenta con un espacio físico finito para exhibición de muebles. Hasta ahora, el sistema manejaba un único número entero (`MaxCapacity`) para representar la capacidad máxima global de la tienda (por ejemplo, 25 muebles).

Sin embargo, en el piso de venta real, la capacidad no es homogénea: cada producto o modelo de mueble (Cama King, Sofá 3 puestos, Juego de Comedor París, etc.) tiene un **tope de exhibición específico** permitido por tienda.

### Objetivos Principales:
1. **Definir topes por producto individual**: Permitir a la administración configurar cuántas unidades de cada producto del catálogo pueden estar exhibidas simultáneamente en cada tienda.
2. **Mantener la capacidad física global del showroom**: Conservar el límite físico total de la tienda (`MaxCapacity`) para monitorear sobrecupo espacial global, mientras los topes por producto guían la reposición.
3. **Acceso Dual en UI**: Permitir gestionar estos topes tanto desde un botón de acceso directo en la tabla de tiendas como en una pestaña dedicada dentro del modal de edición de la tienda.
4. **Alimentar el Algoritmo de Reposición en BI**: Conectar las existencias físicas reales de cada producto en tienda con su tope configurado para calcular el déficit exacto de reposición desde el Depósito Central Terrinca.

---

## 2. Modelo de Datos y Arquitectura (Enfoque Embebido Ponytail)

Se adopta el **Enfoque Embebido**, que almacena los topes directamente en el documento de la tienda en MongoDB, evitando colecciones adicionales, migraciones pesadas o uniones (`$lookup`) costosas.

### 2.1 Backend Domain (`Ordina.Domain.Stores.Store`)
```csharp
public class Store : BaseEntity
{
    // ... campos existentes (Name, Code, Address, Phone, Email, Rif, Status, MaxCapacity) ...

    [BsonElement("productDisplayLimits")]
    public Dictionary<string, int> ProductDisplayLimits { get; set; } = new();
}
```
* **Clave del Diccionario**: `productId` (ID del producto en catálogo).
* **Valor del Diccionario**: `limit` (número entero $\ge 0$, tope de unidades permitidas en la tienda). Si un producto no está en el diccionario o su valor es 0, significa que la tienda no exhibe ese producto de forma permanente.

### 2.2 DTOs y Endpoints en Backend
1. **Actualización de DTOs en `Ordina.Application.Stores.DTOs`**:
   - `StoreDto`: incluye `Dictionary<string, int> ProductDisplayLimits`.
   - `CreateStoreDto` y `UpdateStoreDto`: incluyen `Dictionary<string, int>? ProductDisplayLimits`.
   - Nuevo `UpdateStoreDisplayLimitsDto`:
     ```csharp
     public record UpdateStoreDisplayLimitsDto(Dictionary<string, int> ProductDisplayLimits);
     ```

2. **Endpoints en `StoresController`**:
   - `PUT /api/stores/{id}/display-limits`: Permite guardar de manera atómica y rápida los topes de exhibición sin requerir reenviar los datos generales ni contacto de la tienda.
   - `GET /api/stores/{id}`: Devuelve el `StoreDto` con sus límites actuales.

### 2.3 Reposición Inteligente en `DashboardService`
El cálculo de sugerencias de reposición en el panel BI y métricas utilizará la fórmula:
```csharp
foreach (var (productId, limit) in store.ProductDisplayLimits)
{
    var physicalInStore = currentStoreStock.GetValueOrDefault(productId, 0);
    var deficit = Math.Max(0, limit - physicalInStore);
    if (deficit > 0)
    {
        var centralAvailable = centralStock.GetValueOrDefault(productId, 0);
        var toReplenish = Math.Min(deficit, centralAvailable);
        // Generar sugerencia de reposición para el producto hacia la tienda
    }
}
```

---

## 3. Diseño de la Interfaz de Usuario (Frontend)

### 3.1 Puntos de Entrada
1. **Acción directa en la tabla de Tiendas** ([`stores-page.tsx`](file:///f:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/Ordina.Frontend/src/components/stores/stores-page.tsx)):
   - Nuevo botón de acción con icono de vitrina/capacidad (`SlidersHorizontal` o `LayoutGrid`) titulado *"Topes de Exhibición"*.
   - Al pulsar, abre inmediatamente el diálogo enfocado `StoreProductLimitsDialog`.
2. **Pestañas en el Diálogo "Editar Tienda"**:
   - **Pestaña 1: "Datos de Tienda"**: Formulario existente con nombre, RIF, teléfono, estado y "Capacidad Máxima del Showroom (Piso)".
   - **Pestaña 2: "Topes por Producto"**: Embebe la tabla interactiva de configuración de límites.

### 3.2 Componente `StoreProductLimitsDialog`
- **Encabezado**:
  - Título: *"Topes de Exhibición - Tienda [Nombre]"*.
  - Medidor de Capacidad:
    - Muestra la suma actual de piezas configuradas: `Total Configurado: X unid. / Capacidad Total Showroom: Y unid.`.
    - Barra visual de progreso o alerta suave si la suma de topes supera la capacidad física global declarada.
- **Herramientas de filtrado**:
  - Buscador en tiempo real por nombre de producto o SKU.
  - Selector de categoría (Todas, Salas, Comedores, Dormitorio, etc.).
  - Switch o filtro: *"Mostrar solo configurados (> 0)"*.
- **Tabla de Asignación**:
  - **Producto**: Nombre del modelo y categoría.
  - **Stock Actual en Tienda**: Existencias físicas actuales presentes en esa sede.
  - **Stock en Terrinca**: Existencias disponibles en el depósito central.
  - **Tope de Exhibición**: Input numérico editable en línea (con botones `+` y `-` y tipeo directo, mínimo 0).
- **Acciones**:
  - Botón *"Guardar Topes de Exhibición"* con estado de guardado y feedback mediante `toast.success`.

---

## 4. Estrategia de Pruebas y Validación

1. **Pruebas Unitarias de Backend (`Ordina.Application.Tests`)**:
   - `StoreServiceTests`:
     - Validar que al crear o actualizar una tienda con `ProductDisplayLimits`, se persisten y recuperan correctamente.
     - Validar que el endpoint dedicado `/display-limits` actualiza los topes sin alterar otros campos de la tienda.
     - Validar que límites negativos son corregidos o rechazados ($\ge 0$).
2. **Pruebas de Reposición en Dashboard**:
   - Validar que el algoritmo de reposición sugiera transferencias basadas en el déficit entre `limit` y `stock` real en tienda.
3. **Validación Frontend**:
   - Ejecutar `npm run build` en `Ordina.Frontend` para asegurar que las nuevas interfaces y tipos compilen sin errores de TypeScript.
   - Probar en navegador la carga de productos, el guardado de límites y su persistencia.

---

## 5. Criterios de Aceptación

- [x] La entidad `Store` almacena un mapeo `ProductId` $\rightarrow$ `Limit`.
- [x] La capacidad total del showroom sigue existiendo como cota física global.
- [x] Se puede abrir la gestión de topes tanto desde la tabla principal de tiendas como desde el modal de edición.
- [x] El modal lista los productos del catálogo con buscador y filtro por categoría.
- [x] Los topes se guardan atómicamente y se recargan fielmente al volver a consultar la tienda.
- [x] Cero comandos de `git commit` ejecutados (en estricto cumplimiento de la instrucción del usuario).

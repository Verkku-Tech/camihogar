# Reglas de Negocio: Catálogo, Productos y Proveedores

**Módulo:** Catálogo Comercial e Inventario  
**Entidades Principales:** `Product`, `Category`, `CategoryAttribute`, `Provider`, `ProductImage`  
**Servicios de Aplicación:** `ICatalogServices`, `CatalogServices`, `IProductService`, `ICategoryService`, `IProviderService`  

---

## 1. Jerarquía del Catálogo de Mobiliario

El catálogo de Camihogar organiza el inventario en una estructura jerárquica orientada a la venta y personalización de muebles:

```
                          ┌────────────────────┐
                          │     Categoría      │
                          │  (ej. Juego Sala)  │
                          └─────────┬──────────┘
                                    │ Atributos Dinámicos
                                    │ (Telas, Maderas, Medidas)
                                    ▼
                          ┌────────────────────┐
                          │      Producto      │
                          │ (ej. Sofá Chesterfield) │
                          └─────────┬──────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
      [ Venta en Stock ]                        [ Venta por Encargo ]
      • Ubicación: EN TIENDA                    • Ubicación: FABRICACION
      • Availability: disponible                • Requiere Taller / Proveedor
```

---

## 2. Atributos Personalizados de Producto

Dado que los muebles admiten amplias configuraciones a gusto del cliente, los productos almacenan pares clave-valor dinámicos en `Attributes`:
- **Medidas Físicas:** Largo, ancho, alto y profundidad (expresados en centímetros o metros).
- **Tapicería y Telas:** Código de catálogo de tela, tipo de material (Lino, Terciopelo, Cuero Sintético, Microfibra) y color exacto.
- **Acabados y Estructuras:** Tono de tintura de madera (Nogal, Roble, Wengue, Natural) o acabados metálicos (Negro electrostático, Cromo, Dorado).

---

## 3. Disponibilidad y Estados de Producto

El sistema categoriza la disponibilidad operativa a través de `AvailabilityStatus`:

| Estado | Código de Base de Datos | Comportamiento Comercial |
| :--- | :--- | :--- |
| **Disponible** | `disponible` | Producto existente físicamente en exhibición o almacén central. Habilitado para entrega inmediata. |
| **Agotado** | `agotado` | Sin existencias para entrega directa. Solo puede venderse si se habilita la fabricación por encargo. |
| **Por Encargo** | `por_encargo` | Modelo que se confecciona exclusivamente contra pedido confirmado. |

---

## 4. Regla de Sobreprecio (*Surcharge*)

Cuando un cliente solicita una adaptación que excede la ficha técnica estándar de un modelo (ej. incremento de dimensiones, cambio a una tela importada premium o herrajes especiales):

### Parámetros de Control:
1. `surchargeEnabled` (`bool`): Indicador de que la línea de producto incluye recargo.
2. `surchargeAmount` (`decimal`): Monto adicional en USD sumado al precio del producto.
3. `surchargeReason` (`string`): Justificación obligatoria del recargo (ej. *"Modificación a 2.40 metros y espuma de alta densidad densidad 26"*).

### Impacto en el Total:
$$\text{Precio Efectivo} = \text{Precio Base} + \text{Monto Sobreprecio}$$
$$\text{Total Línea} = (\text{Precio Efectivo} \times \text{Cantidad}) - \text{Descuento}$$

---

## 5. Proveedores y Talleres Artesanales (`Provider`)

La red de producción de Camihogar combina instalaciones propias con talleres externos especializados:

### Clasificación (`ProviderType`):
- **Taller Propio (`taller_propio`):** Instalaciones de carpintería y tapicería internas de la empresa.
- **Artesano Externo (`artesano_externo`):** Talleres aliados contratados por destajo o por obra específica.
- **Proveedor de Materia Prima (`proveedor_materia_prima`):** Suministradores de madera, láminas, herrajes, telas y gomaespuma.

### Reglas de Operación:
- Solo los proveedores con `status == "Activo"` pueden recibir asignaciones en el Tablero de Fabricación.
- Si un proveedor es desactivado, sus órdenes en curso deben reasignarse a otro taller mediante el flujo de refabricación o actualización de etapa.

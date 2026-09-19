# Índice Maestro de Reglas de Negocio — Camihogar / Ordina ERP

Este directorio centraliza la documentación funcional y técnica de las **Reglas de Negocio** de la plataforma **Camihogar / Ordina ERP**. Su propósito es servir como la fuente de verdad definitiva para desarrolladores, agentes de IA, auditores y líderes de operaciones sobre cómo opera cada proceso de la empresa.

---

## 🏛️ Estructura de Módulos y Documentos

| Archivo | Módulo | Alcance Principal |
| :--- | :--- | :--- |
| [01-orders-and-sales.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/Business%20Rules/01-orders-and-sales.md) | **🛍️ Pedidos, Presupuestos y Ventas** | Tipos de orden, modalidades de venta, ciclo de vida, cálculo financiero, descuentos, declinado inteligente y concurrencia optimista. |
| [02-manufacturing-and-workshop.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/Business%20Rules/02-manufacturing-and-workshop.md) | **🔨 Manufactura y Taller** | Tablero Kanban de producción, etapas de fabricación, asignación a talleres/artesanos, ciclo de refabricación y protección de órdenes. |
| [03-dispatch-and-logistics.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/Business%20Rules/03-dispatch-and-logistics.md) | **🚚 Bodega, Despacho y Rutas** | Cola de despacho, asignación de rutas de entrega, control por chofer/vehículo, confirmación por ítem y cierre automático de pedidos. |
| [04-finance-and-payments.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/Business%20Rules/04-finance-and-payments.md) | **💵 Finanzas, Pagos y BCV** | Operación bimonetaria (USD/Bs.), tasas históricas vs. tasa BCV viva, pagos mixtos, abonos parciales, sistemas de apartado y liquidación de comisiones. |
| [05-clients-and-rut.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/Business%20Rules/05-clients-and-rut.md) | **👥 Clientes y Validación RUT** | Tipos de persona, validación y normalización estricta de documentos venezolanos (V, E, J, G, P) y gestión de estados de cliente. |
| [06-catalog-and-inventory.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/Business%20Rules/06-catalog-and-inventory.md) | **📦 Catálogo, Productos y Proveedores** | Jerarquía de categorías, atributos personalizados, control de disponibilidad, sobreprecios y gestión de talleres externos. |
| [07-security-and-permissions.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/Business%20Rules/07-security-and-permissions.md) | **🛡️ Seguridad, Roles y Permisos** | Matriz de roles del sistema, permisos asignables individualmente, visibilidad transversal del equipo online y políticas de sesión. |
| [08-dashboard-and-metrics.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/Business%20Rules/08-dashboard-and-metrics.md) | **📊 Métricas y Auditoría Operativa** | Definición matemática y técnica de las 7 métricas del Dashboard en MongoDB y registro de auditoría de eventos críticos. |

---

## 🔄 Flujo Transversal del Ciclo de Vida de una Orden

```
                    [ 1. COMERCIAL ]
                 Presupuesto (PRE-xxxx)
                           │
                           ▼ (Conversión)
                    Venta / Pedido (ORD-xxxx)
                    Modalidad: Entrega / Encargo / Apartado
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
  [ Requiere Fabricación ]             [ En Stock / Almacén ]
         │                                   │
         ▼                                   ▼
  [ 2. TALLER / MANUFACTURA ]         [ 3. BODEGA & DESPACHO ]
  • Debe Fabricar                     • Cola de Despacho
  • Por Fabricar                      • Creación de Ruta (Chofer / Placa)
  • Fabricando                        • En Ruta
  • Refabricación (si hay fallas)     • Confirmación Ítem por Ítem
  • Almacén No Fabricado                     │
         │                                   ▼
         └──────────────────────────► Entrega Completada (DESPACHADO)
                                             │
                                             ▼
                                    [ 4. CIERRE & FINANZAS ]
                                    • Liquidación de Abonos / Saldo $0
                                    • Pedido marcado "Completado"
                                    • Cálculo de Comisiones a Vendedores
```

---

## 📌 Principios Rectores de Negocio

1. **Prioridad de la Verdad Operativa:**
   - Cada producto dentro de un pedido mantiene su propio estado de fabricación (`ManufacturingStatus`), ubicación física (`LocationStatus`) y estado logístico (`LogisticStatus`). El pedido como entidad refleja la agregación de sus productos, nunca al revés.
2. **Resiliencia Bimonetaria:**
   - Todos los precios de referencia comerciales se pactan y guardan en dólares estadounidenses (`USD`). Los cobros en bolívares (`Bs.`) calculan el contravalor según la tasa oficial del BCV vigente al momento de emitir cada pago o abono.
3. **Idempotencia y Trazabilidad:**
   - Ningún pago, cambio de estado o confirmación de entrega puede duplicarse por caídas de red; cada mutación lleva una clave de idempotencia (`X-Mutation-Id`) única de 24 horas.
4. **Protección de Bienes en Taller:**
   - La declinación o cancelación comercial de un pedido nunca elimina ni oculta unidades que ya estén en corte, armado o tapicería en el taller.

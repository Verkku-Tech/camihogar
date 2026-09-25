# Especificación de Diseño: Timeline Visual Semántico para Auditoría de Pedidos (FORGE ERP)

**Fecha:** 2026-09-23  
**Estado:** Aprobado por el usuario (tras revisión de prototipo HTML interactivo)  
**Alcance:** Exclusivamente en el worktree `f:/Verkku/Camihogar/.worktrees/refactor-modular-monolith`  

---

## 1. Contexto y Problema

En la versión anterior del diálogo de **Auditoría de Pedidos** (`OrderAuditLogDialog`), el historial se mostraba en una tabla plana (`<Table>`) donde todos los cambios se condensaban en un string de texto plano dentro de la columna "Resumen":
- Textos monótonos sin jerarquía visual, separados por guiones largos (`—`) y flechas (`→`).
- Dificultad para discernir rápidamente qué valor cambió, cuál era el anterior y cuál es el nuevo.
- Acciones ("Actualizado", "Creado", "Pagos") mostradas como texto plano sin color.
- Fechas en formato crudo de localización sin indicación de tiempo relativo.
- Necesidad de abrir un segundo modal ("Detalle") para examinar modificaciones compuestas.

Tras presentar un prototipo HTML interactivo (`audit-logs-preview.html`), el usuario aprobó la **Opción 1: Timeline Lineal Unificado** con despliegue de cambios en la misma tarjeta (*in-place expansion*).

---

## 2. Metas de Diseño y Principios

1. **Escaneo Rápido (Glanceability):** El usuario debe comprender en menos de 2 segundos quién hizo qué en cuál pedido.
2. **Semántica Visual (Diffs Coloreados):**
   - Valores antiguos: atenuados y tachados con fondo rosa/rojo tenue (`val-old`).
   - Valores nuevos: destacados en verde esmeralda / blanco (`val-new highlight`).
   - Pagos agregados: pill verde esmeralda con icono `+` (`payment-pill add`).
   - Pagos eliminados: pill rosa/rojo con icono `-` (`payment-pill remove`).
3. **Identidad FORGE / Verkku Precision Atelier:**
   - Paleta: Grafito cálido (`#10151B`, `#151C24`), Verde Esmeralda (`#1CB569`), Acentos Azul Celeste (`#38BDF8`), Púrpura (`#A855F7`), Rosa (`#F43F5E`) y Ámbar (`#F59E0B`).
   - Tipografía: `Plus Jakarta Sans` para textos generales y `JetBrains Mono` para códigos de pedido (`ORD-XXXX`), montos y timestamps.
4. **Despliegue In-Place:**
   - Eventos con $\le 3$ cambios: se muestran completos directamente.
   - Eventos con $> 3$ cambios: se muestran los primeros 3 y un botón `+ N cambios adicionales` que expande el resto dentro de la misma tarjeta sin abrir modales secundarios.
5. **Cero Pantallas en Blanco:**
   - Esqueleto de carga (`boneyard-js` o skeleton cards temáticos) durante la carga asíncrona.

---

## 3. Arquitectura y Componentes

### 3.1. Archivos Afectados

```text
Ordina.Frontend/
├── src/
│   ├── components/
│   │   └── orders/
│   │       ├── order-audit-log-dialog.tsx           [MODIFICAR] Diálogo principal, reemplazo de Table por Timeline
│   │       ├── audit-timeline/
│   │       │   ├── audit-timeline-item.tsx          [NUEVO] Componente de tarjeta de evento en el timeline
│   │       │   ├── audit-diff-row.tsx               [NUEVO] Renders de diff (estado, campo, texto)
│   │       │   ├── audit-action-badge.tsx           [NUEVO] Badges semánticos por tipo de acción
│   │       │   └── audit-timeline-skeleton.tsx      [NUEVO] Skeleton animado para carga
│   │       └── __tests__/
│   │           └── order-audit-timeline.test.tsx    [NUEVO] Suite de pruebas frontend con Bun
│   └── lib/
│       └── audit-log-labels.ts                      [MODIFICAR] Helper para parsear y agrupar diffs estructurados
```

### 3.2. Modelo de Datos y Estructura de Cambios

`audit-log-labels.ts` expondrá la función auxiliar:
```typescript
export interface StructuredAuditItem {
  type: "status" | "payment_add" | "payment_remove" | "field_diff" | "creation_summary";
  label?: string;
  oldValue?: string | null;
  newValue?: string | null;
  paymentText?: string;
}

export function extractStructuredChanges(log: OrderAuditLogDto): StructuredAuditItem[];
```

Esta función convierte los cambios granulares `log.changes` y el resumen `log.summary` en una lista normalizada de ítems listos para ser renderizados con componentes semánticos, garantizando total resiliencia tanto si existen `changes` granulares como si solo está disponible el `summary`.

### 3.3. Componentes Visuales

1. **`AuditActionBadge`:**
   - `created`: Verde esmeralda (`bg-emerald-500/10 text-emerald-400 border-emerald-500/20`).
   - `updated`: Azul cielo (`bg-sky-500/10 text-sky-400 border-sky-500/20`).
   - `payment_conciliated` o cambios de pago: Púrpura (`bg-purple-500/10 text-purple-400 border-purple-500/20`).
   - `deleted` / `order_declined`: Rosa/Rojo (`bg-rose-500/10 text-rose-400 border-rose-500/20`).
   - `manufacturing_*`: Ámbar (`bg-amber-500/10 text-amber-400 border-amber-500/20`).

2. **`AuditTimelineItem`:**
   - Nodo lateral con icono SVG según el tipo de acción sobre la línea conectora vertical.
   - Cabecera:
     - Enlace al pedido `[ORD-XXXX]` con `font-mono`, verde esmeralda y hover interactivo (`router.push('/pedidos/ORD-XXXX')`).
     - Nombre de usuario en `font-semibold` con avatar inicial circular (`NG`, `FU`, etc.).
     - Badge de acción.
     - Timestamp relativo ("hace 2 horas") y hora exacta ("1:47 PM").
   - Contenedor de cambios con espaciado consistente (`space-y-1.5`).
   - Botón `+ N cambios adicionales` con animación suave para expandir/colapsar.

3. **`AuditTimelineSkeleton`:**
   - 4 tarjetas fantasma con pulsación sutil para evitar saltos de layout durante `loading === true`.

---

## 4. Pruebas y Criterios de Aceptación

1. **Pruebas Unitarias Frontend (`bun test`):**
   - Validación de `extractStructuredChanges`:
     - Parsea correctamente cambios de estado (`En almacén → En Ruta`).
     - Detecta pagos agregados (`+`) y eliminados (`-`).
     - Maneja correctamente pedidos creados con o sin pagos iniciales.
   - Renderizado de `AuditTimelineItem`:
     - Muestra correctamente los primeros 3 cambios.
     - Botón de expansión visible solo cuando hay $> 3$ cambios.
     - Clic en el botón expande y colapsa los cambios adicionales.
2. **Pruebas de Compilación:**
   - `bun run build` (`tsc -b && vite build`) debe compilar con **0 errores**.
3. **Restricción de Entorno:**
   - Todo cambio debe realizarse exclusivamente en el worktree `f:/Verkku/Camihogar/.worktrees/refactor-modular-monolith`.

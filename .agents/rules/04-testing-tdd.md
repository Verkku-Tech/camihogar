# Reglas de Testing y TDD Pragmático de Alto Valor

Este documento define la metodología y el alcance obligatorio de pruebas para **Camihogar / Ordina**.

---

## 1. Filosofía Central de TDD

```
LEY DE HIERRO: NINGÚN CÓDIGO DE PRODUCCIÓN SIN UNA PRUEBA QUE HAYA FALLADO PRIMERO
```

1. **Pruebas Reales de Alto Valor (Cero Tests Triviales):**
   - Prohibido escribir cientos de pruebas para verificar getters, setters o mocks vacíos que no atrapan errores reales.
   - Cada prueba debe representar un caso de uso real de negocio, una condición de borde, un cálculo matemático o una validación de concurrencia.
2. **Ciclo RED-GREEN-REFACTOR:**
   - **RED:** Escribir la prueba que exprese el comportamiento esperado. Ejecutarla y verificar que falle por la razón correcta.
   - **GREEN:** Escribir el código mínimo y necesario para que la prueba pase.
   - **REFACTOR:** Limpiar y simplificar manteniendo todas las pruebas verdes.

---

## 2. Áreas Críticas Obligatorias para Pruebas (Backend .NET 10 xUnit)

1. **Máquina de Estados de Pedidos y Fabricación:**
   - Conversión válida de presupuesto aprobado a orden de trabajo.
   - **Bloqueo:** Rechazo de saltos de etapa ilegales en taller (ej. pasar de *Corte* a *Empacado* sin pasar por *Armado*, *Tapicería*, *Pintura*, *ControlCalidad*).
   - **Bloqueo:** Prohibición de despacho mientras existan registros activos de *Refabricación*.
2. **Cálculos Financieros y Multi-Moneda:**
   - Totales de pedido con descuentos globales y por ítem + sobreprecios dinámicos de tapicería.
   - Conversión exacta USD <-> VES con tasas históricas vs vigentes (evitar errores de redondeo decimal).
   - Abonos parciales: validación de saldo restante y rechazo de pagos mayores al monto adeudado.
3. **Idempotencia y Concurrencia:**
   - Peticiones repetidas con el mismo `X-Mutation-Id` deben retornar el resultado existente sin duplicar registros en MongoDB.
   - Concurrencia optimista (`updatedAt`): rechazo con `409 Conflict` si el documento fue alterado en el servidor antes del envío del cliente.
4. **Seguridad y Permisos:**
   - Intentos de acceso a recursos de finanzas o administración por roles no autorizados (ej. rol *Taller*) deben responder `403 Forbidden`.
   - Rotación de Refresh Token sin cabecera Anti-CSRF debe responder `400 Bad Request`.

---

## 3. Áreas Críticas Obligatorias para Pruebas (Frontend Bun Test)

1. **Cola Outbox y Sincronización Offline (`sync-manager.ts`):**
   - Guardado de mutaciones en `outbox_mutations` durante desconexión.
   - Drenaje FIFO al disparar el evento `online`, envío de `X-Mutation-Id`, actualización de caché e invalidación de queries.
   - Reintento con backoff exponencial si el servidor responde con error `5xx`, preservando los datos locales.
2. **Persistencia e Hidratación Inmediata (`query-client.ts`):**
   - Carga de la SPA en modo offline e hidratación de pedidos/clientes desde `tanstack_cache` en `<10ms`.
3. **Telemetría y Buffer Offline (`telemetry.ts`):**
   - Captura de errores en `ErrorBoundary.tsx` y envío inmediato a `/api/telemetry/client-logs`.
   - Almacenamiento en `telemetry_buffer` si no hay conexión y envío automático al reconectar.

---

## 4. Comandos de Ejecución de Pruebas

```bash
# Backend (Pruebas de Aplicación y API)
dotnet test Ordina.Backend/tests/Ordina.Application.Tests
dotnet test Ordina.Backend/tests/Ordina.Api.Tests

# Frontend (Pruebas unitarias y de integración de sincronización)
bun test
```

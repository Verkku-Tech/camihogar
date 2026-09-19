# Reglas de Negocio: Finanzas, Pagos y BCV

**Módulo:** Finanzas, Tesorería y Cobranzas  
**Entidades Principales:** `Payment`, `PaymentDetails`, `PartialPayment`, `ExchangeRate`, `Commission`, `SaleTypeCommissionRule`  
**Servicios de Aplicación:** `IFinanceService`, `IPaymentService`, `IExchangeRateService`, `IBcvExchangeRateService`  

---

## 1. Régimen Bimonetario y Tasa Oficial BCV

Debido al contexto económico venezolano, el sistema opera de manera nativa bajo un **esquema bimonetario (USD / Bs.)**:

1. **Moneda Base Contable:** Todos los catálogos, presupuestos, contratos y totales de pedidos se pactan y almacenan en **Dólares Estadounidenses (`USD`)**.
2. **Tasa Oficial de Referencia:** Cualquier conversión a Bolívares (`Bs.`) se rige exclusivamente por la tasa oficial publicada por el **Banco Central de Venezuela (BCV)**.
3. **Tasa de Creación vs. Tasa de Cobro:**
   - **Tasa al Crear (`ExchangeRatesAtCreation`):** Al emitir una orden o presupuesto, se congela la tasa USD del BCV de ese instante. Sirve como referencia contractual para el cliente.
   - **Tasa al Momento del Pago:** Cuando el cliente efectúa un pago en bolívares (sea el pago inicial o un abono posterior), se aplica la tasa BCV vigente en la fecha/hora en que se realiza la transacción bancaria.

---

## 2. Métodos e Instrumentos de Pago

El sistema soporta una amplia variedad de canales de cobro mediante `PaymentDetails`:

| Instrumento | Datos de Validación Requeridos | Tratamiento de Moneda |
| :--- | :--- | :--- |
| **Pago Móvil** | Banco emisor, número de teléfono, referencia bancaria (últimos 4-6 dígitos), fecha. | Principalmente `Bs.` convertido a USD a tasa de pago. |
| **Transferencia Bancaria** | Banco origen/destino, número de cuenta, número de referencia completa, fecha. | `Bs.` o `USD` (cuentas nacionales en divisas). |
| **Efectivo Divisas (USD)** | Monto recibido, vuelto entregado, número de serie en billetes de alta denominación. | Registro directo en `USD` sin conversión. |
| **Efectivo Bolívares (Bs.)** | Monto recibido, vuelto entregado. | Conversión a USD con tasa BCV del día. |
| **Zelle / Wallets** | Correo electrónico del remitente, titular de la cuenta, ID de transacción. | Registro directo en `USD`. |
| **Tarjeta / Punto de Venta** | Lote, número de terminal, referencia. | Se calcula y registra la comisión bancaria retenida (`cardCommissionAmount`). |
| **Cashea** | Porción financiada (`casheaFinancedPortion`), cuotas y comprobante de aprobación. | Pago inicial en tienda + saldo liquidado por la plataforma. |

---

## 3. Pagos Mixtos y Abonos Parciales

Un solo pedido puede pagarse combinando múltiples instrumentos y monedas a través de `mixedPayments` y `partialPayments`:

### Fórmula de Amortización a la Deuda:
Para cada pago registrado en la lista:
- Si la moneda original es **USD**:
  $$\text{Amortización USD} = \text{Monto Original}$$
- Si la moneda original es **Bs.**:
  $$\text{Amortización USD} = \frac{\text{Monto en Bs.}}{\text{Tasa BCV del Pago}}$$

### Saldo Pendiente del Pedido:
$$\text{Saldo Pendiente USD} = \text{Total Pedido USD} - \sum_{j=1}^{m} \text{Amortización USD}_j$$

- Si $\text{Saldo Pendiente USD} \le 0.01$, el pedido se considera totalmente cancelado en lo financiero.

---

## 4. Regla de Sistemas de Apartado Vencidos (> 90 Días)

El Sistema de Apartado permite al cliente reservar precios mediante abonos escalonados:

```
               [ Creación de SA ] ──────────────────────► [ Día 90 ]
                        │                                    │
                        ▼                                    ▼
                 Abonos Parciales                   ¿Mantiene deuda > $0?
                 (Tasa BCV del día)                 ├── NO ➔ Liquidado
                                                    └── SÍ ➔ "SA VENCIDO"
```

1. **Plazo Límite:** Todo Sistema de Apartado tiene una vigencia legal máxima de **90 días continuos**.
2. **Condición de Vencimiento:**
   $$\text{Fecha de Creación} < (\text{Hoy} - 90 \text{ días}) \quad \land \quad \text{Saldo Pendiente} > \$0.01$$
3. **Efecto Operativo:** Las órdenes vencidas se reportan en el Dashboard con alarma de cobro (`SA Vencidos`), facultando a la gerencia a contactar al cliente o liberar los productos al inventario general.

---

## 5. Conciliación Bancaria

1. **Estado de Conciliación (`isConciliated`):**
   - Todo pago registrado por vendedores o cajeros nace con `isConciliated = false`.
   - El personal de administración/tesorería verifica el ingreso en el extracto bancario y marca `isConciliated = true`.
2. **Cierre de Caja:** Solo los pagos conciliados se computan como fondos líquidos efectivos en el arqueo diario.

---

## 6. Esquema y Liquidación de Comisiones de Venta

Las comisiones incentivan el esfuerzo comercial y se calculan según la regla configurada por tipo de venta (`SaleTypeCommissionRule`):

### 1. Variables de Reparto:
- `familyCommissionUsdPerUnit`: Monto base en USD asignado por cada unidad de mueble vendida.
- `vendorRate`: Porcentaje correspondiente al vendedor principal.
- `referrerRate`: Porcentaje para el asesor que captó o refirió el prospecto.
- `postventaRate`: Porcentaje reservado para atención postventa y seguimiento.

### 2. Modos de Exclusividad (`CommissionExclusivityModes`):
- **Compartida (`shared`):** La comisión se distribuye proporcionalmente entre vendedor, referidor y postventa.
- **Exclusiva (`exclusive`):** El vendedor titular asume el 100% de la comisión del pedido sin deducciones por terceros.
- **Exclusiva con Referidor (`exclusive_with_referrer`):** El vendedor titular comparte comisión exclusivamente con el referidor, sin cuota postventa.

### 3. Autonomía del Rol Online Seller:
Los vendedores del equipo online cuentan con el permiso `orders.payments.manage`, lo que les permite registrar abonos y actualizar datos de pago sobre pedidos de **cualquier vendedor de su equipo online**.

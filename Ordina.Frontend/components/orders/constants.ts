export type OrderStatusOption = { value: string; label: string };

/** Estados vigentes del flujo de pedidos (backend + fabricación + despachos). */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatusOption[] = [
  { value: "Presupuesto", label: "Presupuesto" },
  { value: "Generado", label: "Generado" },
  { value: "Validado", label: "Validado" },
  { value: "Fabricándose", label: "Fabricándose" },
  { value: "En Almacén", label: "En Almacén" },
  { value: "En Ruta", label: "En Ruta" },
  { value: "Completado", label: "Completado" },
  { value: "Cancelado", label: "Cancelado" },
] as const;

/** Etiquetas para estados históricos en BD que ya no se asignan en pedidos nuevos. */
export const LEGACY_ORDER_STATUS_LABELS: Record<string, string> = {
  "Por Fabricar": "Por Fabricar (histórico)",
  "En Fabricación": "En Fabricación (histórico)",
  Almacén: "Almacén (histórico)",
  Despacho: "Despacho (histórico)",
  Entregado: "Entregado (histórico)",
  Declinado: "Declinado (histórico)",
  Generada: "Generada (histórico)",
  Completada: "Completada (histórico)",
  Fabricación: "Fabricación (histórico)",
  "Por despachar": "Por despachar (histórico)",
};

const ACTIVE_ORDER_STATUS_VALUES = new Set(
  ACTIVE_ORDER_STATUSES.map((s) => s.value),
);

/**
 * Opciones del filtro de estado: lista activa + estados presentes en datos que no están en el flujo actual.
 */
export function buildOrderStatusFilterOptions(
  statusesInData: Iterable<string> = [],
): OrderStatusOption[] {
  const options: OrderStatusOption[] = [...ACTIVE_ORDER_STATUSES];
  const seen = new Set(ACTIVE_ORDER_STATUS_VALUES);

  for (const raw of statusesInData) {
    const status = raw?.trim();
    if (!status || seen.has(status)) continue;
    seen.add(status);
    options.push({
      value: status,
      label: LEGACY_ORDER_STATUS_LABELS[status] ?? `${status} (histórico)`,
    });
  }

  return options;
}

/** Alias de estados activos (filtros simples sin datos cargados). */
export const ORDER_STATUSES = ACTIVE_ORDER_STATUSES;

export const BUDGET_STATUSES = [
  { value: "Presupuesto", label: "Presupuesto" },
  { value: "Aprobado", label: "Aprobado" },
  { value: "Rechazado", label: "Rechazado" },
  { value: "Vencido", label: "Vencido" },
  { value: "Convertido", label: "Convertido" },
] as const;

// Métodos de pago para filtros (lista completa)
export const PAYMENT_METHODS_FILTER = [
  "AirTM",
  "Banesco Panamá",
  "Binance",
  "Efectivo Bs",
  "Efectivo $",
  "Facebank",
  "Mercantil Panamá",
  "Pago Móvil",
  "Pago a la entrega",
  "Paypal",
  "Tarjeta de débito",
  "Tarjeta de Crédito",
  "Transferencia",
  "Zelle",
] as const;

// Constantes para Condición de Pago
export const PAYMENT_CONDITIONS = [
  { value: "cashea", label: "Cashea" },
  { value: "pagara_en_tienda", label: "Pagará en Tienda" },
  { value: "pago_a_entrega", label: "Pago a la entrega" },
  { value: "pago_parcial", label: "Pago Parcial" },
  { value: "todo_pago", label: "Todo Pago" },
] as const;

// Constantes para Tipo de Venta (opciones del formulario; valores legacy siguen en `Order` / API)
export const PURCHASE_TYPES = [
  { value: "encargo", label: "Encargo" },
  { value: "encargo_entrega", label: "Encargo/Entrega" },
  { value: "entrega", label: "Entrega" },
  { value: "sistema_apartado", label: "SA (Sistema de Apartado)" },
] as const;

export type PurchaseTypeUiValue = (typeof PURCHASE_TYPES)[number]["value"];

const SALE_TYPE_LEGACY_LABELS: Record<string, string> = {
  delivery_express: "Delivery Express",
  retiro_almacen: "Retiro x Almacén",
  retiro_tienda: "Retiro x Tienda",
};

/** Etiqueta para detalle / PDF / listados; incluye tipos ya no seleccionables en el formulario. */
export function getSaleTypeLabel(saleType: string | undefined | null): string {
  if (!saleType) return "";
  const fromList = PURCHASE_TYPES.find((t) => t.value === saleType)?.label;
  if (fromList) return fromList;
  return SALE_TYPE_LEGACY_LABELS[saleType] ?? saleType;
}

// Constantes para Tipo de Entrega
export const DELIVERY_TYPES = [
  { value: "entrega_programada", label: "Entrega programada" },
  { value: "delivery_express", label: "Delivery Express" },
  { value: "retiro_tienda", label: "Retiro por Tienda" },
  { value: "retiro_almacen", label: "Retiro por almacén" },
] as const;

/** Etiqueta legible del tipo de entrega (detalle, confirmación, listados). */
export function getDeliveryTypeLabel(
  deliveryType: string | undefined | null,
): string {
  if (!deliveryType) return "";
  return (
    DELIVERY_TYPES.find((t) => t.value === deliveryType)?.label ?? deliveryType
  );
}

// Constantes para Zona de Entrega
export const DELIVERY_ZONES = [
  { value: "caracas", label: "Caracas" },
  { value: "g_g", label: "G&G" },
  { value: "san_antonio_los_teques", label: "San Antonio-Los Teques" },
  { value: "caucagua_higuerote", label: "Caucagua-Higuerote" },
  { value: "la_guaira", label: "La Guaira" },
  { value: "charallave_cua", label: "Charallave-Cua" },
  { value: "interior_pais", label: "Interior del País" },
] as const;

// Lista ampliada de métodos de pago
export const paymentMethods = [
  "AirTM",
  "Banesco Panamá",
  "Binance",
  "Efectivo",
  "Facebank",
  "Mercantil Panamá",
  "Pago Móvil",
  "Paypal",
  "Tarjeta de débito",
  "Tarjeta de Crédito",
  "Transferencia",
  "Zelle",
];

// Métodos de pago digitales en divisas (USD) que no requieren campo de moneda
export const digitalPaymentMethods = [
  "AirTM",
  "Banesco Panamá",
  "Binance",
  "Facebank",
  "Mercantil Panamá",
  "Paypal",
  "Zelle",
];

/**
 * Métodos que en el paso de pagos muestran selector de cuenta receptora y deben validarse al guardar.
 * Banesco/Mercantil Panamá no requieren cuenta en la app (no aplica al flujo de negocio).
 */
export const paymentMethodsRequiringReceivingAccount = [] as const;

/** Métodos que ocultan “tasa manual / equivalente exacto en Bs”; el monto en divisa se convierte solo con la tasa oficial del día. */
export const paymentMethodsNoManualBsConversion = [
  "AirTM",
  "Banesco Panamá",
  "Binance",
  "Facebank",
  "Mercantil Panamá",
  "Paypal",
  "Zelle",
] as const;

export function paymentMethodUsesOnlyOfficialBsRate(method: string): boolean {
  return (paymentMethodsNoManualBsConversion as readonly string[]).includes(
    method,
  );
}

/** Efectivo en USD/EUR: no se ofrece conversión manual a Bs. */
export function efectivoCashExcludesManualBs(
  cash: "Bs" | "USD" | "EUR" | undefined,
): cash is "USD" | "EUR" {
  return cash === "USD" || cash === "EUR";
}

// Métodos de pago que solo operan en Bolívares (Bs)
export const bsOnlyPaymentMethods = [
  "Pago Móvil",
  "Tarjeta de débito",
  "Tarjeta de Crédito",
  "Transferencia",
];

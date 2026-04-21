// Estados de pedidos para filtros
export const ORDER_STATUSES = [
  { value: "Presupuesto", label: "Presupuesto" },
  { value: "Generado", label: "Generado" },
  { value: "Validado", label: "Validado" },
  { value: "Fabricándose", label: "Fabricándose" },
  { value: "En Almacén", label: "En Almacén" },
  { value: "En Ruta", label: "En Ruta" },
  { value: "Completado", label: "Completado" },
  { value: "Cancelado", label: "Cancelado" },
  // Mantener los antiguos para compatibilidad con pedidos viejos
  { value: "Por Fabricar", label: "Por Fabricar (Antiguo)" },
  { value: "En Fabricación", label: "En Fabricación (Antiguo)" },
  { value: "Almacén", label: "Almacén (Antiguo)" },
  { value: "Despacho", label: "Despacho (Antiguo)" },
  { value: "Entregado", label: "Entregado (Antiguo)" },
  { value: "Declinado", label: "Declinado" },
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

// Constantes para Tipo de Venta
export const PURCHASE_TYPES = [
  { value: "delivery_express", label: "Delivery Express" },
  { value: "encargo", label: "Encargo" },
  { value: "encargo_entrega", label: "Encargo/Entrega" },
  { value: "entrega", label: "Entrega" },
  { value: "retiro_almacen", label: "Retiro x Almacén" },
  { value: "retiro_tienda", label: "Retiro x Tienda" },
  { value: "sistema_apartado", label: "SA (Sistema de Apartado)" },
] as const;

// Constantes para Tipo de Entrega
export const DELIVERY_TYPES = [
  { value: "entrega_programada", label: "Entrega programada" },
  { value: "delivery_express", label: "Delivery Express" },
  { value: "retiro_tienda", label: "Retiro por Tienda" },
  { value: "retiro_almacen", label: "Retiro por almacén" },
] as const;

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
 * No incluir AirTM, Facebank ni PayPal: no tienen ese campo en la UI.
 */
export const paymentMethodsRequiringReceivingAccount = [
  "Binance",
  "Banesco Panamá",
  "Mercantil Panamá",
] as const;

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
    method
  );
}

/** Efectivo en USD/EUR: no se ofrece conversión manual a Bs. */
export function efectivoCashExcludesManualBs(
  cash: "Bs" | "USD" | "EUR" | undefined
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


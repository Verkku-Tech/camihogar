// Estados de pedidos para filtros
export const ORDER_STATUSES = [
  { value: "Presupuesto", label: "Presupuesto" },
  { value: "Por Fabricar", label: "Por Fabricar" },
  { value: "En Fabricación", label: "En Fabricación" },
  { value: "Almacén", label: "Almacén" },
  { value: "Despacho", label: "Despacho" },
  { value: "Entregado", label: "Entregado" },
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

// Métodos de pago que solo operan en Bolívares (Bs)
export const bsOnlyPaymentMethods = [
  "Pago Móvil",
  "Tarjeta de débito",
  "Tarjeta de Crédito",
  "Transferencia",
];


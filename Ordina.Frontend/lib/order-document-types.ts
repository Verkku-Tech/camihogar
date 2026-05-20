export const ORDER_TYPE_RESERVATION = "Reservation" as const;
export const ORDER_STATUS_RESERVA = "Reserva" as const;
export const ORDER_PREFIX_RESERVATION = "RES-" as const;

/** Legacy: solo lectura y migración. */
export const LEGACY_ORDER_TYPE_RESERVATION = "PendingConfirmation" as const;
export const LEGACY_ORDER_STATUS_RESERVA = "Por Confirmar" as const;
export const LEGACY_ORDER_PREFIX_RESERVATION = "PCF-" as const;

export function isReservationType(type: string | undefined | null): boolean {
  const t = (type || "").trim();
  return (
    t === ORDER_TYPE_RESERVATION || t === LEGACY_ORDER_TYPE_RESERVATION
  );
}

export function isActiveReservationStatus(
  status: string | undefined | null,
): boolean {
  const s = (status || "").trim();
  return s === ORDER_STATUS_RESERVA || s === LEGACY_ORDER_STATUS_RESERVA;
}

export function isReservationOrderNumber(
  orderNumber: string | undefined | null,
): boolean {
  const num = (orderNumber || "").trim().toUpperCase();
  return (
    num.startsWith(ORDER_PREFIX_RESERVATION) ||
    num.startsWith(LEGACY_ORDER_PREFIX_RESERVATION)
  );
}

export function isReservationOrder(order: {
  type?: string | null;
  orderNumber?: string | null;
}): boolean {
  return isReservationType(order.type) || isReservationOrderNumber(order.orderNumber);
}

export function isActiveReservation(order: {
  type?: string | null;
  status?: string | null;
  orderNumber?: string | null;
}): boolean {
  return isReservationOrder(order) && isActiveReservationStatus(order.status);
}

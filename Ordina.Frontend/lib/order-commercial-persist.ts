/** Valor numérico a persistir: 0 explícito limpia el campo en backend e IndexedDB. */
export function resolveOptionalAmountForSave(amount: number): number {
  return amount > 0 ? amount : 0;
}

export function resolveProductLineDiscountForSave(
  discount: number | undefined | null,
): number {
  const n = discount ?? 0;
  return n > 0 ? n : 0;
}

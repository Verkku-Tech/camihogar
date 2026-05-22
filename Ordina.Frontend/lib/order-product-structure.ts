import type { OrderProduct } from "@/lib/storage";

function attributesFingerprint(
  attrs?: Record<string, string | number | string[]>,
): string {
  if (!attrs || Object.keys(attrs).length === 0) return "";
  return JSON.stringify(
    Object.keys(attrs)
      .sort()
      .map((k) => [k, attrs[k]]),
  );
}

/** Mirrors backend HasProductStructureChanges for PIN guard on confirm. */
export function hasProductStructureChanges(
  original: OrderProduct[],
  current: OrderProduct[],
): boolean {
  const o = [...original].sort((a, b) => a.id.localeCompare(b.id));
  const c = [...current].sort((a, b) => a.id.localeCompare(b.id));
  if (o.length !== c.length) return true;
  for (let i = 0; i < o.length; i++) {
    if (o[i].id !== c[i].id) return true;
    if ((o[i].quantity ?? 1) !== (c[i].quantity ?? 1)) return true;
    if (
      attributesFingerprint(o[i].attributes) !==
      attributesFingerprint(c[i].attributes)
    )
      return true;
  }
  return false;
}

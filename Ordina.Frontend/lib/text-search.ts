/** Quita tildes y pasa a minúsculas para comparar búsquedas. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Coincidencia parcial insensible a mayúsculas y tildes. */
export function textIncludesForSearch(haystack: string, needle: string): boolean {
  const n = normalizeForSearch(needle.trim());
  if (!n) return true;
  return normalizeForSearch(haystack).includes(n);
}

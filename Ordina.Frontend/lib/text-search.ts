/** Quita tildes y pasa a minúsculas para comparar búsquedas. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Coincidencia parcial insensible a mayúsculas y tildes (exige que todas las palabras/tokens coincidan). */
export function textIncludesForSearch(haystack: string, needle: string): boolean {
  const trimmed = needle.trim();
  if (!trimmed) return true;
  const normalizedHaystack = normalizeForSearch(haystack);
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.every((token) => normalizedHaystack.includes(normalizeForSearch(token)));
}

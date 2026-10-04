/** Case- and accent-insensitive "contains" used by every list search box. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function matchesQuery(query: string, ...fields: Array<string | undefined>): boolean {
  const needle = normalize(query.trim());
  if (!needle) return true;
  return fields.some((field) => field !== undefined && normalize(field).includes(needle));
}

export function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

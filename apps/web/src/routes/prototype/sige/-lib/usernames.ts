function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Initial of the first name + first surname + last 4 digits of the document (inventory 5.5). */
export function generateUsername(
  firstName: string,
  lastName: string,
  documentNumber: string,
  taken: ReadonlySet<string>,
): string {
  const first = slug(firstName).charAt(0);
  const surname = slug(lastName.trim().split(/\s+/)[0] ?? "");
  const digits = documentNumber.replace(/\D/g, "");
  if (!first || !surname || digits.length === 0) return "";
  const base = `${first}${surname}`;
  const start = Number(digits.slice(-4));
  let username = `${base}${digits.slice(-4)}`;
  let bump = 0;
  while (taken.has(username)) {
    bump += 1;
    username = `${base}${String((start + bump) % 10000).padStart(4, "0")}`;
  }
  return username;
}

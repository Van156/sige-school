/**
 * Pure username and placeholder-email rules for SIGE provisioning (foundation R1.19/R1.20,
 * OD-1, OD-25; module 03 §3.2). No better-auth or drizzle import so the web can reuse it.
 */

export class UsernameGenerationError extends Error {
  constructor() {
    super("No se pudo generar el nombre de usuario.");
    this.name = "UsernameGenerationError";
  }
}

/** Lowercase, accents stripped, everything outside `a-z0-9` removed. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Longest username better-auth is configured to accept (`maxUsernameLength` in `packages/auth`). */
export const MAX_USERNAME_LENGTH = 64;
/** Room kept for a `_N` collision suffix (underscore plus up to 7 digits). */
const SUFFIX_RESERVE = 8;
const DOCUMENT_SUFFIX_LENGTH = 4;

export type UsernameInput = {
  firstName: string;
  lastName: string;
  documentNumber: string;
};

/**
 * `initial(firstName) + lastName + last4(document)`; on collision appends `_2`, `_3`, ... until
 * free. Deterministic: `taken` is the only external input (compared case-insensitively).
 */
export function generateUsername(input: UsernameInput, taken: ReadonlySet<string>): string {
  const initial = slugify(input.firstName).slice(0, 1);
  const surname = slugify(input.lastName);
  if (!initial || !surname) {
    throw new UsernameGenerationError();
  }
  // Truncate the surname (never the initial or the digits) so base + `_N` always fits.
  const maxSurname = MAX_USERNAME_LENGTH - SUFFIX_RESERVE - initial.length - DOCUMENT_SUFFIX_LENGTH;
  const digits = slugify(input.documentNumber).slice(-DOCUMENT_SUFFIX_LENGTH);
  const base = `${initial}${surname.slice(0, maxSurname)}${digits}`;

  const takenLower = new Set([...taken].map((name) => name.toLowerCase()));
  if (!takenLower.has(base)) {
    return base;
  }
  for (let counter = 2; ; counter += 1) {
    const candidate = `${base}_${counter}`;
    if (!takenLower.has(candidate)) {
      return candidate;
    }
  }
}

/** Email stored for users without one: better-auth requires it, the person flags it (OD-1). */
export function placeholderEmail(username: string, organizationSlug: string): string {
  return `${username}@sin-correo.${organizationSlug}.invalid`;
}

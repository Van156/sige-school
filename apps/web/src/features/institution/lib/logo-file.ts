const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** The `accept` attribute of the logo input. */
export const LOGO_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

export const LOGO_FORMAT_MESSAGE = "Formato no permitido. Use PNG, JPG, JPEG, GIF o WEBP.";
export const LOGO_SIZE_MESSAGE = "El logo supera 2 MB.";

/**
 * Client-side pre-check of a logo (INS-R10): declared type and size, mirroring the server so an
 * obvious mistake fails before the upload. The server still sniffs the bytes and stays the
 * authority. Returns the Spanish message to show, or `null` when the file may be uploaded.
 */
export function validateLogoFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return LOGO_FORMAT_MESSAGE;
  }
  if (file.size > MAX_LOGO_BYTES) {
    return LOGO_SIZE_MESSAGE;
  }
  return null;
}

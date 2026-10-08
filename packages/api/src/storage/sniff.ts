/**
 * Content sniffing for uploaded images (INS-R10: the declared type is never trusted). Returns the
 * type implied by the leading bytes, or `null` when the bytes are not an allowed image.
 */
export type SniffedImage = {
  contentType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  extension: "png" | "jpg" | "gif" | "webp";
};

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((value, index) => bytes[offset + index] === value);

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

export function sniffImageType(bytes: Uint8Array): SniffedImage | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) {
    return { contentType: "image/gif", extension: "gif" };
  }
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

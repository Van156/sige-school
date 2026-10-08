import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

import type { FileStoragePort } from "../storage/port";
import { sniffImageType } from "../storage/sniff";

/**
 * Institution logo handling shared by the tenant (`institution.*`) and platform
 * (`institutionAdmin.*`) procedures (sige/02 §2.2, INS-R10). Replacing or clearing the logo reads
 * the previous value under a row lock, so two concurrent changes serialize and exactly one object
 * stays referenced; the superseded object is deleted best-effort after the commit.
 */

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const FORMAT_MESSAGE = "Formato no permitido. Use PNG, JPG, JPEG, GIF o WEBP.";
const SIZE_MESSAGE = "El logo supera 2 MB.";
export const INSTITUTION_NOT_FOUND = "La institución no existe.";

const badRequest = (message: string) => new ORPCError("BAD_REQUEST", { message });

export const requireStorage = (storage: FileStoragePort | undefined): FileStoragePort => {
  if (!storage) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "El almacenamiento de archivos no está configurado.",
    });
  }
  return storage;
};

const sha256Hex = async (bytes: Uint8Array) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

/** The storage key of one of this institution's logos, recovered from the stored URL. */
export function logoKeyFromUrl(url: string | null, organizationId: string): string | null {
  if (!url) return null;
  const prefix = `logos/${organizationId}/`;
  const index = url.lastIndexOf(prefix);
  if (index === -1) return null;
  const key = url.slice(index);
  return /^logos\/[A-Za-z0-9_-]+\/[0-9a-f]{64}\.(?:png|jpg|gif|webp)$/.test(key) ? key : null;
}

/** Deleting a superseded object is best-effort after the commit; a leftover object is harmless. */
export async function deleteLogoObject(
  storage: FileStoragePort | undefined,
  key: string | null,
): Promise<void> {
  if (!key || !storage) return;
  try {
    await storage.delete(key);
  } catch (error) {
    console.error("Could not delete an institution logo object", error);
  }
}

/** Validates the upload (size, declared type, sniffed bytes) and returns bytes plus sniffed type. */
async function readUpload(file: File) {
  if (file.size > MAX_LOGO_BYTES) throw badRequest(SIZE_MESSAGE);
  if (!ALLOWED_TYPES.has(file.type)) throw badRequest(FORMAT_MESSAGE);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_LOGO_BYTES) throw badRequest(SIZE_MESSAGE);
  // The declared type is never trusted (INS-R10): the stored type comes from the bytes.
  const sniffed = sniffImageType(bytes);
  if (!sniffed) throw badRequest(FORMAT_MESSAGE);
  return { bytes, sniffed };
}

/**
 * Stores the upload and points the organization at it. Returns the new URL and the key of the
 * object it superseded (null when none, or when the same bytes were uploaded again); the caller
 * audits and then calls `deleteLogoObject` with that key.
 */
export async function storeLogo(
  deps: { db: Database; storage: FileStoragePort | undefined },
  organizationId: string,
  file: File,
): Promise<{ url: string; supersededKey: string | null }> {
  const { bytes, sniffed } = await readUpload(file);
  const storage = requireStorage(deps.storage);
  const key = `logos/${organizationId}/${await sha256Hex(bytes)}.${sniffed.extension}`;
  const { url } = await storage.put(key, bytes, sniffed.contentType);

  let previous: string | null = null;
  try {
    previous = await deps.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ logo: schema.organization.logo })
        .from(schema.organization)
        .where(eq(schema.organization.id, organizationId))
        .for("update");
      if (!row) throw new ORPCError("NOT_FOUND", { message: INSTITUTION_NOT_FOUND });
      await tx
        .update(schema.organization)
        .set({ logo: url })
        .where(eq(schema.organization.id, organizationId));
      return row.logo;
    });
  } catch (error) {
    // The column still points elsewhere: the new object is unreferenced unless it is the old one.
    await deleteLogoObject(storage, key);
    throw error;
  }
  const supersededKey = logoKeyFromUrl(previous, organizationId);
  return { url, supersededKey: supersededKey === key ? null : supersededKey };
}

/** Clears the logo column under a row lock; `removed` is false when there was no logo. */
export async function clearLogo(
  db: Database,
  organizationId: string,
): Promise<{ removed: boolean; supersededKey: string | null }> {
  const previous = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ logo: schema.organization.logo })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .for("update");
    if (!row) throw new ORPCError("NOT_FOUND", { message: INSTITUTION_NOT_FOUND });
    if (!row.logo) return null;
    await tx
      .update(schema.organization)
      .set({ logo: null })
      .where(eq(schema.organization.id, organizationId));
    return row.logo;
  });
  return { removed: previous !== null, supersededKey: logoKeyFromUrl(previous, organizationId) };
}

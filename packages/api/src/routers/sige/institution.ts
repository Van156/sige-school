import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { changedFields, recordAudit } from "../../sige/audit";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { profileInput } from "../../sige/schemas/institution";
import type { Context } from "../../context";
import { sniffImageType } from "../../storage/sniff";

/**
 * `institution.*` (sige/02 §3.2, INS-06): the tenant's own profile, so no input carries an id.
 * `organization` holds name and logo; `institution_profile` holds the rest. An organization with
 * no profile row yet (T9 inserts one at creation) reads as empty fields plus the defaults and
 * `update` creates the row. The logo goes through `FileStoragePort` (§2.2, INS-R10).
 */

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const FORMAT_MESSAGE = "Formato no permitido. Use PNG, JPG, JPEG, GIF o WEBP.";
const SIZE_MESSAGE = "El logo supera 2 MB.";

const badRequest = (message: string) => new ORPCError("BAD_REQUEST", { message });

type ProfileDto = {
  name: string;
  logo: string | null;
  nit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  municipality: string | null;
  department: string | null;
  resolution: string | null;
  currentAcademicYear: string;
  timezone: string;
};

async function loadProfile(context: Context & { org: { id: string } }): Promise<ProfileDto> {
  const [org] = await context.db
    .select({ name: schema.organization.name, logo: schema.organization.logo })
    .from(schema.organization)
    .where(eq(schema.organization.id, context.org.id))
    .limit(1);
  if (!org) throw new ORPCError("NOT_FOUND", { message: "La institución no existe." });
  const [profile] = await context.db
    .select()
    .from(schema.institutionProfile)
    .where(eq(schema.institutionProfile.organizationId, context.org.id))
    .limit(1);
  return {
    name: org.name,
    logo: org.logo ?? null,
    nit: profile?.nit ?? null,
    phone: profile?.phone ?? null,
    email: profile?.email ?? null,
    address: profile?.address ?? null,
    municipality: profile?.municipality ?? null,
    department: profile?.department ?? null,
    resolution: profile?.resolution ?? null,
    currentAcademicYear: profile?.currentAcademicYear ?? String(new Date().getFullYear()),
    timezone: profile?.timezone ?? "America/Bogota",
  };
}

const sha256Hex = async (bytes: Uint8Array) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

/** The storage key of one of this institution's logos, recovered from the stored URL. */
function logoKeyFromUrl(url: string, organizationId: string): string | null {
  const prefix = `logos/${organizationId}/`;
  const index = url.lastIndexOf(prefix);
  if (index === -1) return null;
  const key = url.slice(index);
  return /^logos\/[A-Za-z0-9_-]+\/[0-9a-f]{64}\.(?:png|jpg|gif|webp)$/.test(key) ? key : null;
}

/** Deleting the superseded object is best-effort after the commit; a leftover object is harmless. */
async function deleteQuietly(context: Context, key: string | null): Promise<void> {
  if (!key || !context.fileStorage) return;
  try {
    await context.fileStorage.delete(key);
  } catch (error) {
    console.error("Could not delete a replaced institution logo", error);
  }
}

const requireStorage = (context: Context) => {
  if (!context.fileStorage) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "El almacenamiento de archivos no está configurado.",
    });
  }
  return context.fileStorage;
};

const logoInput = z.object({ logo: z.instanceof(File) });

export const institutionRouter = {
  get: sigeProcedure
    .use(requirePermission({ institution: ["read"] }))
    .handler(({ context }) => loadProfile(context)),

  update: sigeProcedure
    .use(requirePermission({ institution: ["update"] }))
    .input(profileInput)
    .handler(async ({ context, input }) => {
      const before = await loadProfile(context);
      const values = {
        nit: input.nit ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        municipality: input.municipality ?? null,
        department: input.department ?? null,
        resolution: input.resolution ?? null,
        currentAcademicYear: input.academicYear,
      };
      try {
        await context.db.transaction(async (tx) => {
          await tx
            .update(schema.organization)
            .set({ name: input.name })
            .where(eq(schema.organization.id, context.org.id));
          await tx
            .insert(schema.institutionProfile)
            .values({ organizationId: context.org.id, ...values })
            .onConflictDoUpdate({
              target: schema.institutionProfile.organizationId,
              set: { ...values, updatedAt: new Date() },
            });
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      const after = { name: input.name, ...values };
      const changed = Object.keys(changedFields(before, after));
      if (changed.length > 0) {
        await recordAudit(context, {
          action: "institution.profile_updated",
          targetType: "institution",
          targetId: context.org.id,
          metadata: { changed },
        });
      }
      return loadProfile(context);
    }),

  setLogo: sigeProcedure
    .use(requirePermission({ institution: ["update"] }))
    .input(logoInput)
    .handler(async ({ context, input }) => {
      const { logo: file } = input;
      if (file.size > MAX_LOGO_BYTES) throw badRequest(SIZE_MESSAGE);
      if (!ALLOWED_TYPES.has(file.type)) throw badRequest(FORMAT_MESSAGE);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length > MAX_LOGO_BYTES) throw badRequest(SIZE_MESSAGE);
      // The declared type is never trusted (INS-R10): the stored type comes from the bytes.
      const sniffed = sniffImageType(bytes);
      if (!sniffed) throw badRequest(FORMAT_MESSAGE);
      const storage = requireStorage(context);

      const key = `logos/${context.org.id}/${await sha256Hex(bytes)}.${sniffed.extension}`;
      const [current] = await context.db
        .select({ logo: schema.organization.logo })
        .from(schema.organization)
        .where(eq(schema.organization.id, context.org.id))
        .limit(1);
      const oldKey = current?.logo ? logoKeyFromUrl(current.logo, context.org.id) : null;

      const { url } = await storage.put(key, bytes, sniffed.contentType);
      try {
        await context.db
          .update(schema.organization)
          .set({ logo: url })
          .where(eq(schema.organization.id, context.org.id));
      } catch (error) {
        if (key !== oldKey) await deleteQuietly(context, key);
        throw error;
      }
      await recordAudit(context, {
        action: "institution.profile_updated",
        targetType: "institution",
        targetId: context.org.id,
        metadata: { changed: ["logo"] },
      });
      if (oldKey && oldKey !== key) await deleteQuietly(context, oldKey);
      return { logo: url };
    }),

  removeLogo: sigeProcedure
    .use(requirePermission({ institution: ["update"] }))
    .handler(async ({ context }) => {
      const [current] = await context.db
        .select({ logo: schema.organization.logo })
        .from(schema.organization)
        .where(eq(schema.organization.id, context.org.id))
        .limit(1);
      if (!current?.logo) return { logo: null };
      await context.db
        .update(schema.organization)
        .set({ logo: null })
        .where(eq(schema.organization.id, context.org.id));
      await recordAudit(context, {
        action: "institution.profile_updated",
        targetType: "institution",
        targetId: context.org.id,
        metadata: { changed: ["logo"] },
      });
      await deleteQuietly(context, logoKeyFromUrl(current.logo, context.org.id));
      return { logo: null };
    }),
};

import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { changedFields, recordAudit } from "../../sige/audit";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { clearLogo, deleteLogoObject, INSTITUTION_NOT_FOUND, storeLogo } from "../../sige/logo";
import { profileInput } from "../../sige/schemas/institution";
import type { Context } from "../../context";

/**
 * `institution.*` (sige/02 §3.2, INS-06): the tenant's own profile, so no input carries an id.
 * `organization` holds name and logo; `institution_profile` holds the rest. An organization with
 * no profile row yet (T9 inserts one at creation) reads as empty fields plus the defaults and
 * `update` creates the row. The logo goes through `FileStoragePort` (§2.2, INS-R10).
 */

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
  if (!org) throw new ORPCError("NOT_FOUND", { message: INSTITUTION_NOT_FOUND });
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
      const { url, supersededKey } = await storeLogo(
        { db: context.db, storage: context.fileStorage },
        context.org.id,
        input.logo,
      );
      await recordAudit(context, {
        action: "institution.profile_updated",
        targetType: "institution",
        targetId: context.org.id,
        metadata: { changed: ["logo"] },
      });
      await deleteLogoObject(context.fileStorage, supersededKey);
      return { logo: url };
    }),

  removeLogo: sigeProcedure
    .use(requirePermission({ institution: ["update"] }))
    .handler(async ({ context }) => {
      const { removed, supersededKey } = await clearLogo(context.db, context.org.id);
      if (!removed) return { logo: null };
      await recordAudit(context, {
        action: "institution.profile_updated",
        targetType: "institution",
        targetId: context.org.id,
        metadata: { changed: ["logo"] },
      });
      await deleteLogoObject(context.fileStorage, supersededKey);
      return { logo: null };
    }),
};

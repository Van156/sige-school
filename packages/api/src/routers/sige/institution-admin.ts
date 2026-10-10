import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { platformProcedure } from "../../index";
import { institutionListConfig } from "../../lib/institution-list-config";
import { createListInput } from "../../lib/list-input";
import type { Context } from "../../context";
import { changedFields } from "../../sige/audit";
import { createInstitution, InstitutionCreationError } from "../../sige/create-institution";
import {
  findInstitutionDetail,
  institutionStats,
  listInstitutionRows,
} from "../../sige/institution-queries";
import {
  clearLogo,
  deleteLogoObject,
  INSTITUTION_NOT_FOUND,
  logoKeyFromUrl,
  storeLogo,
} from "../../sige/logo";
import { HAS_DEPENDENTS, rethrowDbError } from "../../sige/pg-errors";
import { profileInput } from "../../sige/schemas/institution";

/**
 * Platform (root) institution procedures (sige/02 §3.1, INS-01/02/03). They have no tenant
 * context, so each takes the explicit institution `id`; permissions are platform statements
 * (`institution`), which no institution role holds (INS-R12).
 */

const text = (max: number) => z.string().trim().max(max);

/** `rectorInput` of sige/02 §3.1: provisionUser re-validates the same fields with Spanish messages. */
const rectorInput = z.object({
  firstName: text(100).min(1, "Los nombres son obligatorios."),
  lastName: text(100).min(1, "Los apellidos son obligatorios."),
  documentType: z.enum(["CC", "TI", "CE"], { message: "Tipo de documento inválido." }),
  documentNumber: text(20).min(5, "El documento debe tener al menos 5 caracteres."),
  email: text(254).pipe(z.email("Ingresa un correo válido.")),
  phone: text(30).optional(),
});

const idInput = z.object({ id: z.string().min(1) });
const listInput = createListInput(institutionListConfig);

/** `institutionFieldsInput`; on create the academic year may be left out (defaults to this year). */
const createInput = z.object({
  institution: profileInput.extend({ academicYear: profileInput.shape.academicYear.optional() }),
  admin: rectorInput,
});
const updateInput = profileInput.extend({ id: z.string().min(1) });
const logoInput = z.object({ id: z.string().min(1), logo: z.instanceof(File) });

const notFound = () => new ORPCError("NOT_FOUND", { message: INSTITUTION_NOT_FOUND });

export const INSTITUTION_HAS_RECORDS_MESSAGE =
  "La institución tiene estudiantes o notas registradas.";

type Tx = Parameters<Parameters<Context["db"]["transaction"]>[0]>[0];

/** sige/02 §4.2 institution dependents: students (any status); grade records join in module 06. */
async function hasAcademicRecords(tx: Tx, organizationId: string): Promise<boolean> {
  const [row] = await tx
    .select({ one: sql`1` })
    .from(schema.student)
    .where(eq(schema.student.organizationId, organizationId))
    .limit(1);
  return row !== undefined;
}

type PlatformContext = Context & { session: NonNullable<Context["session"]> };

const actorOf = (context: PlatformContext) => ({
  actorUserId: context.session.user.id,
  impersonatorUserId: context.session.session.impersonatedBy ?? null,
});

/** Org-scoped audit event of a platform operation; the operator is `actorUserId`. */
const recordOrganizationEvent = (
  context: PlatformContext,
  action: "organization.updated" | "organization.deleted",
  organization: { id: string; name: string; slug: string },
  metadata: Record<string, unknown> = {},
) =>
  context.auditLogger.record({
    scope: "organization",
    organizationId: organization.id,
    ...actorOf(context),
    action,
    targetType: "organization",
    targetId: organization.id,
    metadata: { organizationName: organization.name, slug: organization.slug, ...metadata },
  });

async function requireDetail(context: Context, id: string) {
  const detail = await findInstitutionDetail(context.db, id);
  if (!detail) throw notFound();
  return detail;
}

export const institutionAdminRouter = {
  /** INS-01 list: shared list contract; `institution:read` (D7, G-INS-1 resolved in foundation §4.2). */
  list: platformProcedure({ institution: ["read"] })
    .input(listInput)
    .handler(({ context, input }) => listInstitutionRows(context.db, input)),

  /** KPI tiles of INS-01. */
  stats: platformProcedure({ institution: ["update"] }).handler(({ context }) =>
    institutionStats(context.db),
  ),

  get: platformProcedure({ institution: ["update"] })
    .input(idInput)
    .handler(({ context, input }) => requireDetail(context, input.id)),

  /** INS-02: creates the institution, its profile and its rector (role `owner`) as one audited operation. */
  create: platformProcedure({ institution: ["create"] })
    .input(createInput)
    .handler(async ({ context, input }) => {
      const actor = {
        userId: context.session.user.id,
        impersonatorUserId: context.session.session.impersonatedBy ?? undefined,
      };
      const { name, ...profile } = input.institution;
      let created: Awaited<ReturnType<typeof createInstitution>>;
      try {
        created = await createInstitution(
          { database: context.db, auditLogger: context.auditLogger },
          { name, profile, rector: input.admin, actor },
        );
      } catch (error) {
        if (error instanceof InstitutionCreationError) {
          throw new ORPCError(error.code === "VALIDATION" ? "BAD_REQUEST" : "CONFLICT", {
            message: error.message,
          });
        }
        throw error;
      }
      return {
        institution: await requireDetail(context, created.institution.id),
        rector: created.rector,
      };
    }),

  /** INS-02 edit: name and profile in one transaction; the slug never changes. */
  update: platformProcedure({ institution: ["update"] })
    .input(updateInput)
    .handler(async ({ context, input }) => {
      const before = await requireDetail(context, input.id);
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
          const renamed = await tx
            .update(schema.organization)
            .set({ name: input.name })
            .where(eq(schema.organization.id, input.id))
            .returning({ id: schema.organization.id });
          // A concurrent delete won the race: nothing to update, nothing to audit.
          if (renamed.length === 0) throw notFound();
          await tx
            .insert(schema.institutionProfile)
            .values({ organizationId: input.id, ...values })
            .onConflictDoUpdate({
              target: schema.institutionProfile.organizationId,
              set: { ...values, updatedAt: new Date() },
            });
        });
      } catch (error) {
        if (error instanceof ORPCError) throw error;
        return rethrowDbError(error, "write");
      }
      const changed = Object.keys(
        changedFields(
          { ...before, currentAcademicYear: before.academicYear },
          { name: input.name, ...values },
        ),
      );
      if (changed.length > 0) {
        await recordOrganizationEvent(context, "organization.updated", before, {
          organizationName: input.name,
          changed,
        });
      }
      return requireDetail(context, input.id);
    }),

  setLogo: platformProcedure({ institution: ["update"] })
    .input(logoInput)
    .handler(async ({ context, input }) => {
      const organization = await requireDetail(context, input.id);
      const { url, supersededKey } = await storeLogo(
        { db: context.db, storage: context.fileStorage },
        input.id,
        input.logo,
      );
      await recordOrganizationEvent(context, "organization.updated", organization, {
        changed: ["logo"],
      });
      await deleteLogoObject(context.fileStorage, supersededKey);
      return { logo: url };
    }),

  removeLogo: platformProcedure({ institution: ["update"] })
    .input(idInput)
    .handler(async ({ context, input }) => {
      const organization = await requireDetail(context, input.id);
      const { removed, supersededKey } = await clearLogo(context.db, input.id);
      if (!removed) return { logo: null };
      await recordOrganizationEvent(context, "organization.updated", organization, {
        changed: ["logo"],
      });
      await deleteLogoObject(context.fileStorage, supersededKey);
      return { logo: null };
    }),

  /**
   * Refused while students or grade records exist (foundation §6.4, §4.2). The tenant tables
   * cascade from `organization`, so no FK blocks: the check runs under the organization row lock
   * (`FOR UPDATE`), which a concurrent student insert (its FK takes `FOR KEY SHARE`) must wait for,
   * so no student can slip in between the check and the delete. Only students exist so far;
   * module 06 adds grade records to `hasAcademicRecords`. The cascade removes the profile; the
   * logo object goes best-effort (INS-R4).
   */
  delete: platformProcedure({ institution: ["delete"] })
    .input(idInput)
    .handler(async ({ context, input }) => {
      const organization = await requireDetail(context, input.id);
      try {
        await context.db.transaction(async (tx) => {
          const byId = eq(schema.organization.id, input.id);
          const [locked] = await tx
            .select({ id: schema.organization.id })
            .from(schema.organization)
            .where(byId)
            .for("update");
          if (!locked) throw notFound();
          if (await hasAcademicRecords(tx, input.id)) {
            throw new ORPCError(HAS_DEPENDENTS, {
              status: 409,
              message: INSTITUTION_HAS_RECORDS_MESSAGE,
            });
          }
          await tx.delete(schema.organization).where(byId);
        });
      } catch (error) {
        if (error instanceof ORPCError) throw error;
        return rethrowDbError(error, "delete");
      }
      // The delete is committed, so the logo object goes whether or not the audit write succeeds;
      // an audit failure still surfaces to the caller. The event is written only after a
      // successful delete, so a lost race or a restrict FK leaves no stale event. The
      // organization reference is omitted: the FK would null it anyway, and the name/slug
      // snapshot plus targetId keep the row readable.
      try {
        await context.auditLogger.record({
          scope: "organization",
          organizationId: null,
          ...actorOf(context),
          action: "organization.deleted",
          targetType: "organization",
          targetId: organization.id,
          metadata: { organizationName: organization.name, slug: organization.slug },
        });
      } finally {
        await deleteLogoObject(context.fileStorage, logoKeyFromUrl(organization.logo, input.id));
      }
      return { deleted: true as const };
    }),

  /** INS-03: the rector (oldest owner) the web impersonates through the existing auth surface (OD-3). */
  manage: platformProcedure({ institution: ["update"] })
    .input(idInput)
    .handler(async ({ context, input }) => {
      const detail = await requireDetail(context, input.id);
      if (!detail.rector) {
        throw new ORPCError("NOT_FOUND", { message: "La institución no tiene un administrador." });
      }
      return { userId: detail.rector.userId };
    }),
};

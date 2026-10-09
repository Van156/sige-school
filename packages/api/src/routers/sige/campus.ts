import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { changedFields, recordAudit } from "../../sige/audit";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { campusInput } from "../../sige/schemas/institution";

/**
 * `campus.*` (sige/02 §3.3, INS-07/08). The tenant comes from `context.org`, never from input;
 * another tenant's id is `NOT_FOUND`. One main campus per institution is enforced by the partial
 * unique index (INS-R2): a violation maps to `CONFLICT`, with no automatic swap. Deletes rely on
 * the `restrict` FKs (`HAS_DEPENDENTS`, §4.2), never on a racy pre-check.
 */

const idInput = z.object({ id: z.string().min(1) });
const updateInput = campusInput.extend({ id: z.string().min(1) });

const notFound = () => new ORPCError("NOT_FOUND", { message: "La sede no existe." });

const rowColumns = {
  id: schema.campus.id,
  name: schema.campus.name,
  code: schema.campus.code,
  address: schema.campus.address,
  jornada: schema.campus.jornada,
  isMain: schema.campus.isMain,
  active: schema.campus.active,
  createdAt: schema.campus.createdAt,
};

async function courseCount(
  db: Database,
  organizationId: string,
  campusId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(schema.course)
    .where(
      and(eq(schema.course.organizationId, organizationId), eq(schema.course.campusId, campusId)),
    );
  return row?.total ?? 0;
}

async function findCampus(db: Database, organizationId: string, id: string) {
  const [row] = await db
    .select({ ...rowColumns })
    .from(schema.campus)
    .where(and(eq(schema.campus.organizationId, organizationId), eq(schema.campus.id, id)))
    .limit(1);
  return row ?? null;
}

async function toRow(db: Database, organizationId: string, id: string) {
  const row = await findCampus(db, organizationId, id);
  if (!row) throw notFound();
  return { ...row, courseCount: await courseCount(db, organizationId, id) };
}

const AUDITED_FIELDS = ["name", "code", "address", "jornada", "isMain", "active"] as const;
const pickAudited = (row: Record<string, unknown>) =>
  Object.fromEntries(AUDITED_FIELDS.map((field) => [field, row[field] ?? null]));

/** Optional text left out of a full-replace update clears the column. */
const columnsFrom = (input: z.infer<typeof campusInput>) => ({
  name: input.name,
  code: input.code ?? null,
  address: input.address ?? null,
  jornada: input.jornada,
  isMain: input.isMain,
  active: input.active,
});

export const campusRouter = {
  /** Client-list mode (R3.9): bounded, main campus first, then by name; inactive ones included. */
  list: sigeProcedure.use(requirePermission({ campus: ["read"] })).handler(async ({ context }) => {
    const rows = await context.db
      .select({ ...rowColumns, courseCount: count(schema.course.id) })
      .from(schema.campus)
      .leftJoin(
        schema.course,
        and(
          eq(schema.course.organizationId, schema.campus.organizationId),
          eq(schema.course.campusId, schema.campus.id),
        ),
      )
      .where(eq(schema.campus.organizationId, context.org.id))
      .groupBy(schema.campus.id)
      .orderBy(desc(schema.campus.isMain), asc(schema.campus.name));
    return rows;
  }),

  /** Active campuses for new-course/classroom/student selects (INS-R3). */
  options: sigeProcedure.use(requirePermission({ campus: ["read"] })).handler(({ context }) =>
    context.db
      .select({
        id: schema.campus.id,
        name: schema.campus.name,
        isMain: schema.campus.isMain,
      })
      .from(schema.campus)
      .where(and(eq(schema.campus.organizationId, context.org.id), eq(schema.campus.active, true)))
      .orderBy(desc(schema.campus.isMain), asc(schema.campus.name)),
  ),

  get: sigeProcedure
    .use(requirePermission({ campus: ["read"] }))
    .input(idInput)
    .handler(({ context, input }) => toRow(context.db, context.org.id, input.id)),

  create: sigeProcedure
    .use(requirePermission({ campus: ["create"] }))
    .input(campusInput)
    .handler(async ({ context, input }) => {
      const values = columnsFrom(input);
      let id: string;
      try {
        const [row] = await context.db
          .insert(schema.campus)
          .values({ organizationId: context.org.id, ...values })
          .returning({ id: schema.campus.id });
        if (!row) throw new Error("Campus insert returned no row.");
        id = row.id;
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "campus.created",
        targetType: "campus",
        targetId: id,
        metadata: { after: pickAudited(values) },
      });
      return toRow(context.db, context.org.id, id);
    }),

  update: sigeProcedure
    .use(requirePermission({ campus: ["update"] }))
    .input(updateInput)
    .handler(async ({ context, input }) => {
      const before = await findCampus(context.db, context.org.id, input.id);
      if (!before) throw notFound();
      const values = columnsFrom(input);
      try {
        const affected = await context.db
          .update(schema.campus)
          .set(values)
          .where(
            and(eq(schema.campus.organizationId, context.org.id), eq(schema.campus.id, input.id)),
          )
          .returning({ id: schema.campus.id });
        if (affected.length === 0) throw notFound();
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "campus.updated",
        targetType: "campus",
        targetId: input.id,
        metadata: { name: values.name, changes: changedFields(pickAudited(before), values) },
      });
      return toRow(context.db, context.org.id, input.id);
    }),

  delete: sigeProcedure
    .use(requirePermission({ campus: ["delete"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      const before = await findCampus(context.db, context.org.id, input.id);
      if (!before) throw notFound();
      try {
        const affected = await context.db
          .delete(schema.campus)
          .where(
            and(eq(schema.campus.organizationId, context.org.id), eq(schema.campus.id, input.id)),
          )
          .returning({ id: schema.campus.id });
        if (affected.length === 0) throw notFound();
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "campus.deleted",
        targetType: "campus",
        targetId: input.id,
        metadata: { snapshot: { name: before.name, code: before.code } },
      });
      return { deleted: true as const };
    }),
};

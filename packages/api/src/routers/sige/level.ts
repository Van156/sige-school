import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { changedFields, recordAudit } from "../../sige/audit";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { levelInput } from "../../sige/schemas/institution";

/**
 * `level.*` (sige/02 §3.3, INS-09/10). A level's campus is immutable (INS-R6): `update` takes no
 * `campusId`. A level created under a missing or foreign campus fails the composite tenant-safe FK
 * and maps to `NOT_FOUND`. Delete is blocked by courses through the `restrict` FK.
 */

const idInput = z.object({ id: z.string().min(1) });
const listInput = z.object({ campusId: z.string().min(1).optional() });
const updateInput = levelInput.omit({ campusId: true }).extend({ id: z.string().min(1) });

const notFound = () => new ORPCError("NOT_FOUND", { message: "El nivel no existe." });

/** Level rows with campus name and course count, scoped to the tenant plus an optional filter. */
function levelRows(db: Database, organizationId: string, extra?: SQL) {
  return db
    .select({
      id: schema.gradeLevel.id,
      campusId: schema.gradeLevel.campusId,
      campusName: schema.campus.name,
      name: schema.gradeLevel.name,
      orderNum: schema.gradeLevel.orderNum,
      courseCount: count(schema.course.id),
    })
    .from(schema.gradeLevel)
    .innerJoin(
      schema.campus,
      and(
        eq(schema.campus.organizationId, schema.gradeLevel.organizationId),
        eq(schema.campus.id, schema.gradeLevel.campusId),
      ),
    )
    .leftJoin(
      schema.course,
      and(
        eq(schema.course.organizationId, schema.gradeLevel.organizationId),
        eq(schema.course.levelId, schema.gradeLevel.id),
      ),
    )
    .where(and(eq(schema.gradeLevel.organizationId, organizationId), extra))
    .groupBy(schema.gradeLevel.id, schema.campus.name)
    .orderBy(asc(schema.campus.name), asc(schema.gradeLevel.orderNum), asc(schema.gradeLevel.name));
}

async function toRow(db: Database, organizationId: string, id: string) {
  const [row] = await levelRows(db, organizationId, eq(schema.gradeLevel.id, id));
  if (!row) throw notFound();
  return row;
}

export const levelRouter = {
  /** Client-list mode (R3.9), optionally for one campus. */
  list: sigeProcedure
    .use(requirePermission({ level: ["read"] }))
    .input(listInput)
    .handler(({ context, input }) =>
      levelRows(
        context.db,
        context.org.id,
        input.campusId ? eq(schema.gradeLevel.campusId, input.campusId) : undefined,
      ),
    ),

  create: sigeProcedure
    .use(requirePermission({ level: ["create"] }))
    .input(levelInput)
    .handler(async ({ context, input }) => {
      let id: string;
      try {
        const [row] = await context.db
          .insert(schema.gradeLevel)
          .values({ organizationId: context.org.id, ...input })
          .returning({ id: schema.gradeLevel.id });
        if (!row) throw new Error("Level insert returned no row.");
        id = row.id;
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "level.created",
        targetType: "level",
        targetId: id,
        metadata: { after: input },
      });
      return toRow(context.db, context.org.id, id);
    }),

  update: sigeProcedure
    .use(requirePermission({ level: ["update"] }))
    .input(updateInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      const values = { name: input.name, orderNum: input.orderNum };
      try {
        const affected = await context.db
          .update(schema.gradeLevel)
          .set(values)
          .where(
            and(
              eq(schema.gradeLevel.organizationId, context.org.id),
              eq(schema.gradeLevel.id, input.id),
            ),
          )
          .returning({ id: schema.gradeLevel.id });
        if (affected.length === 0) throw notFound();
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "level.updated",
        targetType: "level",
        targetId: input.id,
        metadata: {
          name: values.name,
          changes: changedFields({ name: before.name, orderNum: before.orderNum }, values),
        },
      });
      return toRow(context.db, context.org.id, input.id);
    }),

  delete: sigeProcedure
    .use(requirePermission({ level: ["delete"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      try {
        const affected = await context.db
          .delete(schema.gradeLevel)
          .where(
            and(
              eq(schema.gradeLevel.organizationId, context.org.id),
              eq(schema.gradeLevel.id, input.id),
            ),
          )
          .returning({ id: schema.gradeLevel.id });
        if (affected.length === 0) throw notFound();
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "level.deleted",
        targetType: "level",
        targetId: input.id,
        metadata: { snapshot: { name: before.name, campusId: before.campusId } },
      });
      return { deleted: true as const };
    }),
};

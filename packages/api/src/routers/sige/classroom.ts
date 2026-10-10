import type { Database } from "@base-template/db";
import { buildListQuery } from "@base-template/db/lib/list-query";
import type { ListColumns } from "@base-template/db/lib/list-query";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { classroomListConfig } from "../../lib/classroom-list-config";
import { createListInput } from "../../lib/list-input";
import { changedFields, recordAudit } from "../../sige/audit";
import { assertActiveCampus } from "../../sige/campus-rules";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { classroomInput } from "../../sige/schemas/scheduling";

/**
 * `classroom.*` (sige/04 §3.4, SCH-07/08). Server list mode (R3.8) with the allowlists of
 * `classroom-list-config.ts`. The tenant comes from `context.org`; another tenant's id is
 * `NOT_FOUND`. The campus must exist and be active (SCH-R12, checked under a share lock so it
 * cannot be deactivated mid-write) and is immutable once the classroom has slots. Code uniqueness
 * is the unique index (`CONFLICT`); a delete is refused by the `restrict` FK from the slots
 * (`HAS_DEPENDENTS`), never by a racy pre-check.
 */

const idInput = z.object({ id: z.string().min(1) });
const updateInput = classroomInput.extend({ id: z.string().min(1) });
const listInput = createListInput(classroomListConfig);

const notFound = () => new ORPCError("NOT_FOUND", { message: "El salón no existe." });

/** Authored (not in sige/04 §4.1): the campus of a classroom with slots cannot change. */
const CAMPUS_LOCKED_MESSAGE = "No se puede cambiar la sede de un salón con clases programadas.";

const rowColumns = {
  id: schema.classroom.id,
  campusId: schema.classroom.campusId,
  campusName: schema.campus.name,
  name: schema.classroom.name,
  code: schema.classroom.code,
  capacity: schema.classroom.capacity,
  floor: schema.classroom.floor,
  building: schema.classroom.building,
  classroomType: schema.classroom.classroomType,
  resources: schema.classroom.resources,
};

/** List-input ids to columns; the only way a client id reaches SQL. */
const LIST_COLUMNS = {
  name: schema.classroom.name,
  code: schema.classroom.code,
  campus: schema.campus.name,
  type: schema.classroom.classroomType,
  capacity: schema.classroom.capacity,
  campusId: schema.classroom.campusId,
} as const satisfies ListColumns;

/** Classroom rows with the campus name, scoped to one institution. */
const selectRows = (db: Pick<Database, "select">, organizationId: string) =>
  db
    .select(rowColumns)
    .from(schema.classroom)
    .innerJoin(
      schema.campus,
      and(
        eq(schema.campus.organizationId, schema.classroom.organizationId),
        eq(schema.campus.id, schema.classroom.campusId),
      ),
    )
    .$dynamic()
    .where(eq(schema.classroom.organizationId, organizationId));

const byId = (organizationId: string, id: string) =>
  and(eq(schema.classroom.organizationId, organizationId), eq(schema.classroom.id, id));

async function toRow(db: Pick<Database, "select">, organizationId: string, id: string) {
  const [row] = await selectRows(db, organizationId).where(byId(organizationId, id)).limit(1);
  if (!row) throw notFound();
  return row;
}

const AUDITED_FIELDS = [
  "campusId",
  "name",
  "code",
  "capacity",
  "floor",
  "building",
  "classroomType",
] as const;

/** Audit view of a classroom; `resources` is compared as JSON so reference equality never lies. */
const auditView = (row: Record<string, unknown>) => ({
  ...Object.fromEntries(AUDITED_FIELDS.map((field) => [field, row[field] ?? null])),
  resources: row.resources == null ? null : JSON.stringify(row.resources),
});

/** Optional values left out of a full-replace update clear the column. */
const columnsFrom = (input: z.infer<typeof classroomInput>) => ({
  campusId: input.campusId,
  name: input.name,
  code: input.code,
  capacity: input.capacity,
  floor: input.floor,
  building: input.building ?? null,
  classroomType: input.classroomType,
  resources: input.resources ?? null,
});

export const classroomRouter = {
  /** Server-list mode (R3.8): `{ rows, total }`; `total` ignores paging. */
  list: sigeProcedure
    .use(requirePermission({ classroom: ["read"] }))
    .input(listInput)
    .handler(async ({ context, input }) => {
      const query = buildListQuery({
        columns: LIST_COLUMNS,
        input,
        tieBreakers: [schema.classroom.id],
      });
      const scope = and(eq(schema.classroom.organizationId, context.org.id), query.where);
      const [rows, [totalRow]] = await Promise.all([
        selectRows(context.db, context.org.id)
          .where(scope)
          .orderBy(...query.orderBy)
          .limit(query.limit)
          .offset(query.offset),
        // The `campus` filter/sort ids only reach the joined name; the count joins it as well.
        context.db
          .select({ total: count() })
          .from(schema.classroom)
          .innerJoin(
            schema.campus,
            and(
              eq(schema.campus.organizationId, schema.classroom.organizationId),
              eq(schema.campus.id, schema.classroom.campusId),
            ),
          )
          .where(scope),
      ]);
      return { rows, total: totalRow?.total ?? 0 };
    }),

  stats: sigeProcedure
    .use(requirePermission({ classroom: ["read"] }))
    .handler(async ({ context }) => {
      const [row] = await context.db
        .select({
          total: count(),
          aulas: sql<number>`count(*) filter (where ${schema.classroom.classroomType} = 'aula')::int`,
          laboratorios: sql<number>`count(*) filter (where ${schema.classroom.classroomType} = 'laboratorio')::int`,
        })
        .from(schema.classroom)
        .where(eq(schema.classroom.organizationId, context.org.id));
      return {
        total: row?.total ?? 0,
        aulas: row?.aulas ?? 0,
        laboratorios: row?.laboratorios ?? 0,
      };
    }),

  get: sigeProcedure
    .use(requirePermission({ classroom: ["read"] }))
    .input(idInput)
    .handler(({ context, input }) => toRow(context.db, context.org.id, input.id)),

  create: sigeProcedure
    .use(requirePermission({ classroom: ["create"] }))
    .input(classroomInput)
    .handler(async ({ context, input }) => {
      const values = columnsFrom(input);
      let id: string;
      try {
        id = await context.db.transaction(async (tx) => {
          await assertActiveCampus(tx, context.org.id, values.campusId);
          const [row] = await tx
            .insert(schema.classroom)
            .values({ organizationId: context.org.id, ...values })
            .returning({ id: schema.classroom.id });
          if (!row) throw new Error("Classroom insert returned no row.");
          return row.id;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "classroom.created",
        targetType: "classroom",
        targetId: id,
        metadata: { after: auditView(values) },
      });
      return toRow(context.db, context.org.id, id);
    }),

  update: sigeProcedure
    .use(requirePermission({ classroom: ["update"] }))
    .input(updateInput)
    .handler(async ({ context, input }) => {
      const values = columnsFrom(input);
      let before: Record<string, unknown>;
      try {
        before = await context.db.transaction(async (tx) => {
          // The row lock conflicts with the key-share lock a slot insert takes on its classroom, so
          // "has slots" cannot change between the check and the update.
          const [current] = await tx
            .select()
            .from(schema.classroom)
            .where(byId(context.org.id, input.id))
            .for("update");
          if (!current) throw notFound();
          if (current.campusId !== values.campusId) {
            const [slot] = await tx
              .select({ id: schema.scheduleSlot.id })
              .from(schema.scheduleSlot)
              .where(
                and(
                  eq(schema.scheduleSlot.organizationId, context.org.id),
                  eq(schema.scheduleSlot.classroomId, input.id),
                ),
              )
              .limit(1);
            if (slot)
              throw new ORPCError("CONFLICT", { status: 409, message: CAMPUS_LOCKED_MESSAGE });
            await assertActiveCampus(tx, context.org.id, values.campusId);
          }
          await tx.update(schema.classroom).set(values).where(byId(context.org.id, input.id));
          return current;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "classroom.updated",
        targetType: "classroom",
        targetId: input.id,
        metadata: {
          name: values.name,
          changes: changedFields(auditView(before), auditView(values)),
        },
      });
      return toRow(context.db, context.org.id, input.id);
    }),

  delete: sigeProcedure
    .use(requirePermission({ classroom: ["delete"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      try {
        const affected = await context.db
          .delete(schema.classroom)
          .where(byId(context.org.id, input.id))
          .returning({ id: schema.classroom.id });
        if (affected.length === 0) throw notFound();
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "classroom.deleted",
        targetType: "classroom",
        targetId: input.id,
        metadata: { snapshot: { name: before.name, code: before.code } },
      });
      return { deleted: true as const };
    }),
};

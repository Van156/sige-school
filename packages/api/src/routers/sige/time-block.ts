import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { currentAcademicYear } from "../../sige/academic-year";
import { changedFields, recordAudit } from "../../sige/audit";
import { assertActiveCampus } from "../../sige/campus-rules";
import { HAS_DEPENDENTS, rethrowDbError, TIME_BLOCK_IN_USE_MESSAGE } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { timeBlockInput, timeBlockShiftSchema } from "../../sige/schemas/scheduling";

/**
 * `timeBlock.*` (sige/04 §3.4, SCH-09/10, SCH-R11/R12). The list is bounded by campus, shift and
 * year (default: the institution's current year) and read in `order_num` order. A block's year is
 * the institution's current year at creation and never changes (D6). Name uniqueness is the
 * unique index (`CONFLICT`); the overlap rule has no constraint, so every write takes an
 * institution-wide advisory lock and checks it inside the same transaction. A block is "in use"
 * when an active slot of a course of its campus and shift, in its year, has exactly its start and
 * end time (there is no FK, sige/04 §4.2): such a block cannot be re-timed (`CONFLICT`) or deleted
 * (`HAS_DEPENDENTS`).
 */

const idInput = z.object({ id: z.string().min(1) });
const updateInput = z.intersection(z.object({ id: z.string().min(1) }), timeBlockInput);
const listInput = z
  .object({
    campusId: z.string().min(1).optional(),
    shift: timeBlockShiftSchema.optional(),
    academicYear: z.string().min(1).optional(),
  })
  .default({});

/** Most rows a list returns: 4 shifts x ~25 blocks x campuses stays far below this. */
const LIST_LIMIT = 500;

const notFound = () => new ORPCError("NOT_FOUND", { message: "El bloque no existe." });

/** SCH-R11. */
const RETIME_IN_USE_MESSAGE =
  "No se pueden cambiar los horarios de un bloque con clases programadas.";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Time columns come back as `HH:MM:SS`; the API speaks `HH:MM`. */
const hhmm = (column: typeof schema.timeBlock.startTime) =>
  sql<string>`to_char(${column}, 'HH24:MI')`;

const slotUsesBlock = (block: {
  organizationId: unknown;
  campusId: unknown;
  shift: unknown;
  academicYear: unknown;
  startTime: unknown;
  endTime: unknown;
}) => sql`exists (
  select 1 from ${schema.scheduleSlot}
  inner join ${schema.course}
    on ${schema.course.organizationId} = ${schema.scheduleSlot.organizationId}
    and ${schema.course.id} = ${schema.scheduleSlot.courseId}
  where ${schema.scheduleSlot.organizationId} = ${block.organizationId}
    and ${schema.scheduleSlot.isActive}
    and ${schema.scheduleSlot.academicYear} = ${block.academicYear}
    and ${schema.scheduleSlot.startTime} = ${block.startTime}
    and ${schema.scheduleSlot.endTime} = ${block.endTime}
    and ${schema.course.campusId} = ${block.campusId}
    and ${schema.course.shift}::text = ${block.shift}::text
)`;

const rowColumns = {
  id: schema.timeBlock.id,
  campusId: schema.timeBlock.campusId,
  campusName: schema.campus.name,
  name: schema.timeBlock.name,
  shift: schema.timeBlock.shift,
  startTime: hhmm(schema.timeBlock.startTime),
  endTime: hhmm(schema.timeBlock.endTime),
  isBreak: schema.timeBlock.isBreak,
  orderNum: schema.timeBlock.orderNum,
  academicYear: schema.timeBlock.academicYear,
  inUse: sql<boolean>`${slotUsesBlock(schema.timeBlock)}`,
};

const selectRows = (db: Pick<Database, "select">, organizationId: string) =>
  db
    .select(rowColumns)
    .from(schema.timeBlock)
    .innerJoin(
      schema.campus,
      and(
        eq(schema.campus.organizationId, schema.timeBlock.organizationId),
        eq(schema.campus.id, schema.timeBlock.campusId),
      ),
    )
    .$dynamic()
    .where(eq(schema.timeBlock.organizationId, organizationId));

const byId = (organizationId: string, id: string) =>
  and(eq(schema.timeBlock.organizationId, organizationId), eq(schema.timeBlock.id, id));

async function toRow(db: Pick<Database, "select">, organizationId: string, id: string) {
  const [row] = await selectRows(db, organizationId).where(byId(organizationId, id)).limit(1);
  if (!row) throw notFound();
  return row;
}

const AUDITED_FIELDS = [
  "campusId",
  "name",
  "shift",
  "startTime",
  "endTime",
  "isBreak",
  "orderNum",
] as const;
const auditView = (row: Record<string, unknown>) =>
  Object.fromEntries(AUDITED_FIELDS.map((field) => [field, row[field] ?? null]));

/** Serialises every block write of the institution: overlap has no constraint to arbitrate. */
async function lockBlockWrites(tx: Tx, organizationId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:time_block`}, 0))`,
  );
}

/** SCH-10: no overlap with another block of the same campus, shift and year (half-open). */
async function assertNoOverlap(
  tx: Tx,
  organizationId: string,
  block: {
    campusId: string;
    shift: string;
    academicYear: string;
    startTime: string;
    endTime: string;
  },
  excludeId?: string,
) {
  const [clash] = await tx
    .select({ name: schema.timeBlock.name })
    .from(schema.timeBlock)
    .where(
      and(
        eq(schema.timeBlock.organizationId, organizationId),
        eq(schema.timeBlock.campusId, block.campusId),
        sql`${schema.timeBlock.shift}::text = ${block.shift}`,
        eq(schema.timeBlock.academicYear, block.academicYear),
        excludeId ? ne(schema.timeBlock.id, excludeId) : undefined,
        lt(schema.timeBlock.startTime, block.endTime),
        gt(schema.timeBlock.endTime, block.startTime),
      ),
    )
    .orderBy(asc(schema.timeBlock.orderNum), asc(schema.timeBlock.id))
    .limit(1);
  if (clash) {
    throw new ORPCError("CONFLICT", {
      status: 409,
      message: `El bloque se superpone con ${clash.name}.`,
    });
  }
}

async function isInUse(tx: Tx, block: typeof schema.timeBlock.$inferSelect): Promise<boolean> {
  const result = await tx.execute(
    sql`select ${slotUsesBlock({
      organizationId: block.organizationId,
      campusId: block.campusId,
      shift: block.shift,
      academicYear: block.academicYear,
      startTime: block.startTime,
      endTime: block.endTime,
    })} as in_use`,
  );
  return result.rows[0]?.in_use === true;
}

/** Locks the block row; the in-use check and the write then see one consistent state. */
async function lockBlock(tx: Tx, organizationId: string, id: string) {
  const [current] = await tx
    .select()
    .from(schema.timeBlock)
    .where(byId(organizationId, id))
    .for("update");
  if (!current) throw notFound();
  return current;
}

export const timeBlockRouter = {
  /** Bounded to `LIST_LIMIT` rows, ordered by campus, shift and `order_num`. */
  list: sigeProcedure
    .use(requirePermission({ time_block: ["read"] }))
    .input(listInput)
    .handler(async ({ context, input }) => {
      const year = input.academicYear ?? (await currentAcademicYear(context.db, context.org.id));
      return selectRows(context.db, context.org.id)
        .where(
          and(
            eq(schema.timeBlock.organizationId, context.org.id),
            eq(schema.timeBlock.academicYear, year),
            input.campusId ? eq(schema.timeBlock.campusId, input.campusId) : undefined,
            input.shift ? eq(schema.timeBlock.shift, input.shift) : undefined,
          ),
        )
        .orderBy(
          asc(schema.campus.name),
          asc(schema.campus.id),
          asc(schema.timeBlock.shift),
          asc(schema.timeBlock.orderNum),
          asc(schema.timeBlock.id),
        )
        .limit(LIST_LIMIT);
    }),

  get: sigeProcedure
    .use(requirePermission({ time_block: ["read"] }))
    .input(idInput)
    .handler(({ context, input }) => toRow(context.db, context.org.id, input.id)),

  create: sigeProcedure
    .use(requirePermission({ time_block: ["create"] }))
    .input(timeBlockInput)
    .handler(async ({ context, input }) => {
      let id: string;
      try {
        id = await context.db.transaction(async (tx) => {
          await lockBlockWrites(tx, context.org.id);
          await assertActiveCampus(tx, context.org.id, input.campusId);
          const academicYear = await currentAcademicYear(tx, context.org.id);
          await assertNoOverlap(tx, context.org.id, { ...input, academicYear });
          const [row] = await tx
            .insert(schema.timeBlock)
            .values({ organizationId: context.org.id, ...input, academicYear })
            .returning({ id: schema.timeBlock.id });
          if (!row) throw new Error("Time block insert returned no row.");
          return row.id;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "time_block.created",
        targetType: "time_block",
        targetId: id,
        metadata: { after: auditView(input) },
      });
      return toRow(context.db, context.org.id, id);
    }),

  update: sigeProcedure
    .use(requirePermission({ time_block: ["update"] }))
    .input(updateInput)
    .handler(async ({ context, input }) => {
      const { id, ...values } = input;
      let before: Record<string, unknown>;
      try {
        before = await context.db.transaction(async (tx) => {
          await lockBlockWrites(tx, context.org.id);
          const current = await lockBlock(tx, context.org.id, id);
          const view = {
            ...current,
            startTime: current.startTime.slice(0, 5),
            endTime: current.endTime.slice(0, 5),
          };
          const retimed =
            view.campusId !== values.campusId ||
            view.shift !== values.shift ||
            view.startTime !== values.startTime ||
            view.endTime !== values.endTime;
          if (retimed && (await isInUse(tx, current))) {
            throw new ORPCError("CONFLICT", { status: 409, message: RETIME_IN_USE_MESSAGE });
          }
          if (view.campusId !== values.campusId) {
            await assertActiveCampus(tx, context.org.id, values.campusId);
          }
          await assertNoOverlap(
            tx,
            context.org.id,
            { ...values, academicYear: current.academicYear },
            id,
          );
          await tx.update(schema.timeBlock).set(values).where(byId(context.org.id, id));
          return view;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "time_block.updated",
        targetType: "time_block",
        targetId: id,
        metadata: {
          name: values.name,
          changes: changedFields(auditView(before), auditView(values)),
        },
      });
      return toRow(context.db, context.org.id, id);
    }),

  delete: sigeProcedure
    .use(requirePermission({ time_block: ["delete"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      let snapshot: { name: string; shift: string; academicYear: string };
      try {
        snapshot = await context.db.transaction(async (tx) => {
          await lockBlockWrites(tx, context.org.id);
          const current = await lockBlock(tx, context.org.id, input.id);
          if (await isInUse(tx, current)) {
            throw new ORPCError(HAS_DEPENDENTS, {
              status: 409,
              message: TIME_BLOCK_IN_USE_MESSAGE,
            });
          }
          await tx.delete(schema.timeBlock).where(byId(context.org.id, input.id));
          return { name: current.name, shift: current.shift, academicYear: current.academicYear };
        });
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "time_block.deleted",
        targetType: "time_block",
        targetId: input.id,
        metadata: { snapshot },
      });
      return { deleted: true as const };
    }),
};

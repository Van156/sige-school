import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { PERIOD_ORDER_MAX, periodsOverlap } from "@base-template/sige-core";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { changedFields, recordAudit } from "../../sige/audit";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { periodInput } from "../../sige/schemas/institution";

/**
 * `period.*` (sige/02 §3.3, INS-15/16, INS-R5, INS-R9). Every write that can touch the active flag
 * or the date ranges runs in a transaction that first takes a per-institution advisory lock, then
 * locks the institution's periods `for update`: the lock serializes concurrent writers even when
 * the institution has no period yet (nothing to row-lock), so the overlap check and the
 * active-period swap cannot interleave. The partial unique index stays the last line of defence.
 */

const idInput = z.object({ id: z.string().min(1) });
const listInput = z.object({ academicYear: z.string().optional() }).default({});
const updateInput = periodInput.and(z.object({ id: z.string().min(1) }));

const notFound = () => new ORPCError("NOT_FOUND", { message: "El periodo no existe." });
const conflict = (message: string) => new ORPCError("CONFLICT", { status: 409, message });

const MUST_KEEP_ACTIVE = "Debe haber un periodo activo. Active otro periodo para cambiar.";

const rowColumns = {
  id: schema.academicPeriod.id,
  academicYear: schema.academicPeriod.academicYear,
  orderNum: schema.academicPeriod.orderNum,
  name: schema.academicPeriod.name,
  shortName: schema.academicPeriod.shortName,
  startDate: schema.academicPeriod.startDate,
  endDate: schema.academicPeriod.endDate,
  isActive: schema.academicPeriod.isActive,
};

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type PeriodRow = {
  id: string;
  academicYear: string;
  orderNum: number;
  name: string;
  shortName: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};
type PeriodValues = Omit<PeriodRow, "id">;

const byId = (organizationId: string, id: string) =>
  and(eq(schema.academicPeriod.organizationId, organizationId), eq(schema.academicPeriod.id, id));

const valuesFrom = (input: z.infer<typeof periodInput>): PeriodValues => ({
  academicYear: input.academicYear,
  orderNum: input.orderNum,
  name: input.name,
  shortName: input.shortName,
  startDate: input.startDate,
  endDate: input.endDate,
  isActive: input.isActive,
});

/** Serializes writers of one institution's periods and locks its rows. Returns them all. */
async function lockPeriods(tx: Tx, organizationId: string): Promise<PeriodRow[]> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`academic_period:${organizationId}`}))`,
  );
  return tx
    .select(rowColumns)
    .from(schema.academicPeriod)
    .where(eq(schema.academicPeriod.organizationId, organizationId))
    .for("update");
}

/** INS-R9: closed-range overlap within the target academic year, ignoring the period itself. */
function assertNoOverlap(periods: PeriodRow[], values: PeriodValues, selfId: string | null) {
  const clash = periods.find((other) => other.id !== selfId && periodsOverlap(other, values));
  if (clash) throw conflict(`Las fechas se superponen con el periodo ${clash.name}.`);
}

async function toRow(db: Database, organizationId: string, id: string): Promise<PeriodRow> {
  const [row] = await db
    .select(rowColumns)
    .from(schema.academicPeriod)
    .where(byId(organizationId, id))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export const periodRouter = {
  /** Client-list mode (R3.9): bounded, year desc then order. */
  list: sigeProcedure
    .use(requirePermission({ period: ["read"] }))
    .input(listInput)
    .handler(({ context, input }) =>
      context.db
        .select(rowColumns)
        .from(schema.academicPeriod)
        .where(
          and(
            eq(schema.academicPeriod.organizationId, context.org.id),
            input.academicYear
              ? eq(schema.academicPeriod.academicYear, input.academicYear)
              : undefined,
          ),
        )
        .orderBy(desc(schema.academicPeriod.academicYear), asc(schema.academicPeriod.orderNum)),
    ),

  /** Periods per academic year with the "n of 4" warning (INS-R5); a warning, not a limit. */
  summary: sigeProcedure
    .use(requirePermission({ period: ["read"] }))
    .handler(async ({ context }) => {
      const counts = await context.db
        .select({
          academicYear: schema.academicPeriod.academicYear,
          periodCount: sql<number>`count(*)::int`,
        })
        .from(schema.academicPeriod)
        .where(eq(schema.academicPeriod.organizationId, context.org.id))
        .groupBy(schema.academicPeriod.academicYear)
        .orderBy(desc(schema.academicPeriod.academicYear));
      return counts.map((row) => ({
        ...row,
        warning:
          row.periodCount < PERIOD_ORDER_MAX
            ? `Este año tiene ${row.periodCount} de ${PERIOD_ORDER_MAX} periodos.`
            : null,
      }));
    }),

  get: sigeProcedure
    .use(requirePermission({ period: ["read"] }))
    .input(idInput)
    .handler(({ context, input }) => toRow(context.db, context.org.id, input.id)),

  create: sigeProcedure
    .use(requirePermission({ period: ["create"] }))
    .input(periodInput)
    .handler(async ({ context, input }) => {
      const values = valuesFrom(input);
      let created: PeriodRow;
      try {
        created = await context.db.transaction(async (tx) => {
          assertNoOverlap(await lockPeriods(tx, context.org.id), values, null);
          const [row] = await tx
            .insert(schema.academicPeriod)
            .values({ organizationId: context.org.id, ...values })
            .returning(rowColumns);
          if (!row) throw new Error("Period insert returned no row.");
          return row;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "period.created",
        targetType: "period",
        targetId: created.id,
        metadata: { after: values },
      });
      return created;
    }),

  update: sigeProcedure
    .use(requirePermission({ period: ["update"] }))
    .input(updateInput)
    .handler(async ({ context, input }) => {
      const values = valuesFrom(input);
      let outcome: { before: PeriodRow; after: PeriodRow };
      try {
        outcome = await context.db.transaction(async (tx) => {
          const periods = await lockPeriods(tx, context.org.id);
          const before = periods.find((period) => period.id === input.id);
          if (!before) throw notFound();
          // INS-R5: the only way to deactivate is to activate another period.
          if (before.isActive && !values.isActive)
            throw new ORPCError("BAD_REQUEST", { message: MUST_KEEP_ACTIVE });
          assertNoOverlap(periods, values, before.id);
          const [after] = await tx
            .update(schema.academicPeriod)
            .set(values)
            .where(byId(context.org.id, input.id))
            .returning(rowColumns);
          if (!after) throw notFound();
          return { before, after };
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "period.updated",
        targetType: "period",
        targetId: input.id,
        metadata: {
          name: values.name,
          changes: changedFields(outcome.before, values),
        },
      });
      return outcome.after;
    }),

  /** Atomic swap: the previous active period is deactivated in the same transaction (INS-R5). */
  activate: sigeProcedure
    .use(requirePermission({ period: ["update"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      let outcome: { period: PeriodRow; previousActiveId: string | null; changed: boolean };
      try {
        outcome = await context.db.transaction(async (tx) => {
          const periods = await lockPeriods(tx, context.org.id);
          const target = periods.find((period) => period.id === input.id);
          if (!target) throw notFound();
          if (target.isActive) return { period: target, previousActiveId: null, changed: false };
          const previous = periods.find((period) => period.isActive) ?? null;
          if (previous) {
            await tx
              .update(schema.academicPeriod)
              .set({ isActive: false })
              .where(byId(context.org.id, previous.id));
          }
          const [period] = await tx
            .update(schema.academicPeriod)
            .set({ isActive: true })
            .where(byId(context.org.id, input.id))
            .returning(rowColumns);
          if (!period) throw notFound();
          return { period, previousActiveId: previous?.id ?? null, changed: true };
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      if (outcome.changed) {
        await recordAudit(context, {
          action: "period.activated",
          targetType: "period",
          targetId: input.id,
          metadata: { name: outcome.period.name, previousActiveId: outcome.previousActiveId },
        });
      }
      return outcome.period;
    }),

  delete: sigeProcedure
    .use(requirePermission({ period: ["delete"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      try {
        const affected = await context.db
          .delete(schema.academicPeriod)
          .where(byId(context.org.id, input.id))
          .returning({ id: schema.academicPeriod.id });
        if (affected.length === 0) throw notFound();
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "period.deleted",
        targetType: "period",
        targetId: input.id,
        metadata: {
          snapshot: {
            name: before.name,
            academicYear: before.academicYear,
            shortName: before.shortName,
          },
        },
      });
      return { deleted: true as const };
    }),
};

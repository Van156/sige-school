import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { sumWeights } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { changedFields, recordAudit } from "../../sige/audit";
import { noopGradeRecalculation } from "../../sige/grade-recalculation";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { criterionInput } from "../../sige/schemas/institution";

/**
 * `criterion.*` (sige/02 §3.3, §3.4, INS-17/18). Saving never blocks on a total different from
 * 100 (INS-R7): `list` returns the exact `totalWeight` and the UI shows the warning. Create,
 * delete and a weight-changing update call the `gradeRecalculation` port with `scope: "open"`
 * inside the write transaction (a no-op until module 06), so a failed recompute rolls the write
 * back. `update` returns `affectedFinals`.
 */

const idInput = z.object({ id: z.string().min(1) });
const updateInput = criterionInput.extend({ id: z.string().min(1) });

const notFound = () => new ORPCError("NOT_FOUND", { message: "El criterio no existe." });

const rowColumns = {
  id: schema.gradeCriterion.id,
  name: schema.gradeCriterion.name,
  weight: schema.gradeCriterion.weight,
  description: schema.gradeCriterion.description,
  orderNum: schema.gradeCriterion.orderNum,
};

/** `numeric(5,2)` arrives as a string; the API exposes a number. */
const toCriterionRow = <T extends { weight: string }>(
  row: T,
): Omit<T, "weight"> & { weight: number } => ({
  ...row,
  weight: Number(row.weight),
});

const byId = (organizationId: string, id: string) =>
  and(eq(schema.gradeCriterion.organizationId, organizationId), eq(schema.gradeCriterion.id, id));

async function findCriterion(db: Database, organizationId: string, id: string) {
  const [row] = await db
    .select(rowColumns)
    .from(schema.gradeCriterion)
    .where(byId(organizationId, id))
    .limit(1);
  return row ? toCriterionRow(row) : null;
}

async function toRow(db: Database, organizationId: string, id: string) {
  const row = await findCriterion(db, organizationId, id);
  if (!row) throw notFound();
  return row;
}

/** Optional text left out of a full-replace update clears the column. */
const columnsFrom = (input: z.infer<typeof criterionInput>) => ({
  name: input.name,
  weight: input.weight,
  description: input.description ?? null,
  orderNum: input.orderNum,
});

/** Drizzle takes `numeric` as a string. */
const dbValues = (values: ReturnType<typeof columnsFrom>) => ({
  ...values,
  weight: values.weight.toFixed(2),
});

export const criterionRouter = {
  /** Client-list mode (R3.9): rows by order plus the exact Σ of weights (INS-R7). */
  list: sigeProcedure
    .use(requirePermission({ criterion: ["read"] }))
    .handler(async ({ context }) => {
      const rows = (
        await context.db
          .select(rowColumns)
          .from(schema.gradeCriterion)
          .where(eq(schema.gradeCriterion.organizationId, context.org.id))
          .orderBy(asc(schema.gradeCriterion.orderNum), asc(schema.gradeCriterion.name))
      ).map(toCriterionRow);
      return { rows, totalWeight: sumWeights(rows.map((row) => row.weight)) };
    }),

  get: sigeProcedure
    .use(requirePermission({ criterion: ["read"] }))
    .input(idInput)
    .handler(({ context, input }) => toRow(context.db, context.org.id, input.id)),

  create: sigeProcedure
    .use(requirePermission({ criterion: ["create"] }))
    .input(criterionInput)
    .handler(async ({ context, input }) => {
      const values = columnsFrom(input);
      const port = context.gradeRecalculation ?? noopGradeRecalculation;
      let id: string;
      try {
        id = await context.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(schema.gradeCriterion)
            .values({ organizationId: context.org.id, ...dbValues(values) })
            .returning({ id: schema.gradeCriterion.id });
          if (!row) throw new Error("Criterion insert returned no row.");
          await port.recomputeFinals({ scope: "open" }, tx);
          return row.id;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "criterion.created",
        targetType: "criterion",
        targetId: id,
        metadata: { after: values },
      });
      return toRow(context.db, context.org.id, id);
    }),

  update: sigeProcedure
    .use(requirePermission({ criterion: ["update"] }))
    .input(updateInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      const values = columnsFrom(input);
      const port = context.gradeRecalculation ?? noopGradeRecalculation;
      const weightChanged = before.weight !== values.weight;
      let affectedFinals = 0;
      try {
        affectedFinals = await context.db.transaction(async (tx) => {
          const affected = await tx
            .update(schema.gradeCriterion)
            .set(dbValues(values))
            .where(byId(context.org.id, input.id))
            .returning({ id: schema.gradeCriterion.id });
          if (affected.length === 0) throw notFound();
          if (!weightChanged) return 0;
          return (await port.recomputeFinals({ scope: "open" }, tx)).affectedFinals;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "criterion.updated",
        targetType: "criterion",
        targetId: input.id,
        metadata: {
          name: values.name,
          affectedFinals,
          changes: changedFields(
            {
              name: before.name,
              weight: before.weight,
              description: before.description,
              orderNum: before.orderNum,
            },
            values,
          ),
        },
      });
      return { ...(await toRow(context.db, context.org.id, input.id)), affectedFinals };
    }),

  delete: sigeProcedure
    .use(requirePermission({ criterion: ["delete"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      const port = context.gradeRecalculation ?? noopGradeRecalculation;
      try {
        await context.db.transaction(async (tx) => {
          const affected = await tx
            .delete(schema.gradeCriterion)
            .where(byId(context.org.id, input.id))
            .returning({ id: schema.gradeCriterion.id });
          if (affected.length === 0) throw notFound();
          await port.recomputeFinals({ scope: "open" }, tx);
        });
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "criterion.deleted",
        targetType: "criterion",
        targetId: input.id,
        metadata: { snapshot: { name: before.name, weight: before.weight } },
      });
      return { deleted: true as const };
    }),
};

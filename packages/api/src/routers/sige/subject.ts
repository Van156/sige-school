import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { changedFields, recordAudit } from "../../sige/audit";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { subjectInput } from "../../sige/schemas/institution";

/**
 * `subject.*` (sige/02 §3.3, INS-13/14). The tenant comes from `context.org`; another tenant's id
 * is `NOT_FOUND`. A repeated code is rejected by the partial unique index (`CONFLICT`). Deletes
 * rely on the `restrict` FKs that later modules add (offerings), never on a racy pre-check.
 */

const idInput = z.object({ id: z.string().min(1) });
const updateInput = subjectInput.extend({ id: z.string().min(1) });

const notFound = () => new ORPCError("NOT_FOUND", { message: "La asignatura no existe." });

const rowColumns = {
  id: schema.subject.id,
  name: schema.subject.name,
  code: schema.subject.code,
};

const byId = (organizationId: string, id: string) =>
  and(eq(schema.subject.organizationId, organizationId), eq(schema.subject.id, id));

async function findSubject(db: Database, organizationId: string, id: string) {
  const [row] = await db
    .select(rowColumns)
    .from(schema.subject)
    .where(byId(organizationId, id))
    .limit(1);
  return row ?? null;
}

async function toRow(db: Database, organizationId: string, id: string) {
  const row = await findSubject(db, organizationId, id);
  if (!row) throw notFound();
  return row;
}

/** Optional text left out of a full-replace update clears the column. */
const columnsFrom = (input: z.infer<typeof subjectInput>) => ({
  name: input.name,
  code: input.code ?? null,
});

export const subjectRouter = {
  /** Client-list mode (R3.9): bounded, ordered by name. */
  list: sigeProcedure
    .use(requirePermission({ subject: ["read"] }))
    .handler(({ context }) =>
      context.db
        .select(rowColumns)
        .from(schema.subject)
        .where(eq(schema.subject.organizationId, context.org.id))
        .orderBy(asc(schema.subject.name), asc(schema.subject.id)),
    ),

  get: sigeProcedure
    .use(requirePermission({ subject: ["read"] }))
    .input(idInput)
    .handler(({ context, input }) => toRow(context.db, context.org.id, input.id)),

  create: sigeProcedure
    .use(requirePermission({ subject: ["create"] }))
    .input(subjectInput)
    .handler(async ({ context, input }) => {
      const values = columnsFrom(input);
      let id: string;
      try {
        const [row] = await context.db
          .insert(schema.subject)
          .values({ organizationId: context.org.id, ...values })
          .returning({ id: schema.subject.id });
        if (!row) throw new Error("Subject insert returned no row.");
        id = row.id;
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "subject.created",
        targetType: "subject",
        targetId: id,
        metadata: { after: values },
      });
      return toRow(context.db, context.org.id, id);
    }),

  update: sigeProcedure
    .use(requirePermission({ subject: ["update"] }))
    .input(updateInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      const values = columnsFrom(input);
      try {
        const affected = await context.db
          .update(schema.subject)
          .set(values)
          .where(byId(context.org.id, input.id))
          .returning({ id: schema.subject.id });
        if (affected.length === 0) throw notFound();
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "subject.updated",
        targetType: "subject",
        targetId: input.id,
        metadata: {
          name: values.name,
          changes: changedFields({ name: before.name, code: before.code }, values),
        },
      });
      return toRow(context.db, context.org.id, input.id);
    }),

  delete: sigeProcedure
    .use(requirePermission({ subject: ["delete"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      try {
        const affected = await context.db
          .delete(schema.subject)
          .where(byId(context.org.id, input.id))
          .returning({ id: schema.subject.id });
        if (affected.length === 0) throw notFound();
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "subject.deleted",
        targetType: "subject",
        targetId: input.id,
        metadata: { snapshot: { name: before.name, code: before.code } },
      });
      return { deleted: true as const };
    }),
};

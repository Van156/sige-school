import type { Database } from "@base-template/db";
import { buildListQuery, buildListWhere } from "@base-template/db/lib/list-query";
import type { ListColumns } from "@base-template/db/lib/list-query";
import * as schema from "@base-template/db/schema";
import { todayIn } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, count, eq, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { assignmentListConfig } from "../../lib/assignment-list-config";
import { createListInput } from "../../lib/list-input";
import { recordAudit } from "../../sige/audit";
import { assertAssignableTeacher, assertTeacherFreeForOffering } from "../../sige/offering-rules";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { assignmentAssignInput, assignmentUpdateInput } from "../../sige/schemas/scheduling";
import { lockOffering } from "./offering";

/**
 * `assignment.*` (sige/04 §3.2, SCH-03/04, SCH-R3/R4). The offering is the single source of truth
 * for the teacher; the assignment row (one per offering) carries the same teacher through a
 * composite FK with `ON UPDATE CASCADE`, so changing the offering's teacher moves the row along
 * and the two can never diverge.
 *
 * - `assign` creates the offering (4 weekly hours) when the pair has none, otherwise changes its
 *   teacher, and upserts the assignment (`activo`, today in America/Bogota, the course's year;
 *   the notes are cleared when the teacher changes and kept on a same-teacher re-assign).
 *   Reassigning an offering that already has slots is refused when the new teacher is busy at
 *   any of them (`CONFLICT`, first clashing class named).
 * - `update` edits status and notes only.
 * - `delete` removes the assignment row FIRST and then clears the offering's teacher (setting it
 *   to null while the row exists raises 23502), per SCH-R3 "assignment.delete clears the teacher
 *   and the row". Slots keep existing and lose their teacher through the cascade.
 *
 * No advisory lock: none of these writes creates, moves or deletes slot times, so the time-block
 * "in use" checks cannot race them. The offering row lock serialises a teacher change with slot
 * inserts, and the teacher exclusion constraint is the backstop for the busy check.
 */

const idInput = z.object({ id: z.string().min(1) });
const listInput = createListInput(assignmentListConfig);
const statsInput = z.object({ academicYear: z.string().min(1).optional() }).default({});

const notFound = () => new ORPCError("NOT_FOUND", { message: "La asignación no existe." });

/** Default offering weekly hours when `assign` has to create the offering (sige/04 §3.2). */
const DEFAULT_HOURS_PER_WEEK = 4;

const teacherName = sql<string>`${schema.person.firstName} || ' ' || ${schema.person.lastName}`;

const rowColumns = {
  id: schema.teacherAssignment.id,
  offeringId: schema.teacherAssignment.offeringId,
  teacherPersonId: schema.teacherAssignment.teacherPersonId,
  teacherName,
  teacherUsername: schema.user.username,
  subjectName: schema.subject.name,
  courseName: schema.course.name,
  academicYear: schema.teacherAssignment.academicYear,
  assignmentDate: schema.teacherAssignment.assignmentDate,
  status: schema.teacherAssignment.status,
  notes: schema.teacherAssignment.notes,
};

const SORT_COLUMNS = {
  teacher: teacherName as unknown as AnyColumn,
  subject: schema.subject.name,
  course: schema.course.name,
  assignmentDate: schema.teacherAssignment.assignmentDate,
  status: schema.teacherAssignment.status,
} as const satisfies ListColumns;

const FILTER_COLUMNS = {
  teacher: teacherName as unknown as AnyColumn,
  courseId: schema.offering.courseId,
  subjectId: schema.offering.subjectId,
  status: schema.teacherAssignment.status,
  academicYear: schema.teacherAssignment.academicYear,
} as const satisfies ListColumns;

const selectRows = (db: Pick<Database, "select">, organizationId: string) =>
  db
    .select(rowColumns)
    .from(schema.teacherAssignment)
    .innerJoin(
      schema.offering,
      and(
        eq(schema.offering.organizationId, schema.teacherAssignment.organizationId),
        eq(schema.offering.id, schema.teacherAssignment.offeringId),
      ),
    )
    .innerJoin(
      schema.subject,
      and(
        eq(schema.subject.organizationId, schema.offering.organizationId),
        eq(schema.subject.id, schema.offering.subjectId),
      ),
    )
    .innerJoin(
      schema.course,
      and(
        eq(schema.course.organizationId, schema.offering.organizationId),
        eq(schema.course.id, schema.offering.courseId),
      ),
    )
    .innerJoin(
      schema.person,
      and(
        eq(schema.person.organizationId, schema.teacherAssignment.organizationId),
        eq(schema.person.id, schema.teacherAssignment.teacherPersonId),
      ),
    )
    .innerJoin(schema.user, eq(schema.user.id, schema.person.userId))
    .$dynamic()
    .where(eq(schema.teacherAssignment.organizationId, organizationId));

async function assignmentRow(db: Pick<Database, "select">, organizationId: string, id: string) {
  const [row] = await selectRows(db, organizationId)
    .where(
      and(
        eq(schema.teacherAssignment.organizationId, organizationId),
        eq(schema.teacherAssignment.id, id),
      ),
    )
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export const assignmentRouter = {
  list: sigeProcedure
    .use(requirePermission({ offering: ["read"] }))
    .input(listInput)
    .handler(async ({ context, input }) => {
      const sorted = buildListQuery({
        columns: SORT_COLUMNS,
        input: { ...input, filters: [] },
        tieBreakers: [schema.teacherAssignment.id],
      });
      const filtered = buildListWhere({
        columns: FILTER_COLUMNS,
        filters: input.filters,
        joinOperator: input.joinOperator,
      });
      const scope = and(
        eq(schema.teacherAssignment.organizationId, context.org.id),
        context.scope.offeringWhere(),
        filtered,
      );
      const [rows, [totalRow]] = await Promise.all([
        selectRows(context.db, context.org.id)
          .where(scope)
          .orderBy(...sorted.orderBy)
          .limit(sorted.limit)
          .offset(sorted.offset),
        // The filters only reach the offering (course, subject) and the teacher's name.
        context.db
          .select({ total: count() })
          .from(schema.teacherAssignment)
          .innerJoin(
            schema.offering,
            and(
              eq(schema.offering.organizationId, schema.teacherAssignment.organizationId),
              eq(schema.offering.id, schema.teacherAssignment.offeringId),
            ),
          )
          .innerJoin(
            schema.person,
            and(
              eq(schema.person.organizationId, schema.teacherAssignment.organizationId),
              eq(schema.person.id, schema.teacherAssignment.teacherPersonId),
            ),
          )
          .where(scope),
      ]);
      return { rows, total: totalRow?.total ?? 0 };
    }),

  stats: sigeProcedure
    .use(requirePermission({ offering: ["read"] }))
    .input(statsInput)
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${schema.teacherAssignment.status} = 'activo')::int`,
        })
        .from(schema.teacherAssignment)
        .innerJoin(
          schema.offering,
          and(
            eq(schema.offering.organizationId, schema.teacherAssignment.organizationId),
            eq(schema.offering.id, schema.teacherAssignment.offeringId),
          ),
        )
        .where(
          and(
            eq(schema.teacherAssignment.organizationId, context.org.id),
            context.scope.offeringWhere(),
            input.academicYear
              ? eq(schema.teacherAssignment.academicYear, input.academicYear)
              : undefined,
          ),
        );
      return { total: row?.total ?? 0, active: row?.active ?? 0 };
    }),

  get: sigeProcedure
    .use(requirePermission({ offering: ["read"] }))
    .input(idInput)
    .handler(({ context, input }) => assignmentRow(context.db, context.org.id, input.id)),

  assign: sigeProcedure
    .use(requirePermission({ offering: ["update"] }))
    .input(assignmentAssignInput)
    .handler(async ({ context, input }) => {
      const orgId = context.org.id;
      let outcome: {
        assignmentId: string;
        offeringId: string;
        offeringCreated: boolean;
        from: string | null;
      };
      try {
        outcome = await context.db.transaction(async (tx) => {
          await assertAssignableTeacher(tx, orgId, input.teacherPersonId);
          const [course] = await tx
            .select({ academicYear: schema.course.academicYear })
            .from(schema.course)
            .where(
              and(eq(schema.course.organizationId, orgId), eq(schema.course.id, input.courseId)),
            )
            .limit(1);
          if (!course) throw new ORPCError("NOT_FOUND", { message: "El grado no existe." });
          const [subject] = await tx
            .select({ id: schema.subject.id })
            .from(schema.subject)
            .where(
              and(eq(schema.subject.organizationId, orgId), eq(schema.subject.id, input.subjectId)),
            )
            .limit(1);
          if (!subject) throw new ORPCError("NOT_FOUND", { message: "La materia no existe." });

          // Insert-or-find under the unique pair, then work on the locked row either way.
          const [inserted] = await tx
            .insert(schema.offering)
            .values({
              organizationId: orgId,
              courseId: input.courseId,
              subjectId: input.subjectId,
              hoursPerWeek: DEFAULT_HOURS_PER_WEEK,
            })
            .onConflictDoNothing({
              target: [
                schema.offering.organizationId,
                schema.offering.subjectId,
                schema.offering.courseId,
              ],
            })
            .returning({ id: schema.offering.id });
          let offeringId = inserted?.id;
          if (!offeringId) {
            const [existing] = await tx
              .select({ id: schema.offering.id })
              .from(schema.offering)
              .where(
                and(
                  eq(schema.offering.organizationId, orgId),
                  eq(schema.offering.courseId, input.courseId),
                  eq(schema.offering.subjectId, input.subjectId),
                ),
              )
              .limit(1);
            if (!existing) throw notFound();
            offeringId = existing.id;
          }
          const current = await lockOffering(tx, orgId, offeringId);
          const from = current.teacherPersonId;
          if (from !== input.teacherPersonId) {
            // SCH-R3: refuse a teacher who is busy at any slot of the offering.
            await assertTeacherFreeForOffering(tx, orgId, offeringId, input.teacherPersonId);
            // The assignment row follows through the composite FK cascade.
            await tx
              .update(schema.offering)
              .set({ teacherPersonId: input.teacherPersonId })
              .where(
                and(eq(schema.offering.organizationId, orgId), eq(schema.offering.id, offeringId)),
              );
          }
          const values = {
            teacherPersonId: input.teacherPersonId,
            academicYear: course.academicYear,
            assignmentDate: todayIn(),
            status: "activo" as const,
          };
          const [assignment] = await tx
            .insert(schema.teacherAssignment)
            .values({ organizationId: orgId, offeringId, ...values })
            .onConflictDoUpdate({
              target: schema.teacherAssignment.offeringId,
              // D10: notes describe the previous teacher; a same-teacher re-assign keeps them.
              set: from === input.teacherPersonId ? values : { ...values, notes: null },
            })
            .returning({ id: schema.teacherAssignment.id });
          if (!assignment) throw new Error("Assignment upsert returned no row.");
          return {
            assignmentId: assignment.id,
            offeringId,
            offeringCreated: inserted !== undefined,
            from,
          };
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "teacher.assigned",
        targetType: "teacher_assignment",
        targetId: outcome.assignmentId,
        metadata: {
          offeringId: outcome.offeringId,
          from: outcome.from,
          to: input.teacherPersonId,
          status: "activo",
        },
      });
      return {
        assignment: await assignmentRow(context.db, orgId, outcome.assignmentId),
        offeringCreated: outcome.offeringCreated,
      };
    }),

  /** SCH-R3: status and notes only. A left-out `notes` clears the column. */
  update: sigeProcedure
    .use(requirePermission({ offering: ["update"] }))
    .input(assignmentUpdateInput)
    .handler(async ({ context, input }) => {
      let before: { offeringId: string; teacherPersonId: string; status: string };
      try {
        before = await context.db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(schema.teacherAssignment)
            .where(
              and(
                eq(schema.teacherAssignment.organizationId, context.org.id),
                eq(schema.teacherAssignment.id, input.id),
              ),
            )
            .for("update");
          if (!current) throw notFound();
          await tx
            .update(schema.teacherAssignment)
            .set({ status: input.status, notes: input.notes ?? null })
            .where(eq(schema.teacherAssignment.id, input.id));
          return current;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "teacher.assigned",
        targetType: "teacher_assignment",
        targetId: input.id,
        metadata: {
          offeringId: before.offeringId,
          from: before.teacherPersonId,
          to: before.teacherPersonId,
          status: input.status,
          previousStatus: before.status,
        },
      });
      return assignmentRow(context.db, context.org.id, input.id);
    }),

  /** SCH-R3: removes the assignment row and clears the offering's teacher ("Sin asignar"). */
  delete: sigeProcedure
    .use(requirePermission({ offering: ["update"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      const orgId = context.org.id;
      let removed: { offeringId: string; teacherPersonId: string; status: string };
      try {
        removed = await context.db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(schema.teacherAssignment)
            .where(
              and(
                eq(schema.teacherAssignment.organizationId, orgId),
                eq(schema.teacherAssignment.id, input.id),
              ),
            );
          if (!current) throw notFound();
          // Offering first (the same lock order as `assign`), then the row, then the teacher.
          await lockOffering(tx, orgId, current.offeringId);
          const deleted = await tx
            .delete(schema.teacherAssignment)
            .where(
              and(
                eq(schema.teacherAssignment.organizationId, orgId),
                eq(schema.teacherAssignment.id, input.id),
              ),
            )
            .returning({ id: schema.teacherAssignment.id });
          if (deleted.length === 0) throw notFound();
          await tx
            .update(schema.offering)
            .set({ teacherPersonId: null })
            .where(
              and(
                eq(schema.offering.organizationId, orgId),
                eq(schema.offering.id, current.offeringId),
              ),
            );
          return current;
        });
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "teacher.assigned",
        targetType: "teacher_assignment",
        targetId: input.id,
        metadata: {
          offeringId: removed.offeringId,
          from: removed.teacherPersonId,
          to: null,
          status: removed.status,
        },
      });
      return { deleted: true as const };
    }),
};

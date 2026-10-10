import type { Database } from "@base-template/db";
import { buildListQuery, buildListWhere } from "@base-template/db/lib/list-query";
import type { ListColumns } from "@base-template/db/lib/list-query";
import * as schema from "@base-template/db/schema";
import { todayIn } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";
import { z } from "zod";

import { requireAnyPermission, requirePermission } from "../../index";
import { createListInput } from "../../lib/list-input";
import { offeringListConfig } from "../../lib/offering-list-config";
import { changedFields, recordAudit } from "../../sige/audit";
import { assertAssignableTeacher } from "../../sige/offering-rules";
import {
  HAS_DEPENDENTS,
  OFFERING_HAS_ENROLLMENTS_MESSAGE,
  OFFERING_HAS_SLOTS_MESSAGE,
  rethrowDbError,
} from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { offeringCreateBulkInput, offeringUpdateInput } from "../../sige/schemas/scheduling";

/**
 * `offering.*` (sige/04 §3.1, SCH-05/06, SCH-R2/R3/R6). An offering is "subject taught in a
 * course by at most one teacher". `list`/`stats`/`options` AND the caller's `ScopePolicy`
 * offering predicate (a no-op for managers; a teacher sees only own `activo`/`temporal`
 * offerings). `createBulk` is one transaction (<= 500 pairs); existing pairs are skipped and an
 * optional teacher also writes the assignments. `update` edits the weekly hours only and does not
 * move slots (OQ-SCH-1). `delete` locks the offering row, refuses while enrollments or slots exist
 * (in that order) and lets the composite FK cascade remove the assignment (SCH-R6).
 *
 * No advisory lock: nothing here creates, moves or removes slots, so the time-block "in use"
 * checks cannot race these writes. A concurrent slot insert is arbitrated by the offering row
 * lock (`delete`) and by the slot FKs.
 */

const idInput = z.object({ id: z.string().min(1) });
const listInput = createListInput(offeringListConfig);
const statsInput = z.object({ academicYear: z.string().min(1).optional() }).default({});
const optionsInput = z
  .object({ courseId: z.string().min(1).optional(), academicYear: z.string().min(1).optional() })
  .default({});

const notFound = () => new ORPCError("NOT_FOUND", { message: "La materia del grado no existe." });

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const teacherName = sql<
  string | null
>`${schema.person.firstName} || ' ' || ${schema.person.lastName}`;

const rowColumns = {
  id: schema.offering.id,
  subjectId: schema.offering.subjectId,
  subjectName: schema.subject.name,
  subjectCode: schema.subject.code,
  courseId: schema.offering.courseId,
  courseName: schema.course.name,
  hoursPerWeek: schema.offering.hoursPerWeek,
  teacherPersonId: schema.offering.teacherPersonId,
  teacherName,
  assignmentStatus: schema.teacherAssignment.status,
};

/** Assigned/unassigned switch of the `teacher` filter. */
const teacherState = sql`case when ${schema.offering.teacherPersonId} is null then 'unassigned' else 'assigned' end`;

/** Sort ids to columns; the only way a client sort id reaches SQL. */
const SORT_COLUMNS = {
  subject: schema.subject.name,
  course: schema.course.name,
  hoursPerWeek: schema.offering.hoursPerWeek,
  teacher: teacherName as unknown as AnyColumn,
} as const satisfies ListColumns;

/** Filter ids to columns (`teacher` filters the assigned state, not the name). */
const FILTER_COLUMNS = {
  courseId: schema.offering.courseId,
  subjectId: schema.offering.subjectId,
  teacher: teacherState as unknown as AnyColumn,
  academicYear: schema.course.academicYear,
} as const satisfies ListColumns;

/** Offering rows with subject, course, teacher name and assignment status, for one institution. */
const selectRows = (db: Pick<Database, "select">, organizationId: string) =>
  db
    .select(rowColumns)
    .from(schema.offering)
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
    .leftJoin(
      schema.person,
      and(
        eq(schema.person.organizationId, schema.offering.organizationId),
        eq(schema.person.id, schema.offering.teacherPersonId),
      ),
    )
    .leftJoin(
      schema.teacherAssignment,
      and(
        eq(schema.teacherAssignment.organizationId, schema.offering.organizationId),
        eq(schema.teacherAssignment.offeringId, schema.offering.id),
      ),
    )
    .$dynamic()
    .where(eq(schema.offering.organizationId, organizationId));

const byId = (organizationId: string, id: string) =>
  and(eq(schema.offering.organizationId, organizationId), eq(schema.offering.id, id));

export async function offeringRow(
  db: Pick<Database, "select">,
  organizationId: string,
  id: string,
) {
  const [row] = await selectRows(db, organizationId).where(byId(organizationId, id)).limit(1);
  if (!row) throw notFound();
  return row;
}

/** Locks the offering row so slot inserts and teacher changes serialise with the caller. */
export async function lockOffering(tx: Tx, organizationId: string, id: string) {
  const [current] = await tx
    .select()
    .from(schema.offering)
    .where(byId(organizationId, id))
    .for("update");
  if (!current) throw notFound();
  return current;
}

export const offeringRouter = {
  /** Server-list mode (R3.8): `{ rows, total }`; `total` ignores paging. */
  list: sigeProcedure
    .use(requirePermission({ offering: ["read"] }))
    .input(listInput)
    .handler(async ({ context, input }) => {
      const sorted = buildListQuery({
        columns: SORT_COLUMNS,
        input: { ...input, filters: [] },
        tieBreakers: [schema.offering.id],
      });
      const filtered = buildListWhere({
        columns: FILTER_COLUMNS,
        filters: input.filters,
        joinOperator: input.joinOperator,
      });
      const scope = and(
        eq(schema.offering.organizationId, context.org.id),
        context.scope.offeringWhere(),
        filtered,
      );
      const [rows, [totalRow]] = await Promise.all([
        selectRows(context.db, context.org.id)
          .where(scope)
          .orderBy(...sorted.orderBy)
          .limit(sorted.limit)
          .offset(sorted.offset),
        context.db
          .select({ total: count() })
          .from(schema.offering)
          .innerJoin(
            schema.course,
            and(
              eq(schema.course.organizationId, schema.offering.organizationId),
              eq(schema.course.id, schema.offering.courseId),
            ),
          )
          .where(scope),
      ]);
      return { rows, total: totalRow?.total ?? 0 };
    }),

  /** KPI tiles: offerings, weekly hours and offerings without a teacher. */
  stats: sigeProcedure
    .use(requirePermission({ offering: ["read"] }))
    .input(statsInput)
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .select({
          assigned: count(),
          weeklyHours: sql<number>`coalesce(sum(${schema.offering.hoursPerWeek}), 0)::int`,
          withoutTeacher: sql<number>`count(*) filter (where ${schema.offering.teacherPersonId} is null)::int`,
        })
        .from(schema.offering)
        .innerJoin(
          schema.course,
          and(
            eq(schema.course.organizationId, schema.offering.organizationId),
            eq(schema.course.id, schema.offering.courseId),
          ),
        )
        .where(
          and(
            eq(schema.offering.organizationId, context.org.id),
            context.scope.offeringWhere(),
            input.academicYear ? eq(schema.course.academicYear, input.academicYear) : undefined,
          ),
        );
      return {
        assigned: row?.assigned ?? 0,
        weeklyHours: row?.weeklyHours ?? 0,
        withoutTeacher: row?.withoutTeacher ?? 0,
      };
    }),

  /** SCH-06: every (course, subject) pair not yet offered; one transaction, one audit event. */
  createBulk: sigeProcedure
    .use(requirePermission({ offering: ["create"] }))
    .input(offeringCreateBulkInput)
    .handler(async ({ context, input }) => {
      const courseIds = [...new Set(input.courseIds)];
      const subjectIds = [...new Set(input.subjectIds)];
      const teacherPersonId = input.teacherPersonId ?? null;
      const total = courseIds.length * subjectIds.length;
      let created: { id: string; courseId: string }[];
      try {
        created = await context.db.transaction(async (tx) => {
          if (teacherPersonId) await assertAssignableTeacher(tx, context.org.id, teacherPersonId);
          const courses = await tx
            .select({ id: schema.course.id, academicYear: schema.course.academicYear })
            .from(schema.course)
            .where(
              and(
                eq(schema.course.organizationId, context.org.id),
                inArray(schema.course.id, courseIds),
              ),
            );
          if (courses.length !== courseIds.length) {
            throw new ORPCError("NOT_FOUND", { message: "El grado no existe." });
          }
          const subjects = await tx
            .select({ id: schema.subject.id })
            .from(schema.subject)
            .where(
              and(
                eq(schema.subject.organizationId, context.org.id),
                inArray(schema.subject.id, subjectIds),
              ),
            );
          if (subjects.length !== subjectIds.length) {
            throw new ORPCError("NOT_FOUND", { message: "La materia no existe." });
          }
          const inserted = await tx
            .insert(schema.offering)
            .values(
              courseIds.flatMap((courseId) =>
                subjectIds.map((subjectId) => ({
                  organizationId: context.org.id,
                  courseId,
                  subjectId,
                  teacherPersonId,
                  hoursPerWeek: input.hoursPerWeek,
                })),
              ),
            )
            .onConflictDoNothing({
              target: [
                schema.offering.organizationId,
                schema.offering.subjectId,
                schema.offering.courseId,
              ],
            })
            .returning({ id: schema.offering.id, courseId: schema.offering.courseId });
          if (teacherPersonId && inserted.length > 0) {
            const yearOf = new Map(courses.map((course) => [course.id, course.academicYear]));
            const assignmentDate = todayIn();
            await tx.insert(schema.teacherAssignment).values(
              inserted.map((row) => ({
                organizationId: context.org.id,
                offeringId: row.id,
                teacherPersonId,
                academicYear: yearOf.get(row.courseId) as string,
                assignmentDate,
                status: "activo" as const,
              })),
            );
          }
          return inserted;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      const result = { created: created.length, skipped: total - created.length };
      await recordAudit(context, {
        action: "offering.created",
        targetType: "offering",
        targetId: created[0]?.id ?? "bulk",
        metadata: { ...result, courseIds, subjectIds, teacherPersonId },
      });
      return result;
    }),

  /** OQ-SCH-1: only the weekly hours change; existing slots stay where they are. */
  update: sigeProcedure
    .use(requirePermission({ offering: ["update"] }))
    .input(offeringUpdateInput)
    .handler(async ({ context, input }) => {
      let before: number;
      try {
        before = await context.db.transaction(async (tx) => {
          const current = await lockOffering(tx, context.org.id, input.id);
          await tx
            .update(schema.offering)
            .set({ hoursPerWeek: input.hoursPerWeek })
            .where(byId(context.org.id, input.id));
          return current.hoursPerWeek;
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      const row = await offeringRow(context.db, context.org.id, input.id);
      await recordAudit(context, {
        action: "offering.updated",
        targetType: "offering",
        targetId: input.id,
        metadata: {
          course: row.courseName,
          subject: row.subjectName,
          changes: changedFields({ hoursPerWeek: before }, { hoursPerWeek: input.hoursPerWeek }),
        },
      });
      return row;
    }),

  /**
   * SCH-R6 / §4.2. Enrollments are checked first ("tiene estudiantes matriculados", P3 D2), then
   * slots. Slots cascade from the offering, so "has slots" is checked under the offering
   * row lock (a concurrent slot insert holds a key-share lock on it and is waited for). The
   * assignment row goes with the offering (cascade); later modules' dependents are `restrict`
   * FKs mapped by `rethrowDbError`.
   */
  delete: sigeProcedure
    .use(requirePermission({ offering: ["delete"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      let snapshot: { course: string; subject: string };
      try {
        snapshot = await context.db.transaction(async (tx) => {
          await lockOffering(tx, context.org.id, input.id);
          const row = await offeringRow(tx, context.org.id, input.id);
          // §4.2 order: enrollments first, then slots. An enrollment insert holds a key-share lock
          // on the offering, so this check is not raced past.
          const [enrolled] = await tx
            .select({ id: schema.enrollment.id })
            .from(schema.enrollment)
            .where(
              and(
                eq(schema.enrollment.organizationId, context.org.id),
                eq(schema.enrollment.offeringId, input.id),
              ),
            )
            .limit(1);
          if (enrolled) {
            throw new ORPCError(HAS_DEPENDENTS, {
              status: 409,
              message: OFFERING_HAS_ENROLLMENTS_MESSAGE,
            });
          }
          const [slot] = await tx
            .select({ id: schema.scheduleSlot.id })
            .from(schema.scheduleSlot)
            .where(
              and(
                eq(schema.scheduleSlot.organizationId, context.org.id),
                eq(schema.scheduleSlot.offeringId, input.id),
              ),
            )
            .limit(1);
          if (slot) {
            throw new ORPCError(HAS_DEPENDENTS, {
              status: 409,
              message: OFFERING_HAS_SLOTS_MESSAGE,
            });
          }
          await tx.delete(schema.offering).where(byId(context.org.id, input.id));
          return { course: row.courseName, subject: row.subjectName };
        });
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "offering.deleted",
        targetType: "offering",
        targetId: input.id,
        metadata: { snapshot },
      });
      return { deleted: true as const };
    }),

  /**
   * Selector for GRD-01/03/04, ATT-01, MET and dashboards (SCH-R2): any of `offering:read`,
   * `grade:read`, `attendance:read`, always filtered by `ScopePolicy.offeringWhere()`.
   * `studentCount` is 0 until enrollments exist (P4).
   */
  options: sigeProcedure
    .use(
      requireAnyPermission({ offering: ["read"] }, { grade: ["read"] }, { attendance: ["read"] }),
    )
    .input(optionsInput)
    .handler(async ({ context, input }) => {
      const scope: SQL | undefined = context.scope.offeringWhere();
      const rows = await selectRows(context.db, context.org.id)
        .where(
          and(
            eq(schema.offering.organizationId, context.org.id),
            scope,
            input.courseId ? eq(schema.offering.courseId, input.courseId) : undefined,
            input.academicYear ? eq(schema.course.academicYear, input.academicYear) : undefined,
          ),
        )
        .orderBy(asc(schema.course.name), asc(schema.subject.name), asc(schema.offering.id));
      return rows.map((row) => ({
        offeringId: row.id,
        courseId: row.courseId,
        courseName: row.courseName,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        subjectCode: row.subjectCode,
        teacherPersonId: row.teacherPersonId,
        teacherName: row.teacherName,
        hoursPerWeek: row.hoursPerWeek,
        studentCount: 0,
      }));
    }),
};

import type { Database } from "@base-template/db";
import { buildListQuery, buildListWhere } from "@base-template/db/lib/list-query";
import type { ListColumns } from "@base-template/db/lib/list-query";
import { escapeLikePattern } from "@base-template/db/lib/list-values";
import * as schema from "@base-template/db/schema";
import { planBulkEnrollment } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

import { requirePermission } from "../../index";
import { enrollmentListConfig } from "../../lib/enrollment-list-config";
import { createListInput } from "../../lib/list-input";
import { changedFields, recordAudit } from "../../sige/audit";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import {
  enrollmentCandidatesInput,
  enrollmentCreateBulkInput,
  enrollmentIdInput,
  enrollmentStatsInput,
  enrollmentUpdateInput,
} from "../../sige/schemas/enrollment";

/**
 * `enrollment.*` (sige/04 §3.3, SCH-01/02, SCH-R5/R7/R8). Manager-only by the grant table
 * (owner, admin, coordinator); reads still AND `ScopePolicy.studentWhere()` so a restricted
 * caller could never widen past its students.
 *
 * `createBulk` is one transaction. It locks the course row (`FOR UPDATE`), so concurrent bulk
 * calls on the same course serialise and each capacity check sees the previous call's members,
 * then the selected students in id order (so two calls on different courses sharing students
 * cannot deadlock and a concurrent status change waits). `planBulkEnrollment` decides refusals and
 * rows; the existing `(student, offering, year)` rows are skipped, so a re-run creates nothing.
 * Audit events are recorded after commit.
 */

const listInput = createListInput(enrollmentListConfig);

const notFound = () => new ORPCError("NOT_FOUND", { message: "La matrícula no existe." });
const courseNotFound = () => new ORPCError("NOT_FOUND", { message: "El grado no existe." });
const studentNotFound = () => new ORPCError("NOT_FOUND", { message: "El estudiante no existe." });

const studentName = sql<string>`${schema.person.firstName} || ' ' || ${schema.person.lastName}`;
/** SCH-R7: the enrollment's course is not the student's current course. */
const isStale = sql<boolean>`${schema.offering.courseId} is distinct from ${schema.student.courseId}`;
/** Text searched by the `student` filter: the name or the document. */
const studentSearch = sql`${schema.person.firstName} || ' ' || ${schema.person.lastName} || ' ' || ${schema.person.documentNumber}`;

const rowColumns = {
  id: schema.enrollment.id,
  studentId: schema.enrollment.studentId,
  studentName,
  document: schema.person.documentNumber,
  subjectName: schema.subject.name,
  courseId: schema.offering.courseId,
  courseName: schema.course.name,
  enrollmentDate: schema.enrollment.enrollmentDate,
  status: schema.enrollment.status,
  finalScore: schema.enrollment.finalScore,
  statusNote: schema.enrollment.statusNote,
  isStale,
};

/** Sort ids to columns; the only way a client sort id reaches SQL. */
const SORT_COLUMNS = {
  student:
    sql`${schema.person.lastName} || ' ' || ${schema.person.firstName}` as unknown as AnyColumn,
  subject: schema.subject.name,
  course: schema.course.name,
  enrollmentDate: schema.enrollment.enrollmentDate,
  status: schema.enrollment.status,
  finalScore: schema.enrollment.finalScore,
} as const satisfies ListColumns;

const FILTER_COLUMNS = {
  student: studentSearch as unknown as AnyColumn,
  courseId: schema.offering.courseId,
  subjectId: schema.offering.subjectId,
  status: schema.enrollment.status,
  academicYear: schema.enrollment.academicYear,
} as const satisfies ListColumns;

const sameOrg = (column: AnyColumn) => eq(column, schema.enrollment.organizationId);
/** Join conditions: enrollment -> student -> person, enrollment -> offering -> subject, course. */
const ON = {
  student: and(
    sameOrg(schema.student.organizationId),
    eq(schema.student.id, schema.enrollment.studentId),
  ),
  person: and(sameOrg(schema.person.organizationId), eq(schema.person.id, schema.student.personId)),
  offering: and(
    sameOrg(schema.offering.organizationId),
    eq(schema.offering.id, schema.enrollment.offeringId),
  ),
  subject: and(
    sameOrg(schema.subject.organizationId),
    eq(schema.subject.id, schema.offering.subjectId),
  ),
  course: and(
    sameOrg(schema.course.organizationId),
    eq(schema.course.id, schema.offering.courseId),
  ),
};

const selectRows = (db: Pick<Database, "select">) =>
  db
    .select(rowColumns)
    .from(schema.enrollment)
    .innerJoin(schema.student, ON.student)
    .innerJoin(schema.person, ON.person)
    .innerJoin(schema.offering, ON.offering)
    .innerJoin(schema.subject, ON.subject)
    .innerJoin(schema.course, ON.course)
    .$dynamic();

const countRows = (db: Pick<Database, "select">) =>
  db
    .select({ total: count() })
    .from(schema.enrollment)
    .innerJoin(schema.student, ON.student)
    .innerJoin(schema.person, ON.person)
    .innerJoin(schema.offering, ON.offering)
    .innerJoin(schema.subject, ON.subject)
    .innerJoin(schema.course, ON.course)
    .$dynamic();

/** `final_score` is `numeric`: the driver returns a string. */
const toRow = <T extends { finalScore: string | null }>(
  row: T,
): Omit<T, "finalScore"> & { finalScore: number | null } => ({
  ...row,
  finalScore: row.finalScore === null ? null : Number(row.finalScore),
});

const inTenant = (organizationId: string, scope: SQL | undefined) =>
  and(eq(schema.enrollment.organizationId, organizationId), scope);

async function enrollmentRow(
  db: Pick<Database, "select">,
  organizationId: string,
  id: string,
  scope?: SQL,
) {
  const [row] = await selectRows(db)
    .where(and(inTenant(organizationId, scope), eq(schema.enrollment.id, id)))
    .limit(1);
  if (!row) throw notFound();
  return toRow(row);
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const lockEnrollment = async (tx: Tx, organizationId: string, id: string) => {
  const [row] = await tx
    .select()
    .from(schema.enrollment)
    .where(and(eq(schema.enrollment.organizationId, organizationId), eq(schema.enrollment.id, id)))
    .for("update");
  if (!row) throw notFound();
  return row;
};

const scoreOf = (value: string | null) => (value === null ? null : Number(value));

export const enrollmentRouter = {
  /** Server-list mode (R3.8): `{ rows, total }`; `total` ignores paging. */
  list: sigeProcedure
    .use(requirePermission({ enrollment: ["read"] }))
    .input(listInput)
    .handler(async ({ context, input }) => {
      const sorted = buildListQuery({
        columns: SORT_COLUMNS,
        input: { ...input, filters: [] },
        tieBreakers: [schema.enrollment.id],
      });
      const filtered = buildListWhere({
        columns: FILTER_COLUMNS,
        filters: input.filters,
        joinOperator: input.joinOperator,
      });
      const where = and(inTenant(context.org.id, context.scope.studentWhere()), filtered);
      const [rows, [totalRow]] = await Promise.all([
        selectRows(context.db)
          .where(where)
          .orderBy(...sorted.orderBy)
          .limit(sorted.limit)
          .offset(sorted.offset),
        countRows(context.db).where(where),
      ]);
      return { rows: rows.map(toRow), total: totalRow?.total ?? 0 };
    }),

  /** Tiles "Total Matrículas" and "Matrículas Activas". */
  stats: sigeProcedure
    .use(requirePermission({ enrollment: ["read"] }))
    .input(enrollmentStatsInput.default({}))
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${schema.enrollment.status} = 'activa')::int`,
        })
        .from(schema.enrollment)
        .innerJoin(
          schema.student,
          and(
            eq(schema.student.organizationId, schema.enrollment.organizationId),
            eq(schema.student.id, schema.enrollment.studentId),
          ),
        )
        .where(
          and(
            inTenant(context.org.id, context.scope.studentWhere()),
            input.academicYear ? eq(schema.enrollment.academicYear, input.academicYear) : undefined,
          ),
        );
      return { total: row?.total ?? 0, active: row?.active ?? 0 };
    }),

  get: sigeProcedure
    .use(requirePermission({ enrollment: ["read"] }))
    .input(enrollmentIdInput)
    .handler(({ context, input }) =>
      enrollmentRow(context.db, context.org.id, input.id, context.scope.studentWhere()),
    ),

  /** SCH-02: the course summary for the callout and the active students not in the course. */
  candidates: sigeProcedure
    .use(requirePermission({ enrollment: ["create"] }))
    .input(enrollmentCandidatesInput)
    .handler(async ({ context, input }) => {
      const orgId = context.org.id;
      const [course] = await context.db
        .select({
          id: schema.course.id,
          name: schema.course.name,
          maxStudents: schema.course.maxStudents,
        })
        .from(schema.course)
        .where(and(eq(schema.course.organizationId, orgId), eq(schema.course.id, input.courseId)));
      if (!course) throw courseNotFound();
      const pattern = input.search ? `%${escapeLikePattern(input.search)}%` : undefined;
      const currentCourse = sql<string | null>`(
        select ${schema.course.name} from ${schema.course}
        where ${schema.course.organizationId} = ${schema.student.organizationId}
          and ${schema.course.id} = ${schema.student.courseId})`;
      const [[members], [offerings], students] = await Promise.all([
        context.db
          .select({ value: count() })
          .from(schema.student)
          .where(
            and(
              eq(schema.student.organizationId, orgId),
              eq(schema.student.courseId, course.id),
              eq(schema.student.status, "activo"),
            ),
          ),
        context.db
          .select({ value: count() })
          .from(schema.offering)
          .where(
            and(eq(schema.offering.organizationId, orgId), eq(schema.offering.courseId, course.id)),
          ),
        context.db
          .select({
            id: schema.student.id,
            name: studentName,
            document: schema.person.documentNumber,
            currentCourseName: currentCourse,
          })
          .from(schema.student)
          .innerJoin(
            schema.person,
            and(
              eq(schema.person.organizationId, schema.student.organizationId),
              eq(schema.person.id, schema.student.personId),
            ),
          )
          .where(
            and(
              eq(schema.student.organizationId, orgId),
              context.scope.studentWhere(),
              eq(schema.student.status, "activo"),
              or(sql`${schema.student.courseId} is null`, ne(schema.student.courseId, course.id)),
              pattern
                ? or(ilike(studentName, pattern), ilike(schema.person.documentNumber, pattern))
                : undefined,
            ),
          )
          .orderBy(
            asc(schema.person.lastName),
            asc(schema.person.firstName),
            asc(schema.student.id),
          )
          .limit(input.limit),
      ]);
      return {
        course: {
          ...course,
          currentStudents: members?.value ?? 0,
          offeringCount: offerings?.value ?? 0,
        },
        students,
      };
    }),

  /** SCH-R5 / R2.9: one transaction; see the module comment for the lock order. */
  createBulk: sigeProcedure
    .use(requirePermission({ enrollment: ["create"] }))
    .input(enrollmentCreateBulkInput)
    .handler(async ({ context, input }) => {
      const orgId = context.org.id;
      const studentIds = [...new Set(input.studentIds)];
      let result: {
        courseId: string;
        students: number;
        created: number;
        skipped: number;
        overCapacity: boolean;
      };
      try {
        result = await context.db.transaction(async (tx) => {
          const [course] = await tx
            .select({
              id: schema.course.id,
              campusId: schema.course.campusId,
              academicYear: schema.course.academicYear,
              maxStudents: schema.course.maxStudents,
            })
            .from(schema.course)
            .where(
              and(eq(schema.course.organizationId, orgId), eq(schema.course.id, input.courseId)),
            )
            .for("update");
          if (!course) throw courseNotFound();
          const students = await tx
            .select({
              id: schema.student.id,
              status: schema.student.status,
              courseId: schema.student.courseId,
            })
            .from(schema.student)
            .where(
              and(
                eq(schema.student.organizationId, orgId),
                inArray(schema.student.id, studentIds),
                context.scope.studentWhere(),
              ),
            )
            .orderBy(asc(schema.student.id))
            .for("update");
          if (students.length !== studentIds.length) throw studentNotFound();
          const [offerings, existing, [members]] = await Promise.all([
            tx
              .select({ id: schema.offering.id })
              .from(schema.offering)
              .where(
                and(
                  eq(schema.offering.organizationId, orgId),
                  eq(schema.offering.courseId, course.id),
                ),
              ),
            tx
              .select({
                studentId: schema.enrollment.studentId,
                offeringId: schema.enrollment.offeringId,
                academicYear: schema.enrollment.academicYear,
              })
              .from(schema.enrollment)
              .where(
                and(
                  eq(schema.enrollment.organizationId, orgId),
                  inArray(schema.enrollment.studentId, studentIds),
                  eq(schema.enrollment.academicYear, course.academicYear),
                ),
              ),
            tx
              .select({ value: count() })
              .from(schema.student)
              .where(
                and(
                  eq(schema.student.organizationId, orgId),
                  eq(schema.student.courseId, course.id),
                  eq(schema.student.status, "activo"),
                ),
              ),
          ]);
          // Selection order, not lock order, drives the plan.
          const byId = new Map(students.map((student) => [student.id, student]));
          const plan = planBulkEnrollment({
            course,
            offeringIds: offerings.map((offering) => offering.id),
            students: studentIds.map((id) => byId.get(id)!),
            existing,
            currentStudents: members?.value ?? 0,
            allowOverCapacity: input.allowOverCapacity,
          });
          if (!plan.ok) throw new ORPCError("BAD_REQUEST", { message: plan.message });
          if (plan.rows.length > 0) {
            await tx
              .insert(schema.enrollment)
              .values(plan.rows.map((row) => ({ organizationId: orgId, ...row })));
          }
          await tx
            .update(schema.student)
            .set({ courseId: course.id, campusId: course.campusId })
            .where(
              and(
                eq(schema.student.organizationId, orgId),
                inArray(schema.student.id, plan.students),
              ),
            );
          return {
            courseId: course.id,
            students: plan.students.length,
            created: plan.created,
            skipped: plan.skipped,
            overCapacity: plan.overCapacity,
          };
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      const { courseId, ...summary } = result;
      await recordAudit(context, {
        action: "enrollment.bulk_created",
        targetType: "course",
        targetId: courseId,
        metadata: {
          courseId,
          students: summary.students,
          created: summary.created,
          skipped: summary.skipped,
          overCapacity: summary.overCapacity,
        },
      });
      return summary;
    }),

  /** SCH-R8: status, the hand-edited final score and the note; nothing else changes. */
  update: sigeProcedure
    .use(requirePermission({ enrollment: ["update"] }))
    .input(enrollmentUpdateInput)
    .handler(async ({ context, input }) => {
      const after: Record<string, unknown> = { status: input.status };
      if (input.finalScore !== undefined) after.finalScore = input.finalScore;
      if (input.statusNote !== undefined) after.statusNote = input.statusNote;
      let before: Record<string, unknown>;
      try {
        before = await context.db.transaction(async (tx) => {
          const current = await lockEnrollment(tx, context.org.id, input.id);
          await tx
            .update(schema.enrollment)
            .set({
              status: input.status,
              ...(input.finalScore !== undefined
                ? { finalScore: input.finalScore === null ? null : String(input.finalScore) }
                : {}),
              ...(input.statusNote !== undefined ? { statusNote: input.statusNote } : {}),
            })
            .where(
              and(
                eq(schema.enrollment.organizationId, context.org.id),
                eq(schema.enrollment.id, input.id),
              ),
            );
          return {
            status: current.status,
            finalScore: scoreOf(current.finalScore),
            statusNote: current.statusNote,
          };
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      const row = await enrollmentRow(context.db, context.org.id, input.id);
      await recordAudit(context, {
        action: "enrollment.updated",
        targetType: "enrollment",
        targetId: input.id,
        metadata: {
          student: row.studentName,
          subject: row.subjectName,
          changes: changedFields(before, after),
        },
      });
      return row;
    }),

  delete: sigeProcedure
    .use(requirePermission({ enrollment: ["delete"] }))
    .input(enrollmentIdInput)
    .handler(async ({ context, input }) => {
      let snapshot: Record<string, unknown>;
      try {
        snapshot = await context.db.transaction(async (tx) => {
          await lockEnrollment(tx, context.org.id, input.id);
          const row = await enrollmentRow(tx, context.org.id, input.id);
          await tx
            .delete(schema.enrollment)
            .where(
              and(
                eq(schema.enrollment.organizationId, context.org.id),
                eq(schema.enrollment.id, input.id),
              ),
            );
          return {
            student: row.studentName,
            document: row.document,
            subject: row.subjectName,
            course: row.courseName,
            status: row.status,
            finalScore: row.finalScore,
          };
        });
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "enrollment.deleted",
        targetType: "enrollment",
        targetId: input.id,
        metadata: { snapshot },
      });
      return { deleted: true as const };
    }),
};

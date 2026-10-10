import type { Database } from "@base-template/db";
import { buildListQuery } from "@base-template/db/lib/list-query";
import type { ListColumns } from "@base-template/db/lib/list-query";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, countDistinct, desc, eq, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "../../index";
import { courseListConfig } from "../../lib/course-list-config";
import { createListInput } from "../../lib/list-input";
import { changedFields, recordAudit } from "../../sige/audit";
import { assertCourseDirector, isActiveTeacher } from "../../sige/course-director";
import { COURSE_HAS_STUDENTS_MESSAGE, HAS_DEPENDENTS, rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { activeStudentsOfCourse } from "../../sige/student-queries";
import { onMember } from "../../sige/user-queries";
import { courseInput } from "../../sige/schemas/institution";

/**
 * `course.*` (sige/02 §3.3, INS-11/12). Server list mode (R3.8): the shared list contract with the
 * allowlists of `course-list-config.ts`. The tenant comes from `context.org`; another tenant's id
 * is `NOT_FOUND`. The composite FKs are the arbiter for the campus (`NOT_FOUND`) and for "the
 * level belongs to the course's campus" (`BAD_REQUEST`, §4.1); uniqueness is the unique
 * constraint (`CONFLICT`). The director must be an active teacher of the institution
 * (`BAD_REQUEST`, D9; `sige/course-director.ts`). Deletes rely on the `restrict` FKs (students,
 * offerings; §4.2); under the course row lock, students are pre-checked so the §4.2 order holds
 * whichever FK Postgres reports. INS-R6: the campus is locked once the course has students,
 * offerings or slots (checked under the same row lock).
 */

const idInput = z.object({ id: z.string().min(1) });
const updateInput = courseInput.extend({ id: z.string().min(1) });
const listInput = createListInput(courseListConfig);
const optionsInput = z
  .object({ campusId: z.string().min(1).optional(), academicYear: z.string().min(1).optional() })
  .default({});

const notFound = () => new ORPCError("NOT_FOUND", { message: "El grado no existe." });

/** Active students of the course (sige/02 `CourseRow.studentCount`, D3). */
const studentCount = activeStudentsOfCourse;
const directorName = sql<
  string | null
>`${schema.person.firstName} || ' ' || ${schema.person.lastName}`;

const rowColumns = {
  id: schema.course.id,
  name: schema.course.name,
  campusId: schema.course.campusId,
  campusName: schema.campus.name,
  levelId: schema.course.levelId,
  levelName: schema.gradeLevel.name,
  directorPersonId: schema.course.directorPersonId,
  directorName,
  // Null without a director; false once the person was deactivated or lost the teacher role
  // (the form labels it "(inactivo)"). Same rule as `assertCourseDirector`.
  directorActive: sql<
    boolean | null
  >`case when ${schema.person.id} is null then null else coalesce(${isActiveTeacher}, false) end`,
  academicYear: schema.course.academicYear,
  shift: schema.course.shift,
  maxStudents: schema.course.maxStudents,
  studentCount,
};

/** List-input ids to columns; the only way a client id reaches SQL. */
const LIST_COLUMNS = {
  name: schema.course.name,
  campus: schema.campus.name,
  director: schema.person.lastName,
  academicYear: schema.course.academicYear,
  shift: schema.course.shift,
  maxStudents: schema.course.maxStudents,
  studentCount: studentCount as unknown as AnyColumn,
  campusId: schema.course.campusId,
  levelId: schema.course.levelId,
} as const satisfies ListColumns;

/** Course rows with campus, level and director names, scoped to one institution. */
const selectRows = (db: Pick<Database, "select">, organizationId: string) =>
  db
    .select(rowColumns)
    .from(schema.course)
    .innerJoin(
      schema.campus,
      and(
        eq(schema.campus.organizationId, schema.course.organizationId),
        eq(schema.campus.id, schema.course.campusId),
      ),
    )
    .leftJoin(
      schema.gradeLevel,
      and(
        eq(schema.gradeLevel.organizationId, schema.course.organizationId),
        eq(schema.gradeLevel.id, schema.course.levelId),
      ),
    )
    .leftJoin(
      schema.person,
      and(
        eq(schema.person.organizationId, schema.course.organizationId),
        eq(schema.person.id, schema.course.directorPersonId),
      ),
    )
    .leftJoin(schema.member, onMember)
    .$dynamic()
    .where(eq(schema.course.organizationId, organizationId));

const byId = (organizationId: string, id: string) =>
  and(eq(schema.course.organizationId, organizationId), eq(schema.course.id, id));

async function toRow(db: Database, organizationId: string, id: string) {
  const [row] = await selectRows(db, organizationId).where(byId(organizationId, id)).limit(1);
  if (!row) throw notFound();
  return row;
}

const AUDITED_FIELDS = [
  "name",
  "campusId",
  "levelId",
  "academicYear",
  "shift",
  "maxStudents",
] as const;

/** Audit view of a course; the director is keyed `director` (OD-21: it changes teacher scope). */
const auditView = (row: Record<string, unknown>) => ({
  ...Object.fromEntries(AUDITED_FIELDS.map((field) => [field, row[field] ?? null])),
  director: row.directorPersonId ?? null,
});

/** Optional ids left out of a full-replace update clear the column. */
const columnsFrom = (input: z.infer<typeof courseInput>) => ({
  campusId: input.campusId,
  levelId: input.levelId ?? null,
  directorPersonId: input.directorPersonId ?? null,
  name: input.name,
  academicYear: input.academicYear,
  shift: input.shift,
  maxStudents: input.maxStudents,
});

/** sige/02 INS-R6. */
const CAMPUS_LOCKED_MESSAGE =
  "No se puede cambiar la sede de un grado con estudiantes o asignaturas.";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Whether `table` has a row of the tenant whose `column` equals `id`. */
async function hasRow(
  tx: Tx,
  table: typeof schema.student | typeof schema.offering | typeof schema.scheduleSlot,
  column: AnyColumn,
  organizationId: string,
  id: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ one: sql`1` })
    .from(table)
    .where(and(eq(table.organizationId, organizationId), eq(column, id)))
    .limit(1);
  return row !== undefined;
}

/** INS-R6: a course with students (any status), offerings or slots keeps its campus. */
async function assertCampusMovable(tx: Tx, organizationId: string, courseId: string) {
  const dependents = await Promise.all([
    hasRow(tx, schema.student, schema.student.courseId, organizationId, courseId),
    hasRow(tx, schema.offering, schema.offering.courseId, organizationId, courseId),
    hasRow(tx, schema.scheduleSlot, schema.scheduleSlot.courseId, organizationId, courseId),
  ]);
  if (dependents.some(Boolean)) {
    throw new ORPCError("CONFLICT", { status: 409, message: CAMPUS_LOCKED_MESSAGE });
  }
}

export const courseRouter = {
  /** Server-list mode (R3.8): `{ rows, total }`; `total` ignores paging. */
  list: sigeProcedure
    .use(requirePermission({ course: ["read"] }))
    .input(listInput)
    .handler(async ({ context, input }) => {
      const query = buildListQuery({
        columns: LIST_COLUMNS,
        input,
        tieBreakers: [schema.course.id],
      });
      const scope = and(eq(schema.course.organizationId, context.org.id), query.where);
      const [rows, [totalRow]] = await Promise.all([
        selectRows(context.db, context.org.id)
          .where(scope)
          .orderBy(...query.orderBy)
          .limit(query.limit)
          .offset(query.offset),
        // Filters only reference `course` columns, so the count needs no joins.
        context.db.select({ total: count() }).from(schema.course).where(scope),
      ]);
      return { rows, total: totalRow?.total ?? 0 };
    }),

  stats: sigeProcedure.use(requirePermission({ course: ["read"] })).handler(async ({ context }) => {
    const [row] = await context.db
      .select({
        total: count(),
        campusesWithCourses: countDistinct(schema.course.campusId),
        withDirector: count(schema.course.directorPersonId),
      })
      .from(schema.course)
      .where(eq(schema.course.organizationId, context.org.id));
    return {
      total: row?.total ?? 0,
      campusesWithCourses: row?.campusesWithCourses ?? 0,
      withDirector: row?.withDirector ?? 0,
    };
  }),

  /** Course selects of every module (all roles with `course:read`). */
  options: sigeProcedure
    .use(requirePermission({ course: ["read"] }))
    .input(optionsInput)
    .handler(({ context, input }) =>
      context.db
        .select({
          id: schema.course.id,
          name: schema.course.name,
          campusId: schema.course.campusId,
          shift: schema.course.shift,
          academicYear: schema.course.academicYear,
        })
        .from(schema.course)
        .where(
          and(
            eq(schema.course.organizationId, context.org.id),
            input.campusId ? eq(schema.course.campusId, input.campusId) : undefined,
            input.academicYear ? eq(schema.course.academicYear, input.academicYear) : undefined,
          ),
        )
        .orderBy(
          desc(schema.course.academicYear),
          asc(schema.course.name),
          asc(schema.course.shift),
          asc(schema.course.id),
        ),
    ),

  get: sigeProcedure
    .use(requirePermission({ course: ["read"] }))
    .input(idInput)
    .handler(({ context, input }) => toRow(context.db, context.org.id, input.id)),

  create: sigeProcedure
    .use(requirePermission({ course: ["create"] }))
    .input(courseInput)
    .handler(async ({ context, input }) => {
      const values = columnsFrom(input);
      await assertCourseDirector(context.db, context.org.id, values.directorPersonId);
      let id: string;
      try {
        const [row] = await context.db
          .insert(schema.course)
          .values({ organizationId: context.org.id, ...values })
          .returning({ id: schema.course.id });
        if (!row) throw new Error("Course insert returned no row.");
        id = row.id;
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "course.created",
        targetType: "course",
        targetId: id,
        metadata: { after: auditView(values) },
      });
      return toRow(context.db, context.org.id, id);
    }),

  update: sigeProcedure
    .use(requirePermission({ course: ["update"] }))
    .input(updateInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      const values = columnsFrom(input);
      await assertCourseDirector(
        context.db,
        context.org.id,
        values.directorPersonId,
        before.directorPersonId,
      );
      try {
        await context.db.transaction(async (tx) => {
          // The row lock conflicts with the key-share lock that a student, offering or slot
          // insert takes on its course, so "has dependents" cannot change before the update.
          const [current] = await tx
            .select({ campusId: schema.course.campusId })
            .from(schema.course)
            .where(byId(context.org.id, input.id))
            .for("update");
          if (!current) throw notFound();
          if (current.campusId !== values.campusId) {
            await assertCampusMovable(tx, context.org.id, input.id);
          }
          await tx.update(schema.course).set(values).where(byId(context.org.id, input.id));
        });
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "course.updated",
        targetType: "course",
        targetId: input.id,
        metadata: {
          name: values.name,
          changes: changedFields(auditView(before), auditView(values)),
        },
      });
      return toRow(context.db, context.org.id, input.id);
    }),

  delete: sigeProcedure
    .use(requirePermission({ course: ["delete"] }))
    .input(idInput)
    .handler(async ({ context, input }) => {
      const before = await toRow(context.db, context.org.id, input.id);
      try {
        await context.db.transaction(async (tx) => {
          const [current] = await tx
            .select({ id: schema.course.id })
            .from(schema.course)
            .where(byId(context.org.id, input.id))
            .for("update");
          if (!current) throw notFound();
          // sige/02 §4.2 order: students before offerings (Postgres picks the FK it reports).
          if (await hasRow(tx, schema.student, schema.student.courseId, context.org.id, input.id)) {
            throw new ORPCError(HAS_DEPENDENTS, {
              status: 409,
              message: COURSE_HAS_STUDENTS_MESSAGE,
            });
          }
          await tx.delete(schema.course).where(byId(context.org.id, input.id));
        });
      } catch (error) {
        return rethrowDbError(error, "delete");
      }
      await recordAudit(context, {
        action: "course.deleted",
        targetType: "course",
        targetId: input.id,
        metadata: {
          snapshot: { name: before.name, academicYear: before.academicYear, shift: before.shift },
        },
      });
      return { deleted: true as const };
    }),
};

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
import { assertCourseDirector } from "../../sige/course-director";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { courseInput } from "../../sige/schemas/institution";

/**
 * `course.*` (sige/02 §3.3, INS-11/12). Server list mode (R3.8): the shared list contract with the
 * allowlists of `course-list-config.ts`. The tenant comes from `context.org`; another tenant's id
 * is `NOT_FOUND`. The composite FKs are the arbiter for the campus (`NOT_FOUND`) and for "the
 * level belongs to the course's campus" (`BAD_REQUEST`, §4.1); uniqueness is the unique
 * constraint (`CONFLICT`). The director must be an active teacher of the institution
 * (`BAD_REQUEST`, D9; `sige/course-director.ts`). Deletes rely on the `restrict` FKs later modules add (students,
 * offerings; §4.2), never on a racy pre-check.
 */

const idInput = z.object({ id: z.string().min(1) });
const updateInput = courseInput.extend({ id: z.string().min(1) });
const listInput = createListInput(courseListConfig);
const optionsInput = z
  .object({ campusId: z.string().min(1).optional(), academicYear: z.string().min(1).optional() })
  .default({});

const notFound = () => new ORPCError("NOT_FOUND", { message: "El grado no existe." });

/** No student table exists yet (module 05): every course has none. Replaced by a real count then. */
const studentCount = sql<number>`0::int`;
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
  // Null without a director; false once the person was deactivated (the form labels it "(inactivo)").
  directorActive: sql<boolean | null>`${schema.person.isActive}`,
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
  // Constant until students exist: sorting by it falls through to the tie-breakers.
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
        const affected = await context.db
          .update(schema.course)
          .set(values)
          .where(byId(context.org.id, input.id))
          .returning({ id: schema.course.id });
        if (affected.length === 0) throw notFound();
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
        const affected = await context.db
          .delete(schema.course)
          .where(byId(context.org.id, input.id))
          .returning({ id: schema.course.id });
        if (affected.length === 0) throw notFound();
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

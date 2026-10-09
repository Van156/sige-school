import * as schema from "@base-template/db/schema";
import type { Database } from "@base-template/db";
import { buildScheduleRows } from "@base-template/sige-core";
import type { GridBlock, GridEntry, WeeklySchedule } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, eq, exists, inArray, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { requireAnyPermission, requirePermission } from "../../index";
import { currentAcademicYear } from "../../sige/academic-year";
import { recordAudit } from "../../sige/audit";
import { rethrowDbError } from "../../sige/pg-errors";
import { sigeProcedure } from "../../sige/procedure";
import { TEACHER_SCOPE_STATUSES } from "../../sige/scope-resolvers";
import { regenerateSlots } from "../../sige/schedule-generation";
import {
  scheduleDeleteSlotInput,
  scheduleGenerateInput,
  scheduleGetInput,
} from "../../sige/schemas/scheduling";

/**
 * `schedule.*` (sige/04 §3.5, SCH-11/12, SCH-R9/R10/R12).
 *
 * - `generate` runs `regenerateSlots` in ONE transaction under the institution advisory lock it
 *   shares with the time-block writes (see `lockScheduleWrites`); the audit event follows the
 *   commit, like every other router.
 * - `get` builds a `WeeklySchedule` with `buildScheduleRows`. Managers read any course; a teacher
 *   reads `view: "teacher"` (their own slots, only for `activo`/`temporal` assignments: the scope
 *   predicate, D3) or a course holding one of their offerings in scope. A student fails closed
 *   until P4 ships `student.course_id` scope (own course); the permission gate keeps parents out.
 * - `deleteSlot` removes one slot of the tenant.
 */

const timeText = (column: typeof schema.scheduleSlot.startTime) => sql<string>`${column}::text`;

const personName = sql<string>`${schema.person.firstName} || ' ' || ${schema.person.lastName}`;

/** Courses may be `Sabatina`, which no block ever has: compare as text, the enums differ. */
const blockShift = (shift: string) => sql`${schema.timeBlock.shift}::text = ${shift}`;

const gridBlock = (block: { startTime: string; endTime: string; isBreak: boolean }): GridBlock => ({
  startTime: block.startTime,
  endTime: block.endTime,
  isBreak: block.isBreak,
});

/** Slots (active only) joined with the names a grid cell shows, for the given predicate. */
const selectCells = (db: Pick<Database, "select">, where: SQL | undefined) =>
  db
    .select({
      slotId: schema.scheduleSlot.id,
      offeringId: schema.scheduleSlot.offeringId,
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
      startTime: timeText(schema.scheduleSlot.startTime),
      endTime: timeText(schema.scheduleSlot.endTime),
      subjectName: schema.subject.name,
      teacherName: sql<string | null>`(
        select ${personName} from ${schema.person}
        where ${schema.person.organizationId} = ${schema.scheduleSlot.organizationId}
          and ${schema.person.id} = ${schema.scheduleSlot.teacherPersonId}
      )`,
      classroomName: schema.classroom.name,
      courseName: schema.course.name,
    })
    .from(schema.scheduleSlot)
    .innerJoin(
      schema.offering,
      and(
        eq(schema.offering.organizationId, schema.scheduleSlot.organizationId),
        eq(schema.offering.id, schema.scheduleSlot.offeringId),
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
      schema.classroom,
      and(
        eq(schema.classroom.organizationId, schema.scheduleSlot.organizationId),
        eq(schema.classroom.id, schema.scheduleSlot.classroomId),
      ),
    )
    .innerJoin(
      schema.course,
      and(
        eq(schema.course.organizationId, schema.scheduleSlot.organizationId),
        eq(schema.course.id, schema.scheduleSlot.courseId),
      ),
    )
    .where(and(eq(schema.scheduleSlot.isActive, true), where))
    .orderBy(schema.scheduleSlot.dayOfWeek, schema.scheduleSlot.startTime, schema.scheduleSlot.id);

const toEntries = (cells: Awaited<ReturnType<typeof selectCells>>): GridEntry[] =>
  cells.map(({ dayOfWeek, startTime, endTime, ...cell }) => ({
    dayOfWeek,
    startTime,
    endTime,
    cell,
  }));

export const scheduleRouter = {
  /** SCH-11. Gate: `schedule:read` or `student:read`; scope decides what the caller may see. */
  get: sigeProcedure
    .use(requireAnyPermission({ schedule: ["read"] }, { student: ["read"] }))
    .input(scheduleGetInput)
    .handler(async ({ context, input }): Promise<WeeklySchedule> => {
      const orgId = context.org.id;
      const { kind } = context.person;
      // P4 adds the student's own course (`student.course_id`); until then fail closed (R1.15).
      if (kind === "student") {
        throw new ORPCError("NOT_FOUND", { message: "El horario no existe." });
      }
      if (kind === "parent") {
        throw new ORPCError("FORBIDDEN", { message: "Missing required organization permission." });
      }

      if (input.view === "teacher") {
        const year = await currentAcademicYear(context.db, orgId);
        // D3 applied explicitly: the scope predicate is undefined for unrestricted callers, so a
        // manager who also teaches would otherwise see `inactivo` assignments. Managers who do
        // not teach get an empty grid.
        const own = and(
          eq(schema.offering.teacherPersonId, context.person.id),
          eq(schema.course.academicYear, year),
          exists(
            context.db
              .select({ one: sql`1` })
              .from(schema.teacherAssignment)
              .where(
                and(
                  eq(schema.teacherAssignment.organizationId, schema.offering.organizationId),
                  eq(schema.teacherAssignment.offeringId, schema.offering.id),
                  inArray(schema.teacherAssignment.status, [...TEACHER_SCOPE_STATUSES]),
                ),
              ),
          ),
        );
        const [courses, cells] = await Promise.all([
          context.db
            .selectDistinct({ campusId: schema.course.campusId, shift: schema.course.shift })
            .from(schema.offering)
            .innerJoin(
              schema.course,
              and(
                eq(schema.course.organizationId, schema.offering.organizationId),
                eq(schema.course.id, schema.offering.courseId),
              ),
            )
            .where(and(eq(schema.offering.organizationId, orgId), own)),
          selectCells(context.db, and(eq(schema.scheduleSlot.organizationId, orgId), own)),
        ]);
        const blocks =
          courses.length === 0
            ? []
            : await context.db
                .select({
                  startTime: sql<string>`${schema.timeBlock.startTime}::text`,
                  endTime: sql<string>`${schema.timeBlock.endTime}::text`,
                  isBreak: schema.timeBlock.isBreak,
                })
                .from(schema.timeBlock)
                .where(
                  and(
                    eq(schema.timeBlock.organizationId, orgId),
                    eq(schema.timeBlock.academicYear, year),
                    or(
                      ...courses.map((course) =>
                        and(
                          eq(schema.timeBlock.campusId, course.campusId),
                          blockShift(course.shift),
                        ),
                      ),
                    ),
                  ),
                );
        return {
          title: `Horario de ${context.person.firstName} ${context.person.lastName}`,
          rows: buildScheduleRows(blocks.map(gridBlock), toEntries(cells)),
        };
      }

      if (!input.courseId) {
        throw new ORPCError("BAD_REQUEST", { message: "Debes seleccionar un grado." });
      }
      const notFound = () => new ORPCError("NOT_FOUND", { message: "El grado no existe." });
      const [course] = await context.db
        .select({
          id: schema.course.id,
          name: schema.course.name,
          campusId: schema.course.campusId,
          shift: schema.course.shift,
          academicYear: schema.course.academicYear,
        })
        .from(schema.course)
        .where(and(eq(schema.course.organizationId, orgId), eq(schema.course.id, input.courseId)))
        .limit(1);
      if (!course) throw notFound();
      const scoped = context.scope.offeringWhere();
      if (scoped) {
        // A restricted caller reads a course only through an offering inside their scope.
        const [visible] = await context.db
          .select({ id: schema.offering.id })
          .from(schema.offering)
          .where(
            and(
              eq(schema.offering.organizationId, orgId),
              eq(schema.offering.courseId, course.id),
              scoped,
            ),
          )
          .limit(1);
        if (!visible) throw notFound();
      }
      const [blocks, cells] = await Promise.all([
        context.db
          .select({
            startTime: sql<string>`${schema.timeBlock.startTime}::text`,
            endTime: sql<string>`${schema.timeBlock.endTime}::text`,
            isBreak: schema.timeBlock.isBreak,
          })
          .from(schema.timeBlock)
          .where(
            and(
              eq(schema.timeBlock.organizationId, orgId),
              eq(schema.timeBlock.campusId, course.campusId),
              blockShift(course.shift),
              eq(schema.timeBlock.academicYear, course.academicYear),
            ),
          ),
        selectCells(
          context.db,
          and(
            eq(schema.scheduleSlot.organizationId, orgId),
            eq(schema.scheduleSlot.courseId, course.id),
          ),
        ),
      ]);
      return {
        title: `Horario del grado ${course.name}`,
        rows: buildScheduleRows(blocks.map(gridBlock), toEntries(cells)),
      };
    }),

  /** SCH-12 / SCH-R10. */
  generate: sigeProcedure
    .use(requirePermission({ schedule: ["generate"] }))
    .input(scheduleGenerateInput)
    .handler(async ({ context, input }) => {
      let result: Awaited<ReturnType<typeof regenerateSlots>>;
      try {
        result = await context.db.transaction((tx) =>
          regenerateSlots(tx, context.org.id, {
            campusId: input.campusId,
            courseId: input.courseId,
          }),
        );
      } catch (error) {
        return rethrowDbError(error, "write");
      }
      await recordAudit(context, {
        action: "schedule.generated",
        targetType: "schedule",
        targetId: input.courseId ?? input.campusId ?? context.org.id,
        metadata: {
          assigned: result.assigned,
          conflicts: result.conflicts,
          courses: result.courses,
        },
      });
      return result;
    }),

  /** SCH-11 manager action: one audit event per slot (sige/04 §6). */
  deleteSlot: sigeProcedure
    .use(requirePermission({ schedule: ["update"] }))
    .input(scheduleDeleteSlotInput)
    .handler(async ({ context, input }) => {
      const [removed] = await context.db
        .delete(schema.scheduleSlot)
        .where(
          and(
            eq(schema.scheduleSlot.organizationId, context.org.id),
            eq(schema.scheduleSlot.id, input.slotId),
          ),
        )
        .returning({
          offeringId: schema.scheduleSlot.offeringId,
          dayOfWeek: schema.scheduleSlot.dayOfWeek,
          startTime: timeText(schema.scheduleSlot.startTime),
          endTime: timeText(schema.scheduleSlot.endTime),
        });
      if (!removed) throw new ORPCError("NOT_FOUND", { message: "La clase no existe." });
      await recordAudit(context, {
        action: "schedule.slot_deleted",
        targetType: "schedule_slot",
        targetId: input.slotId,
        metadata: {
          offeringId: removed.offeringId,
          dayOfWeek: removed.dayOfWeek,
          startTime: removed.startTime.slice(0, 5),
          endTime: removed.endTime.slice(0, 5),
        },
      });
      return { deleted: true as const };
    }),
};

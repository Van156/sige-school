import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { generateSchedule } from "@base-template/sige-core";
import type { BusyEntry, ClassroomType, SolverInput } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";

import { currentAcademicYear } from "./academic-year";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type GenerateScheduleTarget = { campusId?: string; courseId?: string };

export type GenerateScheduleResult = {
  assigned: number;
  conflicts: number;
  courses: number;
  skipped: { courseId: string; courseName: string; reason: string }[];
};

/** Rows inserted per statement: 9 columns each, far below the driver's parameter limit. */
const INSERT_CHUNK = 500;

/**
 * The institution advisory lock of the time-block writes (`timeBlock.create/update/delete`).
 * Generation reuses that exact key instead of introducing a second one: a block retime or delete
 * decides "in use" from the committed slots, so it must wait for a generation that is about to
 * rewrite them, and two generations must not interleave their delete-then-insert. One key also
 * means a single lock order (lock first, rows after), so the two writers cannot deadlock.
 */
export async function lockScheduleWrites(tx: Tx, organizationId: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:time_block`}, 0))`,
  );
}

/**
 * SCH-R10: regenerates the slots of the target courses (`courseId` wins over `campusId`; none =
 * every course of the current academic year) inside the caller's transaction. Courses of inactive
 * campuses are never targets (SCH-R12). Busy teachers and rooms come from the ACTIVE slots of the
 * non-target courses; the target courses' own slots are deleted first and the solver's output is
 * persisted with the denormalised `course_id` / `teacher_person_id` (D1).
 */
export async function regenerateSlots(
  tx: Tx,
  organizationId: string,
  target: GenerateScheduleTarget,
): Promise<GenerateScheduleResult> {
  await lockScheduleWrites(tx, organizationId);
  const year = await currentAcademicYear(tx, organizationId);

  if (target.courseId) {
    const [known] = await tx
      .select({ id: schema.course.id })
      .from(schema.course)
      .where(
        and(
          eq(schema.course.organizationId, organizationId),
          eq(schema.course.id, target.courseId),
        ),
      )
      .limit(1);
    if (!known) throw new ORPCError("NOT_FOUND", { message: "El grado no existe." });
  } else if (target.campusId) {
    const [known] = await tx
      .select({ id: schema.campus.id })
      .from(schema.campus)
      .where(
        and(
          eq(schema.campus.organizationId, organizationId),
          eq(schema.campus.id, target.campusId),
        ),
      )
      .limit(1);
    if (!known) throw new ORPCError("NOT_FOUND", { message: "La sede no existe." });
  }

  const targets = await tx
    .select({
      id: schema.course.id,
      name: schema.course.name,
      campusId: schema.course.campusId,
      campusName: schema.campus.name,
      shift: schema.course.shift,
      academicYear: schema.course.academicYear,
    })
    .from(schema.course)
    .innerJoin(
      schema.campus,
      and(
        eq(schema.campus.organizationId, schema.course.organizationId),
        eq(schema.campus.id, schema.course.campusId),
      ),
    )
    .where(
      and(
        eq(schema.course.organizationId, organizationId),
        eq(schema.course.academicYear, year),
        eq(schema.campus.active, true),
        target.courseId
          ? eq(schema.course.id, target.courseId)
          : target.campusId
            ? eq(schema.course.campusId, target.campusId)
            : undefined,
      ),
    );
  if (targets.length === 0) return { assigned: 0, conflicts: 0, courses: 0, skipped: [] };

  const courseIds = targets.map((course) => course.id);
  const campusIds = [...new Set(targets.map((course) => course.campusId))];

  // Position of each course among ALL courses of its campus and year (not only the targets), so
  // regenerating one course keeps the home room a full generation gave it.
  const ranked = await tx
    .select({ id: schema.course.id, campusId: schema.course.campusId })
    .from(schema.course)
    .where(
      and(
        eq(schema.course.organizationId, organizationId),
        eq(schema.course.academicYear, year),
        inArray(schema.course.campusId, campusIds),
      ),
    )
    .orderBy(asc(schema.course.campusId), asc(schema.course.name), asc(schema.course.id));
  const rankOf = new Map<string, number>();
  const counters = new Map<string, number>();
  for (const row of ranked) {
    const next = counters.get(row.campusId) ?? 0;
    rankOf.set(row.id, next);
    counters.set(row.campusId, next + 1);
  }

  // Key-share lock: a concurrent teacher change (FOR UPDATE on the offering) waits for this
  // transaction, so the teacher copied into the slots cannot go stale before the insert.
  const offerings = await tx
    .select({
      id: schema.offering.id,
      courseId: schema.offering.courseId,
      subjectName: schema.subject.name,
      teacherPersonId: schema.offering.teacherPersonId,
      hoursPerWeek: schema.offering.hoursPerWeek,
    })
    .from(schema.offering)
    .innerJoin(
      schema.subject,
      and(
        eq(schema.subject.organizationId, schema.offering.organizationId),
        eq(schema.subject.id, schema.offering.subjectId),
      ),
    )
    .where(
      and(
        eq(schema.offering.organizationId, organizationId),
        inArray(schema.offering.courseId, courseIds),
      ),
    )
    .for("key share", { of: schema.offering });

  const blocks = await tx
    .select({
      campusId: schema.timeBlock.campusId,
      shift: schema.timeBlock.shift,
      academicYear: schema.timeBlock.academicYear,
      isBreak: schema.timeBlock.isBreak,
      orderNum: schema.timeBlock.orderNum,
      startTime: schema.timeBlock.startTime,
      endTime: schema.timeBlock.endTime,
    })
    .from(schema.timeBlock)
    .where(
      and(
        eq(schema.timeBlock.organizationId, organizationId),
        eq(schema.timeBlock.academicYear, year),
        inArray(schema.timeBlock.campusId, campusIds),
      ),
    );

  const classrooms = await tx
    .select({
      id: schema.classroom.id,
      campusId: schema.classroom.campusId,
      code: schema.classroom.code,
      classroomType: schema.classroom.classroomType,
    })
    .from(schema.classroom)
    .where(
      and(
        eq(schema.classroom.organizationId, organizationId),
        inArray(schema.classroom.campusId, campusIds),
      ),
    );

  const taken = await tx
    .select({
      id: schema.scheduleSlot.id,
      classroomId: schema.scheduleSlot.classroomId,
      teacherPersonId: schema.scheduleSlot.teacherPersonId,
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
    })
    .from(schema.scheduleSlot)
    .where(
      and(
        eq(schema.scheduleSlot.organizationId, organizationId),
        eq(schema.scheduleSlot.academicYear, year),
        eq(schema.scheduleSlot.isActive, true),
        notInArray(schema.scheduleSlot.courseId, courseIds),
      ),
    );
  const busyTeachers: BusyEntry[] = [];
  const busyClassrooms: BusyEntry[] = [];
  for (const slot of taken) {
    const when = { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime };
    busyClassrooms.push({ id: slot.classroomId, ...when });
    if (slot.teacherPersonId) busyTeachers.push({ id: slot.teacherPersonId, ...when });
  }

  const input: SolverInput = {
    courses: targets.map((course) => ({
      id: course.id,
      name: course.name,
      campusId: course.campusId,
      campusName: course.campusName,
      shift: course.shift,
      academicYear: course.academicYear,
      campusRank: rankOf.get(course.id) ?? 0,
    })),
    offerings: offerings.map((offering) => ({
      id: offering.id,
      courseId: offering.courseId,
      subjectName: offering.subjectName,
      teacherPersonId: offering.teacherPersonId,
      hoursPerWeek: offering.hoursPerWeek,
    })),
    blocks,
    classrooms: classrooms.map((room) => ({
      ...room,
      classroomType: room.classroomType as ClassroomType,
    })),
    busyTeachers,
    busyClassrooms,
  };

  await tx
    .delete(schema.scheduleSlot)
    .where(
      and(
        eq(schema.scheduleSlot.organizationId, organizationId),
        inArray(schema.scheduleSlot.courseId, courseIds),
      ),
    );

  const result = generateSchedule(input);
  const teacherOf = new Map(offerings.map((offering) => [offering.id, offering.teacherPersonId]));
  const rows = result.slots.map((slot) => ({
    organizationId,
    offeringId: slot.offeringId,
    courseId: slot.courseId,
    teacherPersonId: teacherOf.get(slot.offeringId) ?? null,
    classroomId: slot.classroomId,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    academicYear: slot.academicYear,
  }));
  for (let from = 0; from < rows.length; from += INSERT_CHUNK) {
    await tx.insert(schema.scheduleSlot).values(rows.slice(from, from + INSERT_CHUNK));
  }

  return {
    assigned: result.assigned,
    conflicts: result.conflicts,
    courses: targets.length,
    skipped: result.skipped,
  };
}

import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { planBulkEnrollment } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

/**
 * The SCH-R5 enrollment routine (sige/04 §3.3, sige/05 STU-R3), shared by `enrollment.createBulk`
 * and the student admissions (`student.create` / `complete`, later the import). It runs inside
 * the caller's transaction with a fixed lock order: the course row first (`lockEnrollmentCourse`,
 * `FOR UPDATE`, so concurrent callers on one course serialise and each capacity count sees the
 * previous caller's members), then the selected students in id order. `planBulkEnrollment`
 * decides refusals and rows; existing `(student, offering, year)` rows are skipped.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const courseNotFound = () => new ORPCError("NOT_FOUND", { message: "El grado no existe." });
export const studentNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "El estudiante no existe." });

export type EnrollmentCourse = {
  id: string;
  campusId: string;
  academicYear: string;
  maxStudents: number;
};

/** Locks the course row (`FOR UPDATE`); `NOT_FOUND` outside the tenant. Always the first lock. */
export async function lockEnrollmentCourse(
  tx: Tx,
  organizationId: string,
  courseId: string,
): Promise<EnrollmentCourse> {
  const [course] = await tx
    .select({
      id: schema.course.id,
      campusId: schema.course.campusId,
      academicYear: schema.course.academicYear,
      maxStudents: schema.course.maxStudents,
    })
    .from(schema.course)
    .where(and(eq(schema.course.organizationId, organizationId), eq(schema.course.id, courseId)))
    .for("update");
  if (!course) throw courseNotFound();
  return course;
}

export type EnrollInCourseInput = {
  organizationId: string;
  /** Already locked by `lockEnrollmentCourse` in the same transaction. */
  course: EnrollmentCourse;
  studentIds: readonly string[];
  /** `ScopePolicy.studentWhere()` of the caller; a student outside it is `NOT_FOUND`. */
  scope?: SQL;
  allowOverCapacity?: boolean;
  /**
   * Admission (STU-R3): a course without offerings enrolls nothing instead of refusing, so the
   * student is still admitted with the course stored.
   */
  admission?: boolean;
};

export type EnrollInCourseResult = {
  students: number;
  created: number;
  skipped: number;
  overCapacity: boolean;
};

/**
 * Enrolls `studentIds` in every offering of `course` for the course's year and moves them into
 * the course and its campus. Refusals throw `BAD_REQUEST` with the planner message.
 */
export async function enrollInCourse(
  tx: Tx,
  input: EnrollInCourseInput,
): Promise<EnrollInCourseResult> {
  const { organizationId: orgId, course } = input;
  const studentIds = [...new Set(input.studentIds)];
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
        input.scope,
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
        and(eq(schema.offering.organizationId, orgId), eq(schema.offering.courseId, course.id)),
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
  const currentStudents = members?.value ?? 0;
  // Selection order, not lock order, drives the plan.
  const byId = new Map(students.map((student) => [student.id, student]));
  const selected = studentIds.map((id) => byId.get(id)!);
  const plan = planBulkEnrollment({
    course,
    offeringIds: offerings.map((offering) => offering.id),
    students: selected,
    existing,
    currentStudents,
    allowOverCapacity: input.allowOverCapacity,
  });
  if (!plan.ok) {
    if (plan.reason === "no_offerings" && input.admission) {
      const newcomers = selected.filter((student) => student.courseId !== course.id).length;
      await moveIntoCourse(tx, orgId, course, studentIds);
      return {
        students: selected.length,
        created: 0,
        skipped: 0,
        overCapacity: currentStudents + newcomers > course.maxStudents,
      };
    }
    throw new ORPCError("BAD_REQUEST", { message: plan.message });
  }
  if (plan.rows.length > 0) {
    await tx
      .insert(schema.enrollment)
      .values(plan.rows.map((row) => ({ organizationId: orgId, ...row })));
  }
  await moveIntoCourse(tx, orgId, course, plan.students);
  return {
    students: plan.students.length,
    created: plan.created,
    skipped: plan.skipped,
    overCapacity: plan.overCapacity,
  };
}

const moveIntoCourse = (
  tx: Tx,
  orgId: string,
  course: EnrollmentCourse,
  studentIds: readonly string[],
) =>
  tx
    .update(schema.student)
    .set({ courseId: course.id, campusId: course.campusId })
    .where(and(eq(schema.student.organizationId, orgId), inArray(schema.student.id, studentIds)));

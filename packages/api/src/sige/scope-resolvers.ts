import type { Database } from "@base-template/db";
import {
  course,
  offering,
  student,
  studentGuardian,
  teacherAssignment,
} from "@base-template/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DEFAULT_SCOPE_RESOLVERS } from "./scope";
import type { RowLift, RowPredicate, ScopeResolvers } from "./scope";

/**
 * The concrete `ScopeResolvers` the SIGE procedures use (sige/00 §4.3): offering scope (P3) and
 * student scope plus the student/parent offering scope (P4, sige/05 STU-R1). Every predicate is a
 * correlated `exists` over tables other than the one it filters, so it can be ANDed into a query
 * that joins `student` and `offering` without the inner tables shadowing the outer row.
 */

/** Assignment states that keep an offering in the teacher's scope (D3; `inactivo` removes it). */
export const TEACHER_SCOPE_STATUSES = ["activo", "temporal"] as const;

/**
 * Teacher: offerings where they are the teacher AND the assignment is `activo` or `temporal`.
 * Predicate over `offering`; managers have no predicate (whole tenant).
 */
const teacherOfferingWhere: RowPredicate = (subject) =>
  sql`(${eq(
    offering.teacherPersonId,
    subject.personId,
  )} and exists (select 1 from ${teacherAssignment} where ${eq(
    teacherAssignment.organizationId,
    offering.organizationId,
  )} and ${eq(teacherAssignment.offeringId, offering.id)} and ${inArray(teacherAssignment.status, [
    ...TEACHER_SCOPE_STATUSES,
  ])}))`;

/** Teacher (D2): students whose current course has one of the teacher's scoped offerings. */
const teacherOfferingInStudentCourse: RowPredicate = (subject) =>
  sql`exists (select 1 from ${offering} where ${eq(
    offering.organizationId,
    student.organizationId,
  )} and ${eq(offering.courseId, student.courseId)} and ${teacherOfferingWhere(subject)})`;

/** Teacher (OD-21): students whose current course the teacher directs. */
const teacherDirectsStudentCourse: RowPredicate = (subject) =>
  sql`exists (select 1 from ${course} where ${eq(
    course.organizationId,
    student.organizationId,
  )} and ${eq(course.id, student.courseId)} and ${eq(course.directorPersonId, subject.personId)})`;

/** Predicates over `student`. Status is not filtered: lists add their own status filter. */
const studentWhere: ScopeResolvers["studentWhere"] = {
  teacher: (subject) =>
    sql`(${teacherOfferingInStudentCourse(subject)} or ${teacherDirectsStudentCourse(subject)})`,
  student: (subject) => eq(student.personId, subject.personId),
  parent: (subject) =>
    sql`exists (select 1 from ${studentGuardian} where ${eq(
      studentGuardian.organizationId,
      student.organizationId,
    )} and ${eq(studentGuardian.studentId, student.id)} and ${eq(
      studentGuardian.guardianPersonId,
      subject.personId,
    )})`,
};

/** Student and parent offering scope: the offerings of the own / children's current course. */
const portalOfferingWhere: Pick<ScopeResolvers["offeringWhere"], "student" | "parent"> = {
  student: (subject) =>
    sql`exists (select 1 from ${student} where ${eq(
      student.organizationId,
      offering.organizationId,
    )} and ${eq(student.courseId, offering.courseId)} and ${eq(
      student.personId,
      subject.personId,
    )})`,
  parent: (subject) =>
    sql`exists (select 1 from ${studentGuardian} inner join ${student} on ${and(
      eq(student.organizationId, studentGuardian.organizationId),
      eq(student.id, studentGuardian.studentId),
    )} where ${eq(studentGuardian.organizationId, offering.organizationId)} and ${eq(
      student.courseId,
      offering.courseId,
    )} and ${eq(studentGuardian.guardianPersonId, subject.personId)})`,
};

/**
 * The two lifts of D4. A P5 reader selects from `grade_record`, `attendance_record` or
 * `observation` and needs "rows whose offering / student is in my scope", so the scoped predicate
 * is wrapped in a correlated `exists` over the scoped table, matched on the row's own foreign key.
 * The tenant inside the `exists` comes from the session (R3.3), not from the row, and the
 * subquery's `offering` / `student` shadows any join of the same table in the outer query, which
 * is what keeps the predicate usable in a query that already joins it for its labels.
 *
 * ATT-R5 depends on there being exactly one of these: `attendance.studentSummary`, `history` and
 * `calendar` all pass their own `offering_id`, so a teacher's KPIs and table cover the same rows.
 */
const liftOfferingWhere: RowLift = (subject, scopeWhere, idColumn) =>
  sql`exists (select 1 from ${offering} where ${eq(
    offering.organizationId,
    subject.organizationId,
  )} and ${eq(offering.id, idColumn)} and ${scopeWhere})`;

/** GRD-08, OBS-01/05 and the student-scoped reads (D4); `student` scope over a row's `student_id`. */
const liftStudentWhere: RowLift = (subject, scopeWhere, idColumn) =>
  sql`exists (select 1 from ${student} where ${eq(
    student.organizationId,
    subject.organizationId,
  )} and ${eq(student.id, idColumn)} and ${scopeWhere})`;

export function createSigeScopeResolvers(db: Pick<Database, "select">): ScopeResolvers {
  return {
    ...DEFAULT_SCOPE_RESOLVERS,
    studentWhere: { ...DEFAULT_SCOPE_RESOLVERS.studentWhere, ...studentWhere },
    offeringWhere: {
      ...DEFAULT_SCOPE_RESOLVERS.offeringWhere,
      ...portalOfferingWhere,
      teacher: teacherOfferingWhere,
    },
    studentRowWhere: liftStudentWhere,
    offeringRowWhere: liftOfferingWhere,
    async studentVisible(subject, studentId, scopeWhere) {
      const [row] = await db
        .select({ id: student.id })
        .from(student)
        .where(
          and(
            eq(student.organizationId, subject.organizationId),
            eq(student.id, studentId),
            scopeWhere,
          ),
        )
        .limit(1);
      return row !== undefined;
    },
    async offeringVisible(subject, offeringId, scopeWhere) {
      const [row] = await db
        .select({ id: offering.id })
        .from(offering)
        .where(
          and(
            eq(offering.organizationId, subject.organizationId),
            eq(offering.id, offeringId),
            scopeWhere,
          ),
        )
        .limit(1);
      return row !== undefined;
    },
  };
}

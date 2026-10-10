import type { AuditLogger } from "@base-template/auth/audit";
import { provisionUserInTransaction, ProvisionUserError } from "@base-template/auth/provision-user";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import {
  canChangeStudentStatus,
  checkCourseCampus,
  courseAfterCampusChange,
  studentMessages,
} from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { z } from "zod";

import { studentHasRecords } from "./academic-dependents";
import { currentAcademicYear } from "./academic-year";
import { changedFields, recordAudit } from "./audit";
import type { AuditContext } from "./audit";
import { courseNotFound, enrollInCourse, lockEnrollmentCourse } from "./enrollment-service";
import type { EnrollmentCourse } from "./enrollment-service";
import { HAS_DEPENDENTS, rethrowDbError, STUDENT_HAS_RECORDS_MESSAGE } from "./pg-errors";
import type {
  studentAcademicInput,
  studentCompleteInput,
  studentCreateInput,
  studentUpdateInput,
} from "./schemas/student";
import { loadStudentDetail } from "./student-queries";
import type { StudentDetail } from "./student-queries";
import { deleteLoginRows, mapProvisionError, provisionAuth } from "./user-service";

/**
 * Student service (sige/05 §3.1, STU-R2..R5, R7, R10): the writes behind `student.create`,
 * `complete`, `update` and `delete`, one transaction each.
 *
 * - Path A (`createStudent`, D1): the login is provisioned INSIDE the transaction
 *   (`provisionUserInTransaction`), so login, profile and enrollments commit together and any
 *   failure leaves no orphan login or person (no compensation needed).
 * - STU-R3: with a course, the shared SCH-R5 routine enrolls the student in every offering of the
 *   course for its year with `allowOverCapacity` (a warning, never a block). The course is locked
 *   `FOR UPDATE` before the capacity count, the same order as `enrollment.createBulk` (course,
 *   then student). `enrolled` is `null` only without a course (STU-R10).
 * - STU-R4: `update` never touches enrollments; a campus change clears the course unless the
 *   course belongs to the new campus.
 * - Blank optional fields on `update` clear the column (`null`), following the P2 `user.update`
 *   precedent: the edit form always sends the whole record, so an omitted field means "empty".
 * - Audit events are the last statements of each transaction (P2 convention): a failed write
 *   rolls the change back.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type StudentServiceContext = AuditContext & {
  db: Database;
  auditLogger: AuditLogger;
  org: { id: string };
  session: { user: { id: string }; session: { impersonatedBy?: string | null } };
  scope: { studentWhere(): SQL | undefined };
};

type AcademicInput = z.output<typeof studentAcademicInput>;
export type StudentCreateInput = z.output<typeof studentCreateInput>;
export type StudentCompleteInput = z.output<typeof studentCompleteInput>;
export type StudentUpdateInput = z.output<typeof studentUpdateInput>;

export type Enrolled = { created: number; overCapacity: boolean } | null;

export const STUDENT_NOT_FOUND_MESSAGE = "El estudiante no existe.";
export const USER_NOT_FOUND_MESSAGE = "El usuario no existe.";
const CAMPUS_NOT_FOUND_MESSAGE = "La sede no existe.";
// Not in spec §4.1 (writer-authored, P4 T5).
export const CAMPUS_INACTIVE_MESSAGE = "La sede seleccionada está inactiva.";
export const NOT_A_STUDENT_MESSAGE = "El usuario seleccionado no es un estudiante.";
export const PROFILE_EXISTS_MESSAGE = "El usuario ya tiene un perfil académico.";

const studentNotFound = () => new ORPCError("NOT_FOUND", { message: STUDENT_NOT_FOUND_MESSAGE });
const badRequest = (message: string) => new ORPCError("BAD_REQUEST", { message });

/** The academic columns of `student` from the form; blanks are `null` (see module comment). */
const academicValues = (input: AcademicInput) => ({
  neighborhood: input.neighborhood ?? null,
  stratum: input.stratum ?? null,
  bloodType: input.bloodType ?? null,
  eps: input.eps ?? null,
  guardianName: input.guardianName ?? null,
  guardianPhone: input.guardianPhone ?? null,
  guardianEmail: input.guardianEmail ?? null,
});

/** `NOT_FOUND` outside the tenant; an inactive campus is refused unless it is the current one. */
async function assertCampus(tx: Tx, organizationId: string, campusId: string) {
  const [campus] = await tx
    .select({ id: schema.campus.id, active: schema.campus.active })
    .from(schema.campus)
    .where(and(eq(schema.campus.organizationId, organizationId), eq(schema.campus.id, campusId)));
  if (!campus) throw new ORPCError("NOT_FOUND", { message: CAMPUS_NOT_FOUND_MESSAGE });
  if (!campus.active) throw badRequest(CAMPUS_INACTIVE_MESSAGE);
}

/** Reads (no lock) the course and checks it belongs to `campusId` (§4.1). */
async function assertCourse(tx: Tx, organizationId: string, courseId: string, campusId: string) {
  const [course] = await tx
    .select({ id: schema.course.id, campusId: schema.course.campusId })
    .from(schema.course)
    .where(and(eq(schema.course.organizationId, organizationId), eq(schema.course.id, courseId)));
  if (!course) throw courseNotFound();
  const mismatch = checkCourseCampus(course, campusId);
  if (mismatch) throw badRequest(mismatch);
}

/**
 * Inserts the profile and, with a course, enrolls it (STU-R3). The course row is locked first;
 * the new student row is then locked by the shared routine (course -> student order).
 */
async function admit(
  tx: Tx,
  organizationId: string,
  personId: string,
  input: AcademicInput,
): Promise<{ studentId: string; enrolled: Enrolled }> {
  let course: EnrollmentCourse | null = null;
  if (input.courseId) {
    course = await lockEnrollmentCourse(tx, organizationId, input.courseId);
    const mismatch = checkCourseCampus(course, input.campusId);
    if (mismatch) throw badRequest(mismatch);
  }
  const [row] = await tx
    .insert(schema.student)
    .values({
      organizationId,
      personId,
      campusId: input.campusId,
      courseId: course?.id ?? null,
      ...academicValues(input),
      enrolledYear: await currentAcademicYear(tx, organizationId),
      status: "activo",
    })
    .returning({ id: schema.student.id });
  const studentId = row!.id;
  if (!course) return { studentId, enrolled: null };
  const result = await enrollInCourse(tx, {
    organizationId,
    course,
    studentIds: [studentId],
    allowOverCapacity: true,
    admission: true,
  });
  return { studentId, enrolled: { created: result.created, overCapacity: result.overCapacity } };
}

/** Field names set on admission, for `student.created` `changed[]` (§3.2). */
const admittedFields = (input: AcademicInput) =>
  Object.keys(
    changedFields(
      {},
      { campusId: input.campusId, courseId: input.courseId, ...academicValues(input) },
    ),
  );

async function loadDetail(context: StudentServiceContext, studentId: string) {
  const detail = await loadStudentDetail(context.db, context.org.id, studentId);
  if (!detail) throw studentNotFound();
  return detail;
}

export type AdmissionActor = { userId: string; impersonatorUserId: string | null };

/**
 * Path A core inside the caller's transaction: validates campus/course, provisions the login and
 * admits the profile (STU-R3). Shared by `student.create` and the import (STU-R2 path C); the
 * caller decides which audit events to write. Throws `ProvisionUserError` or `ORPCError`.
 */
async function admitNewStudent(
  tx: Tx,
  organizationId: string,
  input: StudentCreateInput,
  actor: AdmissionActor,
) {
  // Validate before provisioning, so a bad campus/course never hashes a password.
  await assertCampus(tx, organizationId, input.campusId);
  if (input.courseId) await assertCourse(tx, organizationId, input.courseId, input.campusId);
  const provisioned = await provisionUserInTransaction({ auth: provisionAuth }, tx, {
    organizationId,
    role: "student",
    firstName: input.firstName,
    lastName: input.lastName,
    documentType: input.documentType,
    documentNumber: input.documentNumber,
    phone: input.phone,
    birthDate: input.birthDate,
    gender: input.gender,
    address: input.address,
    actor: { userId: actor.userId, impersonatorUserId: actor.impersonatorUserId ?? undefined },
  });
  const admitted = await admit(tx, organizationId, provisioned.personId, input);
  return { ...admitted, provisioned };
}

/**
 * STU-05 import row (path C): the same one-transaction admission as `createStudent`, without
 * per-student audit events (the job writes one `student.imported`, §3.2).
 */
export async function importStudent(
  db: Database,
  organizationId: string,
  input: StudentCreateInput,
  actor: AdmissionActor,
): Promise<{ studentId: string; enrolled: Enrolled }> {
  try {
    return await db.transaction(async (tx) => {
      const { studentId, enrolled } = await admitNewStudent(tx, organizationId, input, actor);
      return { studentId, enrolled };
    });
  } catch (error) {
    if (error instanceof ProvisionUserError) throw mapProvisionError(error);
    return rethrowDbError(error, "write");
  }
}

/** STU-03 "new" (path A, STU-R2): login + profile + enrollments in one transaction. */
export async function createStudent(
  context: StudentServiceContext,
  input: StudentCreateInput,
): Promise<{ student: StudentDetail; username: string; enrolled: Enrolled }> {
  const orgId = context.org.id;
  let result: { studentId: string; username: string; enrolled: Enrolled };
  try {
    result = await context.db.transaction(async (tx) => {
      const { provisioned, ...admitted } = await admitNewStudent(tx, orgId, input, {
        userId: context.session.user.id,
        impersonatorUserId: context.session.session.impersonatedBy ?? null,
      });
      // Audit last (inside the transaction): a failed write rolls everything back.
      await context.auditLogger.record(provisioned.auditEvent);
      await recordAudit(context, {
        action: "student.created",
        targetType: "student",
        targetId: admitted.studentId,
        metadata: {
          mode: "create",
          personId: provisioned.personId,
          changed: admittedFields(input),
          enrolled: admitted.enrolled,
        },
      });
      return { ...admitted, username: provisioned.username };
    });
  } catch (error) {
    if (error instanceof ProvisionUserError) throw mapProvisionError(error);
    return rethrowDbError(error, "write");
  }
  return {
    student: await loadDetail(context, result.studentId),
    username: result.username,
    enrolled: result.enrolled,
  };
}

const hasStudentRole = (role: string) =>
  role
    .split(",")
    .map((token) => token.trim())
    .includes("student");

/** STU-03 "complete" (path B): only the profile (and enrollments); personal data untouched. */
export async function completeStudent(
  context: StudentServiceContext,
  input: StudentCompleteInput,
): Promise<{ student: StudentDetail; enrolled: Enrolled }> {
  const orgId = context.org.id;
  let result: { studentId: string; enrolled: Enrolled };
  try {
    result = await context.db.transaction(async (tx) => {
      // Lock the person so two concurrent completions of one login serialise.
      const [target] = await tx
        .select({ personId: schema.person.id, role: schema.member.role })
        .from(schema.person)
        .innerJoin(
          schema.member,
          and(
            eq(schema.member.organizationId, schema.person.organizationId),
            eq(schema.member.userId, schema.person.userId),
          ),
        )
        .where(and(eq(schema.person.organizationId, orgId), eq(schema.person.id, input.personId)))
        .for("update", { of: schema.person });
      if (!target) throw new ORPCError("NOT_FOUND", { message: USER_NOT_FOUND_MESSAGE });
      if (!hasStudentRole(target.role)) throw badRequest(NOT_A_STUDENT_MESSAGE);
      const [existing] = await tx
        .select({ id: schema.student.id })
        .from(schema.student)
        .where(
          and(
            eq(schema.student.organizationId, orgId),
            eq(schema.student.personId, input.personId),
          ),
        );
      if (existing) {
        throw new ORPCError("CONFLICT", { status: 409, message: PROFILE_EXISTS_MESSAGE });
      }
      await assertCampus(tx, orgId, input.campusId);
      const admitted = await admit(tx, orgId, input.personId, input);
      await recordAudit(context, {
        action: "student.created",
        targetType: "student",
        targetId: admitted.studentId,
        metadata: {
          mode: "complete",
          personId: input.personId,
          changed: admittedFields(input),
          enrolled: admitted.enrolled,
        },
      });
      return admitted;
    });
  } catch (error) {
    return rethrowDbError(error, "write");
  }
  return { student: await loadDetail(context, result.studentId), enrolled: result.enrolled };
}

/** Locks one student in the tenant and the caller's scope; `NOT_FOUND` otherwise. */
async function lockStudent(tx: Tx, context: StudentServiceContext, id: string) {
  const [row] = await tx
    .select({ student: schema.student, person: schema.person })
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
        eq(schema.student.organizationId, context.org.id),
        eq(schema.student.id, id),
        context.scope.studentWhere(),
      ),
    )
    .for("update", { of: schema.student });
  if (!row) throw studentNotFound();
  return row;
}

const PERSONAL_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "birthDate",
  "gender",
  "address",
] as const;
const ACADEMIC_FIELDS = [
  "campusId",
  "courseId",
  "neighborhood",
  "stratum",
  "bloodType",
  "eps",
  "guardianName",
  "guardianPhone",
  "guardianEmail",
] as const;

/** STU-03 edit (STU-R4, STU-R5): personal + academic + status; enrollments never change. */
export async function updateStudent(
  context: StudentServiceContext,
  input: StudentUpdateInput,
): Promise<StudentDetail> {
  const orgId = context.org.id;
  try {
    await context.db.transaction(async (tx) => {
      // Lock order as everywhere: the course first, then the student.
      const course = input.courseId ? await lockEnrollmentCourse(tx, orgId, input.courseId) : null;
      const current = await lockStudent(tx, context, input.id);
      const campusChanged = input.campusId !== current.student.campusId;
      if (campusChanged) await assertCampus(tx, orgId, input.campusId);
      let courseId: string | null;
      if (campusChanged) {
        courseId = courseAfterCampusChange(course, input.campusId);
      } else {
        const mismatch = checkCourseCampus(course, input.campusId);
        if (mismatch) throw badRequest(mismatch);
        courseId = course?.id ?? null;
      }
      const from = current.student.status;
      if (!canChangeStudentStatus(from, input.status)) {
        throw badRequest(studentMessages.statusTransition(from, input.status));
      }

      const personal = {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        birthDate: input.birthDate ?? null,
        gender: input.gender ?? null,
        address: input.address ?? null,
      };
      const academic = { campusId: input.campusId, courseId, ...academicValues(input) };
      const changes = changedFields(
        {
          ...Object.fromEntries(PERSONAL_FIELDS.map((f) => [f, current.person[f]])),
          ...Object.fromEntries(ACADEMIC_FIELDS.map((f) => [f, current.student[f]])),
        },
        { ...personal, ...academic },
      );

      await tx.update(schema.person).set(personal).where(eq(schema.person.id, current.person.id));
      await tx
        .update(schema.user)
        .set({ name: `${input.firstName} ${input.lastName}` })
        .where(eq(schema.user.id, current.person.userId));
      await tx
        .update(schema.student)
        .set({ ...academic, status: input.status })
        .where(and(eq(schema.student.organizationId, orgId), eq(schema.student.id, input.id)));

      const changed = Object.keys(changes);
      if (changed.length > 0) {
        await recordAudit(context, {
          action: "student.updated",
          targetType: "student",
          targetId: input.id,
          metadata: { mode: "update", changed },
        });
      }
      if (from !== input.status) {
        await recordAudit(context, {
          action: "student.status_changed",
          targetType: "student",
          targetId: input.id,
          metadata: { from, to: input.status },
        });
      }
    });
  } catch (error) {
    return rethrowDbError(error, "write");
  }
  return loadDetail(context, input.id);
}

/**
 * STU-R7: only an empty profile is deleted (today the only referencing table is `enrollment`;
 * later modules add theirs here and the restrict FKs stay the race-safe backstop). Success
 * removes the guardian links, the `student` row and the login; guardians' accounts are untouched.
 */
export async function deleteStudent(
  context: StudentServiceContext,
  id: string,
): Promise<{ deleted: true }> {
  try {
    await context.db.transaction(async (tx) => {
      const { student, person } = await lockStudent(tx, context, id);
      // STU-R7: enrollments, grades, finals, attendance and observations all read as the same
      // message. The pre-check is what produces it: `rethrowDbError` below runs with
      // `personRole: "student"`, so a restrict FK would be worded as USR-R7 instead (D9).
      if (await studentHasRecords(tx, context.org.id, id)) {
        throw new ORPCError(HAS_DEPENDENTS, { status: 409, message: STUDENT_HAS_RECORDS_MESSAGE });
      }
      const [login] = await tx
        .select({ username: schema.user.username })
        .from(schema.user)
        .where(eq(schema.user.id, person.userId));
      await tx
        .delete(schema.studentGuardian)
        .where(
          and(
            eq(schema.studentGuardian.organizationId, context.org.id),
            eq(schema.studentGuardian.studentId, id),
          ),
        );
      await tx
        .delete(schema.student)
        .where(and(eq(schema.student.organizationId, context.org.id), eq(schema.student.id, id)));
      await deleteLoginRows(tx, { personId: person.id, userId: person.userId });
      await recordAudit(context, {
        action: "student.deleted",
        targetType: "student",
        targetId: student.id,
        metadata: {
          personId: person.id,
          name: `${person.firstName} ${person.lastName}`,
          documentType: person.documentType,
          documentNumber: person.documentNumber,
          username: login?.username ?? null,
        },
      });
    });
  } catch (error) {
    return rethrowDbError(error, "delete", { personRole: "student" });
  }
  return { deleted: true };
}

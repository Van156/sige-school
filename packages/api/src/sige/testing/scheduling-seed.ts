import * as schema from "@base-template/db/schema";
import { todayIn } from "@base-template/sige-core";
import { eq } from "drizzle-orm";

import type { SigeTestFixture, TestTenant } from "./fixture";

/** Row seeders shared by the module 04 router suites (offering, assignment). */

export const seedCampus = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  values: Partial<typeof schema.campus.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.campus)
    .values({ organizationId: tenant.orgId, name: `Sede ${crypto.randomUUID()}`, ...values })
    .returning();
  return row!;
};

export const seedCourse = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  values: Partial<typeof schema.course.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.course)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: `Curso ${crypto.randomUUID().slice(0, 8)}`,
      academicYear: "2026",
      shift: "Mañana",
      ...values,
    })
    .returning();
  return row!;
};

export const seedSubject = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  values: Partial<typeof schema.subject.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.subject)
    .values({
      organizationId: tenant.orgId,
      name: `Materia ${crypto.randomUUID().slice(0, 8)}`,
      ...values,
    })
    .returning();
  return row!;
};

export const seedOffering = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  courseId: string,
  subjectId: string,
  teacher?: { personId: string; status?: "activo" | "inactivo" | "temporal" },
  hoursPerWeek = 4,
) => {
  const [row] = await fx.db
    .insert(schema.offering)
    .values({
      organizationId: tenant.orgId,
      courseId,
      subjectId,
      teacherPersonId: teacher?.personId ?? null,
      hoursPerWeek,
    })
    .returning();
  if (teacher) {
    const [course] = await fx.db.select().from(schema.course).where(eq(schema.course.id, courseId));
    await fx.db.insert(schema.teacherAssignment).values({
      organizationId: tenant.orgId,
      offeringId: row!.id,
      teacherPersonId: teacher.personId,
      academicYear: course!.academicYear,
      assignmentDate: todayIn(),
      status: teacher.status ?? "activo",
    });
  }
  return row!;
};

export const seedSlot = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  offering: { id: string; courseId: string; teacherPersonId?: string | null },
  when: { dayOfWeek?: number; startTime?: string; endTime?: string; academicYear?: string } = {},
) => {
  const [room] = await fx.db
    .insert(schema.classroom)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: "Salón",
      code: `S-${crypto.randomUUID().slice(0, 8)}`,
    })
    .returning();
  const [slot] = await fx.db
    .insert(schema.scheduleSlot)
    .values({
      organizationId: tenant.orgId,
      offeringId: offering.id,
      courseId: offering.courseId,
      teacherPersonId: offering.teacherPersonId ?? null,
      classroomId: room!.id,
      dayOfWeek: when.dayOfWeek ?? 0,
      startTime: when.startTime ?? "07:00",
      endTime: when.endTime ?? "08:00",
      academicYear: when.academicYear ?? "2026",
    })
    .returning();
  return slot!;
};

export const seedClassroom = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  values: Partial<typeof schema.classroom.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.classroom)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: `Salón ${crypto.randomUUID().slice(0, 6)}`,
      code: `R-${crypto.randomUUID().slice(0, 8)}`,
      ...values,
    })
    .returning();
  return row!;
};

export const seedTimeBlock = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  values: Partial<typeof schema.timeBlock.$inferInsert> & { startTime: string; endTime: string },
) => {
  const [row] = await fx.db
    .insert(schema.timeBlock)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: `Bloque ${values.startTime}`,
      orderNum: 1,
      shift: "Mañana",
      academicYear: "2026",
      ...values,
    })
    .returning();
  return row!;
};

/** A login, person and `student` row; `courseId` must belong to `campusId` (composite FK). */
export const seedStudent = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  values: {
    firstName?: string;
    lastName?: string;
    documentNumber?: string;
    courseId?: string | null;
    status?: "activo" | "retirado" | "graduado";
  } = {},
) => {
  const tag = crypto.randomUUID().slice(0, 8);
  const userId = `u-stu-${tag}`;
  await fx.db.insert(schema.user).values({ id: userId, name: "E", email: `${userId}@x.test` });
  const [person] = await fx.db
    .insert(schema.person)
    .values({
      organizationId: tenant.orgId,
      userId,
      firstName: values.firstName ?? "Estudiante",
      lastName: values.lastName ?? tag,
      documentType: "TI",
      documentNumber: values.documentNumber ?? `9${Date.now() % 1_000_000}${tag.slice(0, 4)}`,
    })
    .returning();
  const [row] = await fx.db
    .insert(schema.student)
    .values({
      organizationId: tenant.orgId,
      personId: person!.id,
      campusId,
      courseId: values.courseId ?? null,
      enrolledYear: "2026",
      status: values.status ?? "activo",
    })
    .returning();
  return { ...row!, person: person! };
};

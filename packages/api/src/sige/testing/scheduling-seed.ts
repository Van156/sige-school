import * as schema from "@base-template/db/schema";
import { todayIn } from "@base-template/sige-core";
import { eq } from "drizzle-orm";

import type { SigeTestFixture, TestTenant } from "./fixture";

/** Row seeders shared by the module 04 router suites (offering, assignment). */

export const seedCampus = async (fx: SigeTestFixture, tenant: TestTenant) => {
  const [row] = await fx.db
    .insert(schema.campus)
    .values({ organizationId: tenant.orgId, name: `Sede ${crypto.randomUUID()}` })
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
  when: { dayOfWeek?: number; startTime?: string; endTime?: string } = {},
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
      academicYear: "2026",
    })
    .returning();
  return slot!;
};

import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { and, eq } from "drizzle-orm";

import { DEMO_ACADEMIC_YEAR } from "./seed-structure";
import { regenerateSlots } from "./schedule-generation";
import type { GenerateScheduleResult } from "./schedule-generation";

/**
 * SIGE P3 demo dataset (sige/00 §9 R4.2, D7): 12 teachers, 14 classrooms, 15 time blocks, an
 * explicit list of 58 offerings with an `activo` assignment each, and a generated schedule.
 * Ported from the prototype mocks (`-mock/base.ts`, `-mock/people.ts`, `-mock/academics.ts`),
 * mapped onto the six demo courses. Idempotent: every row has a natural key and the schedule is
 * generated only while the institution has no slots (generation itself is deterministic).
 */

export type DemoTeacher = {
  key: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
};

/** Marcela Ortiz is the P0 demo teacher; the other eleven are new. Names come from the prototype. */
export const DEMO_TEACHERS: readonly DemoTeacher[] = [
  { key: "laura", firstName: "Laura", lastName: "Martínez", documentNumber: "1000000101" },
  { key: "andres", firstName: "Andrés", lastName: "Gómez", documentNumber: "1000000102" },
  { key: "carolina", firstName: "Carolina", lastName: "Ruiz", documentNumber: "1000000103" },
  { key: "jorge", firstName: "Jorge", lastName: "Herrera", documentNumber: "1000000104" },
  { key: "marcela", firstName: "Marcela", lastName: "Ortiz", documentNumber: "1000000004" },
  { key: "diego", firstName: "Diego", lastName: "Salazar", documentNumber: "1000000105" },
  { key: "sandra", firstName: "Sandra", lastName: "Pardo", documentNumber: "1000000106" },
  { key: "felipe", firstName: "Felipe", lastName: "Mora", documentNumber: "1000000107" },
  { key: "natalia", firstName: "Natalia", lastName: "Cárdenas", documentNumber: "1000000108" },
  { key: "oscar", firstName: "Óscar", lastName: "Beltrán", documentNumber: "1000000109" },
  { key: "juliana", firstName: "Juliana", lastName: "Ríos", documentNumber: "1000000110" },
  { key: "mauricio", firstName: "Mauricio", lastName: "Zapata", documentNumber: "1000000111" },
];

/** Teachers added by the P3 seed (everyone except the P0 teacher, who is already in DEMO_PEOPLE). */
export const NEW_DEMO_TEACHERS = DEMO_TEACHERS.filter((t) => t.documentNumber !== "1000000004");

type DemoClassroom = {
  campus: string;
  code: string;
  type: (typeof schema.classroomType.enumValues)[number];
  capacity: number;
  floor: number;
  building: string;
  resources?: Record<string, unknown>;
};

const aula = (campus: string, code: string, capacity: number, floor: number, building: string) =>
  ({ campus, code, type: "aula", capacity, floor, building }) satisfies DemoClassroom;

/** The prototype's auditorium holds 200; the schema caps capacity at 100. */
export const DEMO_CLASSROOMS: readonly DemoClassroom[] = [
  ...[1, 2, 3, 4, 5, 6].map((n) => aula("SP", `AULA-10${n}`, 40, n <= 3 ? 1 : 2, "Edificio A")),
  {
    campus: "SP",
    code: "LAB-CIENCIAS",
    type: "laboratorio",
    capacity: 30,
    floor: 1,
    building: "Edificio B",
    resources: { microscopios: 12, proyector: true },
  },
  {
    campus: "SP",
    code: "SALA-SISTEMAS",
    type: "laboratorio",
    capacity: 35,
    floor: 2,
    building: "Edificio B",
    resources: { computadoras: 30 },
  },
  {
    campus: "SP",
    code: "AUD-PRINCIPAL",
    type: "auditorio",
    capacity: 100,
    floor: 1,
    building: "Edificio C",
  },
  {
    campus: "SP",
    code: "CANCHA-1",
    type: "cancha",
    capacity: 60,
    floor: 1,
    building: "Exterior",
  },
  aula("SN", "AULA-N01", 30, 1, "Edificio Norte"),
  aula("SN", "AULA-N02", 35, 1, "Edificio Norte"),
  aula("SN", "SALA-N-ARTES", 30, 1, "Edificio Norte"),
  { campus: "SN", code: "CANCHA-N", type: "cancha", capacity: 50, floor: 1, building: "Exterior" },
];

type BlockSpec = readonly [name: string, start: string, end: string, isBreak?: boolean];

const MORNING_BLOCKS: readonly BlockSpec[] = [
  ["Bloque 1", "06:30", "07:30"],
  ["Bloque 2", "07:30", "08:30"],
  ["Recreo", "08:30", "09:00", true],
  ["Bloque 3", "09:00", "10:00"],
  ["Bloque 4", "10:00", "11:00"],
  ["Almuerzo", "11:00", "11:30", true],
  ["Bloque 5", "11:30", "12:30"],
  ["Bloque 6", "12:30", "13:30"],
];

const AFTERNOON_BLOCKS: readonly BlockSpec[] = [
  ["Bloque 1", "13:00", "14:00"],
  ["Bloque 2", "14:00", "15:00"],
  ["Recreo", "15:00", "15:20", true],
  ["Bloque 3", "15:20", "16:20"],
  ["Bloque 4", "16:20", "17:20"],
  ["Bloque 5", "17:20", "18:20"],
  ["Bloque 6", "18:20", "19:20"],
];

/** Blocks follow the courses: Sede Principal teaches mornings, Sede Norte afternoons. */
export const DEMO_TIME_BLOCKS: readonly {
  campus: string;
  shift: "Mañana" | "Tarde";
  specs: readonly BlockSpec[];
}[] = [
  { campus: "SP", shift: "Mañana", specs: MORNING_BLOCKS },
  { campus: "SN", shift: "Tarde", specs: AFTERNOON_BLOCKS },
];

/** Weekly hours per subject, from the prototype (28 per course). */
export const DEMO_SUBJECT_HOURS: Record<string, number> = {
  MAT: 5,
  ESP: 5,
  CNA: 4,
  SOC: 3,
  ING: 3,
  TEC: 2,
  ART: 2,
  EDF: 2,
  ETI: 1,
  REL: 1,
};

const ALL_COURSES = ["5-01", "6-01", "6-02", "7-01", "10-01", "3-01"] as const;
const SP6 = ["6-01", "6-02", "7-01"] as const;

/**
 * Who teaches what (the prototype's TEACHING_PLAN with its groups mapped onto the demo courses:
 * 11-01 → 10-01, 1-01 → 3-01). The prototype leaves English unassigned in 1-01 (here 3-01); the
 * second pair omitted to reach 58 is Educación Religiosa in 10-01.
 */
const TEACHING_PLAN: readonly { teacher: string; subject: string; courses: readonly string[] }[] = [
  { teacher: "laura", subject: "MAT", courses: SP6 },
  { teacher: "andres", subject: "ESP", courses: SP6 },
  { teacher: "carolina", subject: "CNA", courses: SP6 },
  { teacher: "jorge", subject: "MAT", courses: ["10-01"] },
  { teacher: "jorge", subject: "CNA", courses: ["10-01"] },
  { teacher: "marcela", subject: "MAT", courses: ["3-01"] },
  { teacher: "marcela", subject: "ESP", courses: ["3-01"] },
  { teacher: "marcela", subject: "CNA", courses: ["3-01"] },
  { teacher: "marcela", subject: "SOC", courses: ["3-01"] },
  { teacher: "marcela", subject: "TEC", courses: ["3-01"] },
  { teacher: "diego", subject: "MAT", courses: ["5-01"] },
  { teacher: "diego", subject: "ESP", courses: ["5-01"] },
  { teacher: "diego", subject: "CNA", courses: ["5-01"] },
  { teacher: "diego", subject: "SOC", courses: ["5-01"] },
  { teacher: "sandra", subject: "SOC", courses: SP6 },
  { teacher: "sandra", subject: "ETI", courses: [...SP6, "10-01"] },
  { teacher: "felipe", subject: "ING", courses: [...SP6, "10-01", "5-01"] },
  { teacher: "natalia", subject: "TEC", courses: [...SP6, "10-01", "5-01"] },
  { teacher: "natalia", subject: "ART", courses: [...SP6, "10-01"] },
  { teacher: "oscar", subject: "EDF", courses: ALL_COURSES },
  { teacher: "juliana", subject: "ESP", courses: ["10-01"] },
  { teacher: "juliana", subject: "SOC", courses: ["10-01"] },
  { teacher: "juliana", subject: "ART", courses: ["3-01", "5-01"] },
  { teacher: "mauricio", subject: "REL", courses: ALL_COURSES.filter((c) => c !== "10-01") },
  { teacher: "mauricio", subject: "ETI", courses: ["3-01", "5-01"] },
];

export type DemoOffering = { teacher: string; subject: string; course: string; hours: number };

export const DEMO_OFFERINGS: readonly DemoOffering[] = TEACHING_PLAN.flatMap((row) =>
  row.courses.map((course) => ({
    teacher: row.teacher,
    subject: row.subject,
    course,
    hours: DEMO_SUBJECT_HOURS[row.subject] ?? 1,
  })),
);

/** Start of the demo academic year; a fixed date keeps the seed reproducible. */
const DEMO_ASSIGNMENT_DATE = "2026-01-19";

export type SeedScheduleResult = {
  /** The generation outcome, or null when slots already existed and generation was skipped. */
  generation: GenerateScheduleResult | null;
};

/**
 * Seeds classrooms, time blocks, offerings and assignments, then generates the schedule through
 * the real generation service when the institution has none yet. `teacherIds` maps a teacher key
 * to its `person.id`.
 */
export async function seedSchedule(
  database: Database,
  organizationId: string,
  teacherIds: ReadonlyMap<string, string>,
): Promise<SeedScheduleResult> {
  const year = DEMO_ACADEMIC_YEAR;
  return database.transaction(async (tx) => {
    const campuses = await tx
      .select({ id: schema.campus.id, code: schema.campus.code })
      .from(schema.campus)
      .where(eq(schema.campus.organizationId, organizationId));
    const campusId = (code: string) => {
      const found = campuses.find((c) => c.code === code)?.id;
      if (!found) throw new Error(`Demo campus ${code} is missing.`);
      return found;
    };

    await tx
      .insert(schema.classroom)
      .values(
        DEMO_CLASSROOMS.map((room) => ({
          organizationId,
          campusId: campusId(room.campus),
          name: room.code,
          code: room.code,
          capacity: room.capacity,
          floor: room.floor,
          building: room.building,
          classroomType: room.type,
          resources: room.resources ?? null,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(schema.timeBlock)
      .values(
        DEMO_TIME_BLOCKS.flatMap(({ campus, shift, specs }) =>
          specs.map(([name, startTime, endTime, isBreak], index) => ({
            organizationId,
            campusId: campusId(campus),
            name,
            startTime,
            endTime,
            isBreak: isBreak ?? false,
            orderNum: index + 1,
            shift,
            academicYear: year,
          })),
        ),
      )
      .onConflictDoNothing();

    const courses = await tx
      .select({ id: schema.course.id, name: schema.course.name })
      .from(schema.course)
      .where(
        and(eq(schema.course.organizationId, organizationId), eq(schema.course.academicYear, year)),
      );
    const subjects = await tx
      .select({ id: schema.subject.id, code: schema.subject.code })
      .from(schema.subject)
      .where(eq(schema.subject.organizationId, organizationId));
    const idOf = <T extends { id: string }>(
      rows: T[],
      pick: (row: T) => string | null,
      key: string,
    ) => {
      const found = rows.find((row) => pick(row) === key)?.id;
      if (!found) throw new Error(`Demo reference ${key} is missing.`);
      return found;
    };

    const wanted = DEMO_OFFERINGS.map((o) => {
      const teacherPersonId = teacherIds.get(o.teacher);
      if (!teacherPersonId) throw new Error(`Demo teacher ${o.teacher} is missing.`);
      return {
        organizationId,
        subjectId: idOf(subjects, (s) => s.code, o.subject),
        courseId: idOf(courses, (c) => c.name, o.course),
        teacherPersonId,
        hoursPerWeek: o.hours,
      };
    });
    await tx.insert(schema.offering).values(wanted).onConflictDoNothing();

    const offerings = await tx
      .select({
        id: schema.offering.id,
        teacherPersonId: schema.offering.teacherPersonId,
      })
      .from(schema.offering)
      .where(eq(schema.offering.organizationId, organizationId));
    await tx
      .insert(schema.teacherAssignment)
      .values(
        offerings.flatMap((o) =>
          o.teacherPersonId
            ? [
                {
                  organizationId,
                  offeringId: o.id,
                  teacherPersonId: o.teacherPersonId,
                  academicYear: year,
                  assignmentDate: DEMO_ASSIGNMENT_DATE,
                  status: "activo" as const,
                },
              ]
            : [],
        ),
      )
      .onConflictDoNothing();

    const [existing] = await tx
      .select({ id: schema.scheduleSlot.id })
      .from(schema.scheduleSlot)
      .where(eq(schema.scheduleSlot.organizationId, organizationId))
      .limit(1);
    if (existing) return { generation: null };
    return { generation: await regenerateSlots(tx, organizationId, {}) };
  });
}

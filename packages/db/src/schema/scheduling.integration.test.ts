import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createTestDatabase, requireTestDatabaseOrSkip, resolveTestDatabaseUrl } from "../testing";
import type { TestDatabaseHandle } from "../testing";
import { organization, user } from "./auth";
import { campus, course, subject } from "./institution";
import { person } from "./person";
import {
  ASSIGNMENT_OFFERING_FK,
  ASSIGNMENT_OFFERING_UNIQUE,
  CLASSROOM_CAMPUS_FK,
  CLASSROOM_CODE_UNIQUE,
  OFFERING_COURSE_FK,
  OFFERING_SUBJECT_FK,
  OFFERING_TEACHER_FK,
  OFFERING_UNIQUE,
  SLOT_CLASSROOM_EXCLUDE,
  SLOT_CLASSROOM_FK,
  SLOT_COURSE_EXCLUDE,
  SLOT_OFFERING_COURSE_FK,
  SLOT_TEACHER_EXCLUDE,
  SLOT_OFFERING_TEACHER_FK,
  SLOT_TEACHER_SYNC_CHECK,
  TIME_BLOCK_CAMPUS_FK,
  TIME_BLOCK_UNIQUE,
  classroom,
  classroomType,
  offering,
  scheduleSlot,
  teacherAssignment,
  teacherAssignmentStatus,
  timeBlock,
  timeBlockShift,
} from "./scheduling";

/** Constraint-level behavior of sige/04 §2 and decision D1 against a real Postgres. */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "scheduling schema");

type PgFailure = { code?: string; constraint?: string };

async function pgFailure(work: () => Promise<unknown>): Promise<PgFailure | null> {
  try {
    await work();
    return null;
  } catch (error) {
    const wrapped = error as PgFailure & { cause?: PgFailure };
    return wrapped.code ? wrapped : (wrapped.cause ?? wrapped);
  }
}

describe("scheduling enums", () => {
  test("match sige/04 §2", () => {
    expect(teacherAssignmentStatus.enumValues).toEqual(["activo", "inactivo", "temporal"]);
    expect(classroomType.enumValues).toEqual(["aula", "laboratorio", "auditorio", "cancha"]);
    expect(timeBlockShift.enumValues).toEqual(["Mañana", "Tarde", "Nocturna", "Única"]);
  });
});

describe.skipIf(!reachable)("scheduling constraints (sige/04 §2, D1)", () => {
  let handle: TestDatabaseHandle;
  const marker = crypto.randomUUID().slice(0, 8);
  const orgA = `org-a-${marker}`;
  const orgB = `org-b-${marker}`;

  type Ctx = {
    campusId: string;
    courseA: string;
    courseB: string;
    subjectA: string;
    subjectB: string;
    subjectC: string;
    subjectD: string;
    teacherA: string;
    teacherB: string;
    roomA: string;
    roomB: string;
    offeringA: string; // courseA / subjectA / teacherA
    offeringB: string; // courseB / subjectB / teacherA (same teacher, other course)
    offeringC: string; // courseB / subjectA / no teacher
    offeringD: string; // courseA / subjectC / teacherB
    offeringE: string; // courseA / subjectD / no teacher
  };
  let ctx: Ctx;
  let other: {
    campusId: string;
    courseId: string;
    subjectId: string;
    personId: string;
    roomId: string;
  };

  const db = () => handle.db;

  const cleanup = async () => {
    for (const id of [orgA, orgB]) {
      await handle.db.execute(sql`delete from "organization" where id = ${id}`);
    }
    await handle.db.execute(sql`delete from "user" where id like ${`u-${marker}%`}`);
  };

  async function seedOrg(organizationId: string, tag: string) {
    const [camp] = await db()
      .insert(campus)
      .values({ organizationId, name: `Sede ${tag}` })
      .returning();
    const courses = await db()
      .insert(course)
      .values(
        ["6-01", "6-02"].map((name) => ({
          organizationId,
          campusId: camp!.id,
          name,
          academicYear: "2026",
          shift: "Mañana" as const,
        })),
      )
      .returning();
    const subjects = await db()
      .insert(subject)
      .values([
        { organizationId, name: "Matemáticas" },
        { organizationId, name: "Inglés" },
        { organizationId, name: "Ciencias" },
        { organizationId, name: "Artes" },
      ])
      .returning();
    const people = [];
    for (const index of [0, 1]) {
      const userId = `u-${marker}-${tag}-${index}`;
      await db()
        .insert(user)
        .values({ id: userId, name: "T", email: `${userId}@x.test` });
      const [row] = await db()
        .insert(person)
        .values({
          organizationId,
          userId,
          firstName: "T",
          lastName: `T${index}`,
          documentNumber: `${tag}-${index}`,
        })
        .returning();
      people.push(row!);
    }
    const rooms = await db()
      .insert(classroom)
      .values([
        { organizationId, campusId: camp!.id, name: "Aula 1", code: "A-1" },
        { organizationId, campusId: camp!.id, name: "Aula 2", code: "A-2" },
      ])
      .returning();
    return { camp: camp!, courses, subjects, people, rooms };
  }

  beforeAll(async () => {
    handle = createTestDatabase(url);
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    await handle.close();
  });
  beforeEach(async () => {
    await cleanup();
    await db()
      .insert(organization)
      .values([
        { id: orgA, name: "Colegio A", slug: `a-${marker}` },
        { id: orgB, name: "Colegio B", slug: `b-${marker}` },
      ]);
    const a = await seedOrg(orgA, "a");
    const b = await seedOrg(orgB, "b");
    const [oA, oB, oC, oD, oE] = await db()
      .insert(offering)
      .values([
        {
          organizationId: orgA,
          courseId: a.courses[0]!.id,
          subjectId: a.subjects[0]!.id,
          teacherPersonId: a.people[0]!.id,
        },
        {
          organizationId: orgA,
          courseId: a.courses[1]!.id,
          subjectId: a.subjects[1]!.id,
          teacherPersonId: a.people[0]!.id,
        },
        { organizationId: orgA, courseId: a.courses[1]!.id, subjectId: a.subjects[0]!.id },
        {
          organizationId: orgA,
          courseId: a.courses[0]!.id,
          subjectId: a.subjects[2]!.id,
          teacherPersonId: a.people[1]!.id,
        },
        { organizationId: orgA, courseId: a.courses[0]!.id, subjectId: a.subjects[3]!.id },
      ])
      .returning();
    ctx = {
      campusId: a.camp.id,
      courseA: a.courses[0]!.id,
      courseB: a.courses[1]!.id,
      subjectA: a.subjects[0]!.id,
      subjectB: a.subjects[1]!.id,
      subjectC: a.subjects[2]!.id,
      subjectD: a.subjects[3]!.id,
      teacherA: a.people[0]!.id,
      teacherB: a.people[1]!.id,
      roomA: a.rooms[0]!.id,
      roomB: a.rooms[1]!.id,
      offeringA: oA!.id,
      offeringB: oB!.id,
      offeringC: oC!.id,
      offeringD: oD!.id,
      offeringE: oE!.id,
    };
    other = {
      campusId: b.camp.id,
      courseId: b.courses[0]!.id,
      subjectId: b.subjects[0]!.id,
      personId: b.people[0]!.id,
      roomId: b.rooms[0]!.id,
    };
  });

  /* ------------------------------ offering ------------------------------ */
  describe("offering", () => {
    const values = (extra: Partial<typeof offering.$inferInsert> = {}) => ({
      organizationId: orgA,
      courseId: ctx.courseA,
      subjectId: ctx.subjectB,
      ...extra,
    });

    test("defaults: 4 weekly hours, no teacher, timestamps", async () => {
      const [row] = await db().insert(offering).values(values()).returning();
      expect(row).toMatchObject({ hoursPerWeek: 4, teacherPersonId: null });
      expect(row?.createdAt).toBeInstanceOf(Date);
    });

    test("(subject, course) is unique per institution", async () => {
      const failure = await pgFailure(() =>
        db()
          .insert(offering)
          .values(values({ subjectId: ctx.subjectA })),
      );
      expect(failure).toMatchObject({ code: "23505", constraint: OFFERING_UNIQUE });
    });

    test("hours_per_week must be 1..20", async () => {
      for (const hoursPerWeek of [0, 21]) {
        const failure = await pgFailure(() =>
          db().insert(offering).values(values({ hoursPerWeek })),
        );
        expect(failure).toMatchObject({ code: "23514", constraint: "offering_hours_check" });
      }
      for (const hoursPerWeek of [1, 20]) {
        await db()
          .delete(offering)
          .where(sql`${offering.subjectId} = ${ctx.subjectB}`);
        await db().insert(offering).values(values({ hoursPerWeek }));
      }
    });

    test("tenant FKs reject another institution's subject, course and teacher", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(offering)
            .values(values({ subjectId: other.subjectId })),
        ),
      ).toMatchObject({ code: "23503", constraint: OFFERING_SUBJECT_FK });
      expect(
        await pgFailure(() =>
          db()
            .insert(offering)
            .values(values({ courseId: other.courseId })),
        ),
      ).toMatchObject({ code: "23503", constraint: OFFERING_COURSE_FK });
      expect(
        await pgFailure(() =>
          db()
            .insert(offering)
            .values(values({ teacherPersonId: other.personId })),
        ),
      ).toMatchObject({ code: "23503", constraint: OFFERING_TEACHER_FK });
    });

    test("a teacher, course or subject with offerings cannot be deleted (restrict)", async () => {
      expect(
        await pgFailure(() =>
          db()
            .delete(person)
            .where(sql`${person.id} = ${ctx.teacherA}`),
        ),
      ).toMatchObject({ code: "23001", constraint: OFFERING_TEACHER_FK });
      expect(
        await pgFailure(() =>
          db()
            .delete(course)
            .where(sql`${course.id} = ${ctx.courseA}`),
        ),
      ).toMatchObject({ code: "23001", constraint: OFFERING_COURSE_FK });
      expect(
        await pgFailure(() =>
          db()
            .delete(subject)
            .where(sql`${subject.id} = ${ctx.subjectA}`),
        ),
      ).toMatchObject({ code: "23001", constraint: OFFERING_SUBJECT_FK });
    });
  });

  /* ------------------------------ teacher_assignment ------------------------------ */
  describe("teacher_assignment", () => {
    const values = (extra: Partial<typeof teacherAssignment.$inferInsert> = {}) => ({
      organizationId: orgA,
      offeringId: ctx.offeringA,
      teacherPersonId: ctx.teacherA,
      academicYear: "2026",
      assignmentDate: "2026-02-01",
      ...extra,
    });

    test("defaults to activo; one row per offering", async () => {
      const [row] = await db().insert(teacherAssignment).values(values()).returning();
      expect(row).toMatchObject({ status: "activo", notes: null });
      expect(await pgFailure(() => db().insert(teacherAssignment).values(values()))).toMatchObject({
        code: "23505",
        constraint: ASSIGNMENT_OFFERING_UNIQUE,
      });
    });

    test("clearing the offering's teacher while an assignment exists raises 23502 (SCH-R3)", async () => {
      await db().insert(teacherAssignment).values(values());
      const clear = () =>
        db()
          .update(offering)
          .set({ teacherPersonId: null })
          .where(sql`${offering.id} = ${ctx.offeringA}`);
      expect(await pgFailure(clear)).toMatchObject({ code: "23502" });
      // The service path deletes the assignment first; then the teacher can be cleared.
      await db()
        .delete(teacherAssignment)
        .where(sql`${teacherAssignment.offeringId} = ${ctx.offeringA}`);
      await clear();
      const [row] = await db()
        .select()
        .from(offering)
        .where(sql`${offering.id} = ${ctx.offeringA}`);
      expect(row?.teacherPersonId).toBeNull();
    });

    test("notes are limited to 500 characters", async () => {
      await db()
        .insert(teacherAssignment)
        .values(values({ notes: "x".repeat(500) }));
      const failure = await pgFailure(() =>
        db()
          .insert(teacherAssignment)
          .values(values({ offeringId: ctx.offeringB, notes: "x".repeat(501) })),
      );
      expect(failure?.code).toBe("22001");
    });

    test("the assignment teacher must be the offering's teacher (single source of truth)", async () => {
      // Another institution's teacher and a same-institution teacher who is not the offering's.
      for (const teacherPersonId of [other.personId, ctx.teacherB]) {
        expect(
          await pgFailure(() => db().insert(teacherAssignment).values(values({ teacherPersonId }))),
        ).toMatchObject({ code: "23503", constraint: ASSIGNMENT_OFFERING_FK });
      }
      // An offering without a teacher cannot have an assignment either.
      expect(
        await pgFailure(() =>
          db()
            .insert(teacherAssignment)
            .values(values({ offeringId: ctx.offeringC })),
        ),
      ).toMatchObject({ code: "23503", constraint: ASSIGNMENT_OFFERING_FK });
    });

    test("reassigning the offering's teacher cascades to its assignment", async () => {
      await db().insert(teacherAssignment).values(values());
      await db()
        .update(offering)
        .set({ teacherPersonId: ctx.teacherB })
        .where(sql`${offering.id} = ${ctx.offeringA}`);
      const [row] = await db().select().from(teacherAssignment);
      expect(row?.teacherPersonId).toBe(ctx.teacherB);
    });

    test("deleting the offering cascades the assignment; the teacher is restricted", async () => {
      await db().insert(teacherAssignment).values(values());
      expect(
        await pgFailure(() =>
          db()
            .delete(person)
            .where(sql`${person.id} = ${ctx.teacherA}`),
        ),
      ).toMatchObject({ code: "23001" });
      await db()
        .delete(offering)
        .where(sql`${offering.id} = ${ctx.offeringA}`);
      const rows = await db().select().from(teacherAssignment);
      expect(rows).toHaveLength(0);
    });

    test("an offering of another institution is rejected by the tenant FK", async () => {
      const [foreign] = await db()
        .insert(offering)
        .values({
          organizationId: orgB,
          courseId: other.courseId,
          subjectId: other.subjectId,
          teacherPersonId: other.personId,
        })
        .returning();
      expect(
        await pgFailure(() =>
          db()
            .insert(teacherAssignment)
            .values(values({ offeringId: foreign!.id, teacherPersonId: other.personId })),
        ),
      ).toMatchObject({ code: "23503", constraint: ASSIGNMENT_OFFERING_FK });
    });

    test("the year must be four digits", async () => {
      const failure = await pgFailure(() =>
        db()
          .insert(teacherAssignment)
          .values(values({ academicYear: "26" })),
      );
      expect(failure?.code).toBe("23514");
    });
  });

  /* ------------------------------ classroom ------------------------------ */
  describe("classroom", () => {
    const values = (extra: Partial<typeof classroom.$inferInsert> = {}) => ({
      organizationId: orgA,
      campusId: ctx.campusId,
      name: "Laboratorio",
      code: "LAB-1",
      ...extra,
    });

    test("defaults: capacity 40, floor 1, aula, no resources", async () => {
      const [row] = await db().insert(classroom).values(values()).returning();
      expect(row).toMatchObject({ capacity: 40, floor: 1, classroomType: "aula", resources: null });
    });

    test("code is unique per campus, case-insensitively", async () => {
      await db().insert(classroom).values(values());
      expect(
        await pgFailure(() =>
          db()
            .insert(classroom)
            .values(values({ code: "lab-1" })),
        ),
      ).toMatchObject({ code: "23505", constraint: CLASSROOM_CODE_UNIQUE });
    });

    test("the same code is allowed on another campus and in another institution", async () => {
      const [camp2] = await db()
        .insert(campus)
        .values({ organizationId: orgA, name: "Sede 2" })
        .returning();
      await db().insert(classroom).values(values());
      await db()
        .insert(classroom)
        .values(values({ campusId: camp2!.id }));
      await db()
        .insert(classroom)
        .values(values({ organizationId: orgB, campusId: other.campusId }));
    });

    test("capacity 10..100 and floor >= 1", async () => {
      for (const capacity of [9, 101]) {
        expect(
          await pgFailure(() =>
            db()
              .insert(classroom)
              .values(values({ code: `C${capacity}`, capacity })),
          ),
        ).toMatchObject({ code: "23514", constraint: "classroom_capacity_check" });
      }
      expect(
        await pgFailure(() =>
          db()
            .insert(classroom)
            .values(values({ code: "F0", floor: 0 })),
        ),
      ).toMatchObject({ code: "23514", constraint: "classroom_floor_check" });
      await db()
        .insert(classroom)
        .values(values({ code: "OK1", capacity: 10 }));
      await db()
        .insert(classroom)
        .values(values({ code: "OK2", capacity: 100 }));
    });

    test("resources must be a JSON object or null", async () => {
      await db()
        .insert(classroom)
        .values(values({ code: "R1", resources: { proyector: true, computadoras: 30 } }));
      for (const [index, resources] of [[1], "x", 3].entries()) {
        expect(
          await pgFailure(() =>
            db()
              .insert(classroom)
              .values(values({ code: `BAD${index}`, resources: resources as never })),
          ),
        ).toMatchObject({ code: "23514", constraint: "classroom_resources_check" });
      }
    });

    test("the type is a closed enum", async () => {
      const failure = await pgFailure(() =>
        db()
          .insert(classroom)
          .values(values({ classroomType: "gimnasio" as never })),
      );
      expect(failure?.code).toBe("22P02");
    });

    test("the campus must belong to the same institution", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(classroom)
            .values(values({ campusId: other.campusId })),
        ),
      ).toMatchObject({ code: "23503", constraint: CLASSROOM_CAMPUS_FK });
    });
  });

  /* ------------------------------ time_block ------------------------------ */
  describe("time_block", () => {
    const values = (extra: Partial<typeof timeBlock.$inferInsert> = {}) => ({
      organizationId: orgA,
      campusId: ctx.campusId,
      name: "Bloque 1",
      startTime: "07:00",
      endTime: "08:00",
      orderNum: 1,
      shift: "Mañana" as const,
      academicYear: "2026",
      ...extra,
    });

    test("defaults to a class block; times round-trip as HH:MM:SS", async () => {
      const [row] = await db().insert(timeBlock).values(values()).returning();
      expect(row).toMatchObject({ isBreak: false, startTime: "07:00:00", endTime: "08:00:00" });
    });

    test("name is unique per campus, shift and year, case-insensitively", async () => {
      await db().insert(timeBlock).values(values());
      expect(
        await pgFailure(() =>
          db()
            .insert(timeBlock)
            .values(values({ name: "bloque 1" })),
        ),
      ).toMatchObject({ code: "23505", constraint: TIME_BLOCK_UNIQUE });
    });

    test("the same name is allowed in another shift or year", async () => {
      await db().insert(timeBlock).values(values());
      await db()
        .insert(timeBlock)
        .values(values({ shift: "Tarde" }));
      await db()
        .insert(timeBlock)
        .values(values({ academicYear: "2027" }));
    });

    test("start must be before end", async () => {
      for (const endTime of ["07:00", "06:00"]) {
        expect(
          await pgFailure(() =>
            db()
              .insert(timeBlock)
              .values(values({ name: endTime, endTime })),
          ),
        ).toMatchObject({ code: "23514", constraint: "time_block_times_check" });
      }
    });

    test("order >= 1 and Sabatina is not a block shift", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(timeBlock)
            .values(values({ orderNum: 0 })),
        ),
      ).toMatchObject({ code: "23514", constraint: "time_block_order_check" });
      expect(
        await pgFailure(() =>
          db()
            .insert(timeBlock)
            .values(values({ shift: "Sabatina" as never })),
        ),
      ).toMatchObject({ code: "22P02" });
    });

    test("the campus must belong to the same institution", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(timeBlock)
            .values(values({ campusId: other.campusId })),
        ),
      ).toMatchObject({ code: "23503", constraint: TIME_BLOCK_CAMPUS_FK });
    });
  });

  /* ------------------------------ schedule_slot ------------------------------ */
  describe("schedule_slot", () => {
    type Slot = typeof scheduleSlot.$inferInsert;
    /** Slot of `offeringA` (courseA, teacherA) in roomA, Monday 10:00-11:00, 2026. */
    const slot = (extra: Partial<Slot> = {}): Slot => ({
      organizationId: orgA,
      offeringId: ctx.offeringA,
      courseId: ctx.courseA,
      teacherPersonId: ctx.teacherA,
      classroomId: ctx.roomA,
      dayOfWeek: 0,
      startTime: "10:00",
      endTime: "11:00",
      academicYear: "2026",
      ...extra,
    });
    /** Slot of `offeringB` (courseB, teacherA) in roomB: shares only the teacher with `slot()`. */
    const teacherOnly = (extra: Partial<Slot> = {}): Slot =>
      slot({ offeringId: ctx.offeringB, courseId: ctx.courseB, classroomId: ctx.roomB, ...extra });
    /** Slot of `offeringC` (courseB, no teacher) in roomA: shares only the room with `slot()`. */
    const roomOnly = (extra: Partial<Slot> = {}): Slot =>
      slot({ offeringId: ctx.offeringC, courseId: ctx.courseB, teacherPersonId: null, ...extra });
    /** Slot of `offeringD` (courseA, teacherB) in roomB: shares only the course with `slot()`. */
    const courseOnly = (extra: Partial<Slot> = {}): Slot =>
      slot({
        offeringId: ctx.offeringD,
        classroomId: ctx.roomB,
        teacherPersonId: ctx.teacherB,
        ...extra,
      });

    test("defaults: active", async () => {
      const [row] = await db().insert(scheduleSlot).values(slot()).returning();
      expect(row).toMatchObject({ isActive: true, startTime: "10:00:00", endTime: "11:00:00" });
    });

    test("day 0..4, start < end, four-digit year", async () => {
      for (const dayOfWeek of [-1, 5]) {
        expect(
          await pgFailure(() => db().insert(scheduleSlot).values(slot({ dayOfWeek }))),
        ).toMatchObject({ code: "23514", constraint: "schedule_slot_day_check" });
      }
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(slot({ endTime: "10:00" })),
        ),
      ).toMatchObject({ code: "23514", constraint: "schedule_slot_times_check" });
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(slot({ academicYear: "26" })),
        ),
      ).toMatchObject({ code: "23514", constraint: "schedule_slot_year_check" });
    });

    test("tenant FKs reject another institution's classroom, course and teacher", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(slot({ classroomId: other.roomId })),
        ),
      ).toMatchObject({ code: "23503", constraint: SLOT_CLASSROOM_FK });
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(slot({ courseId: other.courseId })),
        ),
      ).toMatchObject({ code: "23503", constraint: SLOT_OFFERING_COURSE_FK });
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(slot({ teacherPersonId: other.personId })),
        ),
      ).toMatchObject({ code: "23503", constraint: SLOT_OFFERING_TEACHER_FK });
    });

    test("the slot's teacher must be its offering's teacher", async () => {
      // A same-institution teacher who is not the offering's.
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(slot({ teacherPersonId: ctx.teacherB })),
        ),
      ).toMatchObject({ code: "23503", constraint: SLOT_OFFERING_TEACHER_FK });
      // A teacher on a slot of an offering without one.
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(roomOnly({ teacherPersonId: ctx.teacherA })),
        ),
      ).toMatchObject({ code: "23503", constraint: SLOT_OFFERING_TEACHER_FK });
    });

    test("a null slot teacher is rejected while the offering has one (MATCH SIMPLE hole)", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(slot({ teacherPersonId: null })),
        ),
      ).toMatchObject({ code: "23514", constraint: SLOT_TEACHER_SYNC_CHECK });
      const [row] = await db().insert(scheduleSlot).values(slot()).returning();
      expect(
        await pgFailure(() =>
          db()
            .update(scheduleSlot)
            .set({ teacherPersonId: null })
            .where(sql`${scheduleSlot.id} = ${row!.id}`),
        ),
      ).toMatchObject({ code: "23514", constraint: SLOT_TEACHER_SYNC_CHECK });
    });

    test("reassigning the offering's teacher cascades to its slots", async () => {
      const [row] = await db().insert(scheduleSlot).values(slot()).returning();
      await db()
        .update(offering)
        .set({ teacherPersonId: ctx.teacherB })
        .where(sql`${offering.id} = ${ctx.offeringA}`);
      const [moved] = await db()
        .select()
        .from(scheduleSlot)
        .where(sql`${scheduleSlot.id} = ${row!.id}`);
      expect(moved?.teacherPersonId).toBe(ctx.teacherB);
      // Clearing the teacher clears the slots, and giving one back fills them again.
      await db()
        .update(offering)
        .set({ teacherPersonId: null })
        .where(sql`${offering.id} = ${ctx.offeringA}`);
      const [cleared] = await db()
        .select()
        .from(scheduleSlot)
        .where(sql`${scheduleSlot.id} = ${row!.id}`);
      expect(cleared?.teacherPersonId).toBeNull();
      await db()
        .update(offering)
        .set({ teacherPersonId: ctx.teacherA })
        .where(sql`${offering.id} = ${ctx.offeringA}`);
      const [filled] = await db()
        .select()
        .from(scheduleSlot)
        .where(sql`${scheduleSlot.id} = ${row!.id}`);
      expect(filled?.teacherPersonId).toBe(ctx.teacherA);
    });

    describe("concurrent null-teacher slot vs offering teacher assignment (R3-002)", () => {
      const nullTeacherSlot = () =>
        slot({
          offeringId: ctx.offeringE,
          courseId: ctx.courseA,
          teacherPersonId: null,
          classroomId: ctx.roomA,
          dayOfWeek: 2,
        });
      const giveTeacher = (tx: typeof handle.db) =>
        tx
          .update(offering)
          .set({ teacherPersonId: ctx.teacherA })
          .where(sql`${offering.id} = ${ctx.offeringE}`);
      const settleAfter = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      /** Slots whose teacher differs from their offering's: the invariant the trigger pair keeps empty. */
      async function inconsistentSlots() {
        const result = await db().execute(
          sql`select s.id from "schedule_slot" s join "offering" o on o.organization_id = s.organization_id and o.id = s.offering_id where s.teacher_person_id is distinct from o.teacher_person_id`,
        );
        return result.rows;
      }

      test("slot inserted first: the offering update waits, then fills the slot", async () => {
        let slotInserted!: () => void;
        const inserted = new Promise<void>((resolve) => (slotInserted = resolve));
        let commitSlot!: () => void;
        const gate = new Promise<void>((resolve) => (commitSlot = resolve));
        const slotTx = db().transaction(async (tx) => {
          await tx.insert(scheduleSlot).values(nullTeacherSlot());
          slotInserted();
          await gate;
        });
        await inserted;
        const offeringTx = db().transaction(async (tx) => {
          await giveTeacher(tx);
        });
        await settleAfter(200);
        commitSlot();
        await Promise.all([slotTx, offeringTx]);
        expect(await inconsistentSlots()).toEqual([]);
        const rows = await db()
          .select()
          .from(scheduleSlot)
          .where(sql`${scheduleSlot.offeringId} = ${ctx.offeringE}`);
        expect(rows.map((row) => row.teacherPersonId)).toEqual([ctx.teacherA]);
      });

      test("offering updated first: the null-teacher slot insert is rejected", async () => {
        let offeringUpdated!: () => void;
        const updated = new Promise<void>((resolve) => (offeringUpdated = resolve));
        let commitOffering!: () => void;
        const gate = new Promise<void>((resolve) => (commitOffering = resolve));
        const offeringTx = db().transaction(async (tx) => {
          await giveTeacher(tx);
          offeringUpdated();
          await gate;
        });
        await updated;
        const slotTx = pgFailure(() =>
          db().transaction(async (tx) => {
            await tx.insert(scheduleSlot).values(nullTeacherSlot());
          }),
        );
        await settleAfter(200);
        commitOffering();
        await offeringTx;
        expect(await slotTx).toMatchObject({ code: "23514", constraint: SLOT_TEACHER_SYNC_CHECK });
        expect(await inconsistentSlots()).toEqual([]);
      });
    });

    test("after a cascade the teacher exclusion still rejects a real overlap", async () => {
      // offeringD (teacherB) and offeringA (teacherA) at the same time in different rooms/courses.
      await db().insert(scheduleSlot).values(slot());
      await db()
        .insert(scheduleSlot)
        .values(
          slot({
            offeringId: ctx.offeringB,
            courseId: ctx.courseB,
            classroomId: ctx.roomB,
            startTime: "12:00",
            endTime: "13:00",
          }),
        );
      await db()
        .update(offering)
        .set({ teacherPersonId: ctx.teacherB })
        .where(sql`${offering.id} = ${ctx.offeringB}`);
      // teacherB now owns the 12:00 slot; a new teacherB slot at 12:30 overlaps it.
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(courseOnly({ startTime: "12:30", endTime: "13:30", classroomId: ctx.roomA })),
        ),
      ).toMatchObject({ code: "23P01", constraint: SLOT_TEACHER_EXCLUDE });
      // Reassigning an offering onto a teacher that is busy then is rejected as well.
      await db()
        .update(offering)
        .set({ teacherPersonId: ctx.teacherA })
        .where(sql`${offering.id} = ${ctx.offeringB}`);
      await db()
        .insert(scheduleSlot)
        .values(courseOnly({ classroomId: ctx.roomA, startTime: "12:30", endTime: "13:30" }));
      expect(
        await pgFailure(() =>
          db()
            .update(offering)
            .set({ teacherPersonId: ctx.teacherA })
            .where(sql`${offering.id} = ${ctx.offeringD}`),
        ),
      ).toMatchObject({ code: "23P01", constraint: SLOT_TEACHER_EXCLUDE });
    });

    test("the slot's course must be its offering's course", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(scheduleSlot)
            .values(slot({ courseId: ctx.courseB })),
        ),
      ).toMatchObject({ code: "23503", constraint: SLOT_OFFERING_COURSE_FK });
    });

    test("the course tenant FK is named and restricts deletion", async () => {
      await db().insert(scheduleSlot).values(slot());
      // The slot has no course FK of its own (it is implied through the offering), so the offering
      // FK is the only constraint that can fire.
      const failure = await pgFailure(() =>
        db()
          .delete(course)
          .where(sql`${course.id} = ${ctx.courseA}`),
      );
      expect(failure).toMatchObject({ code: "23001", constraint: OFFERING_COURSE_FK });
    });

    test("deleting the offering cascades its slots; a used classroom is restricted", async () => {
      await db().insert(scheduleSlot).values(slot());
      expect(
        await pgFailure(() =>
          db()
            .delete(classroom)
            .where(sql`${classroom.id} = ${ctx.roomA}`),
        ),
      ).toMatchObject({ code: "23001", constraint: SLOT_CLASSROOM_FK });
      await db()
        .delete(offering)
        .where(sql`${offering.id} = ${ctx.offeringA}`);
      expect(await db().select().from(scheduleSlot)).toHaveLength(0);
    });

    describe("exclusion constraints (D1)", () => {
      const overlapping: [string, string][] = [
        ["10:00", "11:00"], // identical
        ["10:30", "11:30"], // partial
        ["09:00", "10:01"], // one-minute overlap
        ["09:00", "12:00"], // contains
        ["10:15", "10:45"], // contained
      ];

      test("classroom: overlapping intervals are rejected (23P01)", async () => {
        await db().insert(scheduleSlot).values(slot());
        for (const [startTime, endTime] of overlapping) {
          expect(
            await pgFailure(() =>
              db().insert(scheduleSlot).values(roomOnly({ startTime, endTime })),
            ),
          ).toMatchObject({ code: "23P01", constraint: SLOT_CLASSROOM_EXCLUDE });
        }
      });

      test("classroom: adjacent intervals are accepted (half-open)", async () => {
        await db().insert(scheduleSlot).values(slot());
        await db()
          .insert(scheduleSlot)
          .values(roomOnly({ startTime: "11:00", endTime: "12:00" }));
        await db()
          .insert(scheduleSlot)
          .values(roomOnly({ startTime: "09:00", endTime: "10:00" }));
      });

      test("classroom: identical start in the same room is rejected (subsumes the unique key)", async () => {
        await db().insert(scheduleSlot).values(slot());
        expect(
          await pgFailure(() =>
            db()
              .insert(scheduleSlot)
              .values(roomOnly({ endTime: "10:30" })),
          ),
        ).toMatchObject({ code: "23P01", constraint: SLOT_CLASSROOM_EXCLUDE });
      });

      test("teacher: overlapping intervals are rejected (23P01)", async () => {
        await db().insert(scheduleSlot).values(slot());
        for (const [startTime, endTime] of overlapping) {
          expect(
            await pgFailure(() =>
              db().insert(scheduleSlot).values(teacherOnly({ startTime, endTime })),
            ),
          ).toMatchObject({ code: "23P01", constraint: SLOT_TEACHER_EXCLUDE });
        }
      });

      test("teacher: adjacent intervals are accepted", async () => {
        await db().insert(scheduleSlot).values(slot());
        await db()
          .insert(scheduleSlot)
          .values(teacherOnly({ startTime: "11:00", endTime: "12:00" }));
        await db()
          .insert(scheduleSlot)
          .values(teacherOnly({ startTime: "09:00", endTime: "10:00" }));
      });

      test("teacher: a null teacher never conflicts", async () => {
        // Same time and day, different course and room, both without a teacher.
        await db().insert(scheduleSlot).values(roomOnly());
        await db()
          .insert(scheduleSlot)
          .values(
            slot({ offeringId: ctx.offeringE, teacherPersonId: null, classroomId: ctx.roomB }),
          );
        const rows = await db().select().from(scheduleSlot);
        expect(rows.filter((row) => row.teacherPersonId === null)).toHaveLength(2);
      });

      test("course: overlapping intervals are rejected (23P01)", async () => {
        await db().insert(scheduleSlot).values(slot());
        for (const [startTime, endTime] of overlapping) {
          expect(
            await pgFailure(() =>
              db().insert(scheduleSlot).values(courseOnly({ startTime, endTime })),
            ),
          ).toMatchObject({ code: "23P01", constraint: SLOT_COURSE_EXCLUDE });
        }
      });

      test("course: adjacent intervals are accepted", async () => {
        await db().insert(scheduleSlot).values(slot());
        await db()
          .insert(scheduleSlot)
          .values(courseOnly({ startTime: "11:00", endTime: "12:00" }));
        await db()
          .insert(scheduleSlot)
          .values(courseOnly({ startTime: "09:00", endTime: "10:00" }));
      });

      test("inactive slots never block, and cannot be reactivated into a conflict", async () => {
        const [first] = await db()
          .insert(scheduleSlot)
          .values(slot({ isActive: false }))
          .returning();
        // Same room, teacher and course as the inactive slot: one probe per exclusion.
        for (const probe of [roomOnly(), teacherOnly(), courseOnly()]) {
          const [row] = await db().insert(scheduleSlot).values(probe).returning();
          await db()
            .delete(scheduleSlot)
            .where(sql`${scheduleSlot.id} = ${row!.id}`);
        }
        await db().insert(scheduleSlot).values(roomOnly());
        expect(
          await pgFailure(() =>
            db()
              .update(scheduleSlot)
              .set({ isActive: true })
              .where(sql`${scheduleSlot.id} = ${first!.id}`),
          ),
        ).toMatchObject({ code: "23P01", constraint: SLOT_CLASSROOM_EXCLUDE });
      });

      test("different days and different years never conflict", async () => {
        await db().insert(scheduleSlot).values(slot());
        await db()
          .insert(scheduleSlot)
          .values(slot({ dayOfWeek: 1 }));
        await db()
          .insert(scheduleSlot)
          .values(slot({ academicYear: "2027" }));
      });

      test("another institution never conflicts", async () => {
        await db().insert(scheduleSlot).values(slot());
        const [foreign] = await db()
          .insert(offering)
          .values({
            organizationId: orgB,
            courseId: other.courseId,
            subjectId: other.subjectId,
            teacherPersonId: other.personId,
          })
          .returning();
        await db().insert(scheduleSlot).values({
          organizationId: orgB,
          offeringId: foreign!.id,
          courseId: other.courseId,
          teacherPersonId: other.personId,
          classroomId: other.roomId,
          dayOfWeek: 0,
          startTime: "10:00",
          endTime: "11:00",
          academicYear: "2026",
        });
      });

      test("moving a slot into a conflict is rejected too", async () => {
        await db().insert(scheduleSlot).values(slot());
        const [moving] = await db()
          .insert(scheduleSlot)
          .values(roomOnly({ startTime: "12:00", endTime: "13:00" }))
          .returning();
        expect(
          await pgFailure(() =>
            db()
              .update(scheduleSlot)
              .set({ startTime: "10:30", endTime: "11:30" })
              .where(sql`${scheduleSlot.id} = ${moving!.id}`),
          ),
        ).toMatchObject({ code: "23P01", constraint: SLOT_CLASSROOM_EXCLUDE });
      });
    });
  });

  test("the btree_gist extension is installed and the exclusions exist", async () => {
    const result = await db().execute(
      sql`select conname from pg_constraint where contype = 'x' and conrelid = 'schedule_slot'::regclass order by conname`,
    );
    expect(result.rows.map((row) => row.conname)).toEqual([
      SLOT_CLASSROOM_EXCLUDE,
      SLOT_COURSE_EXCLUDE,
      SLOT_TEACHER_EXCLUDE,
    ]);
  });
});

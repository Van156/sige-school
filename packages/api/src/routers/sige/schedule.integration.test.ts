import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { timesOverlap } from "@base-template/sige-core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import { currentAcademicYear } from "../../sige/academic-year";
import {
  isolationCase,
  racingDb,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { SigeTestFixture, TestTenant } from "../../sige/testing";
import {
  seedCampus,
  seedClassroom,
  seedCourse,
  seedOffering,
  seedSlot,
  seedSubject,
  seedTimeBlock,
} from "../../sige/testing/scheduling-seed";
import { scheduleRouter } from "./schedule";
import { timeBlockRouter } from "./time-block";

/** `schedule.*` (sige/04 SCH-11/12, §3.5, SCH-R9/R10/R12): generate, weekly view, delete slot. */

const RETIME_IN_USE = "No se pueden cambiar los horarios de un bloque con clases programadas.";

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

/** SQLSTATE of a driver failure (drizzle wraps the pg error in `cause`). */
const pgCode = async (promise: Promise<unknown>) => {
  const error = (await promise.then(
    () => null,
    (e: unknown) => e,
  )) as { code?: string; cause?: { code?: string } } | null;
  return error?.cause?.code ?? error?.code ?? null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Slot = typeof schema.scheduleSlot.$inferSelect;

/** No teacher, classroom or course has two overlapping slots on the same day (SCH-R9). */
const expectNoDoubleBooking = (slots: readonly Slot[]) => {
  const keys: ("classroomId" | "teacherPersonId" | "courseId")[] = [
    "classroomId",
    "teacherPersonId",
    "courseId",
  ];
  for (const key of keys) {
    for (const [i, a] of slots.entries()) {
      for (const b of slots.slice(i + 1)) {
        const same = a[key] !== null && a[key] === b[key] && a.dayOfWeek === b.dayOfWeek;
        if (same) {
          expect(timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)).toBe(false);
        }
      }
    }
  }
};

await sigeSuite("schedule router", (fx) => {
  let year: string;

  type School = {
    tenant: TestTenant;
    owner: Context;
    audit: RecordingAuditLogger;
    teacherA: { personId: string; context: Context };
    teacherB: { personId: string; context: Context };
  };

  /** A tenant with a manager, two teachers (the coordinator also holds `teacher`) and a student. */
  const makeSchool = async (label: string): Promise<School> => {
    const tenant = await fx.provisionTenant(label, [
      "owner",
      "coordinator",
      "teacher",
      "student",
      "parent",
    ]);
    await fx.db
      .update(schema.member)
      .set({ role: "coordinator,teacher" })
      .where(eq(schema.member.userId, tenant.people.coordinator!.userId));
    const owner = await fx.contextFor(tenant.people.owner!, tenant);
    return {
      tenant,
      owner,
      audit: owner.auditLogger as RecordingAuditLogger,
      teacherA: {
        personId: tenant.people.teacher!.personId,
        context: await fx.contextFor(tenant.people.teacher!, tenant),
      },
      teacherB: {
        personId: tenant.people.coordinator!.personId,
        context: await fx.contextFor(tenant.people.coordinator!, tenant),
      },
    };
  };

  const BLOCKS = [
    { startTime: "07:00", endTime: "08:00", orderNum: 1, isBreak: false },
    { startTime: "08:00", endTime: "09:00", orderNum: 2, isBreak: false },
    { startTime: "09:00", endTime: "09:30", orderNum: 3, isBreak: true },
    { startTime: "09:30", endTime: "10:30", orderNum: 4, isBreak: false },
    { startTime: "10:30", endTime: "11:30", orderNum: 5, isBreak: false },
  ];

  /** A campus with the standard morning blocks and four rooms (three aulas, one laboratory). */
  const makeCampus = async (s: School, values: Partial<typeof schema.campus.$inferInsert> = {}) => {
    const campus = await seedCampus(fx, s.tenant, values);
    const blocks = [];
    for (const block of BLOCKS) {
      blocks.push(
        await seedTimeBlock(fx, s.tenant, campus.id, {
          ...block,
          name: `Bloque ${block.orderNum}`,
          academicYear: year,
        }),
      );
    }
    for (const code of ["A1", "A2", "A3"]) {
      await seedClassroom(fx, s.tenant, campus.id, { code, name: `Aula ${code}` });
    }
    await seedClassroom(fx, s.tenant, campus.id, {
      code: "L1",
      name: "Laboratorio 1",
      classroomType: "laboratorio",
    });
    return { campus, blocks };
  };

  const subjects = async (s: School) => ({
    mat: await seedSubject(fx, s.tenant, { name: "Matemáticas" }),
    nat: await seedSubject(fx, s.tenant, { name: "Ciencias Naturales" }),
    ing: await seedSubject(fx, s.tenant, { name: "Inglés" }),
  });

  /** Two courses of 7 weekly hours each, taught by teachers A and B (14 hours in total). */
  const makeTwoCourses = async (s: School, campusId: string) => {
    const sub = await subjects(s);
    const c1 = await seedCourse(fx, s.tenant, campusId, { name: "Sexto A", academicYear: year });
    const c2 = await seedCourse(fx, s.tenant, campusId, { name: "Sexto B", academicYear: year });
    const A = { personId: s.teacherA.personId };
    const B = { personId: s.teacherB.personId };
    const offerings = {
      c1Mat: await seedOffering(fx, s.tenant, c1.id, sub.mat.id, A, 3),
      c1Nat: await seedOffering(fx, s.tenant, c1.id, sub.nat.id, B, 2),
      c1Ing: await seedOffering(fx, s.tenant, c1.id, sub.ing.id, A, 2),
      c2Mat: await seedOffering(fx, s.tenant, c2.id, sub.mat.id, A, 3),
      c2Nat: await seedOffering(fx, s.tenant, c2.id, sub.nat.id, B, 2),
      c2Ing: await seedOffering(fx, s.tenant, c2.id, sub.ing.id, B, 2),
    };
    return { c1, c2, offerings };
  };

  const slotsOf = (s: School, courseIds?: string[]) =>
    fx.db
      .select()
      .from(schema.scheduleSlot)
      .where(
        and(
          eq(schema.scheduleSlot.organizationId, s.tenant.orgId),
          courseIds ? inArray(schema.scheduleSlot.courseId, courseIds) : undefined,
        ),
      );

  const lockBlockWrites = (orgId: string) =>
    sql`select pg_advisory_xact_lock(hashtextextended(${`${orgId}:time_block`}, 0))`;

  test("resolves the academic year", async () => {
    // The tenants provisioned below have no profile row: the calendar-year fallback applies.
    const probe = await fx.provisionTenant("Anio", ["owner"]);
    year = await currentAcademicYear(fx.db, probe.orgId);
    expect(year).toMatch(/^[0-9]{4}$/);
  });

  test("generate places every hour with 0 conflicts and persists denormalised slots", async () => {
    const s = await makeSchool("Generar");
    const { campus } = await makeCampus(s);
    const { c1, c2, offerings } = await makeTwoCourses(s, campus.id);
    s.audit.reset();
    const result = await call(scheduleRouter.generate, {}, { context: s.owner });
    expect(result).toEqual({ assigned: 14, conflicts: 0, courses: 2, skipped: [] });

    const slots = await slotsOf(s);
    expect(slots).toHaveLength(14);
    expectNoDoubleBooking(slots);
    for (const slot of slots) {
      expect(slot.academicYear).toBe(year);
      expect(slot.isActive).toBe(true);
      // D1: the denormalised columns mirror the offering.
      const offering = Object.values(offerings).find((o) => o.id === slot.offeringId)!;
      expect(slot.courseId).toBe(offering.courseId);
      expect(slot.teacherPersonId).toBe(offering.teacherPersonId);
    }
    for (const offering of Object.values(offerings)) {
      expect(slots.filter((slot) => slot.offeringId === offering.id)).toHaveLength(
        offering.hoursPerWeek,
      );
    }
    // Breaks are never used, and only block times are written.
    const times = new Set(
      slots.map((slot) => `${slot.startTime.slice(0, 5)}-${slot.endTime.slice(0, 5)}`),
    );
    expect(times.has("09:00-09:30")).toBe(false);
    expect(slots.filter((slot) => slot.courseId === c1.id)).toHaveLength(7);
    expect(slots.filter((slot) => slot.courseId === c2.id)).toHaveLength(7);

    expect(s.audit.events).toHaveLength(1);
    expect(s.audit.events[0]?.action).toBe("schedule.generated");
    expect(s.audit.events[0]?.metadata).toEqual({ assigned: 14, conflicts: 0, courses: 2 });
  });

  test("the persisted slots satisfy the DB exclusions: a forced overlap is 23P01", async () => {
    const s = await makeSchool("Exclusion");
    const { campus } = await makeCampus(s);
    const { c1 } = await makeTwoCourses(s, campus.id);
    await call(scheduleRouter.generate, { courseId: c1.id }, { context: s.owner });
    const [slot] = await slotsOf(s, [c1.id]);
    // The same class inserted again: room, teacher and course all overlap.
    const clash = fx.db.insert(schema.scheduleSlot).values({
      organizationId: s.tenant.orgId,
      offeringId: slot!.offeringId,
      courseId: slot!.courseId,
      teacherPersonId: slot!.teacherPersonId,
      classroomId: slot!.classroomId,
      dayOfWeek: slot!.dayOfWeek,
      startTime: slot!.startTime,
      endTime: slot!.endTime,
      academicYear: year,
    });
    expect(await pgCode(clash)).toBe("23P01");
  });

  test("regeneration is deterministic and replaces the target courses' slots only", async () => {
    const s = await makeSchool("Regenerar");
    const { campus } = await makeCampus(s);
    const { c1, c2 } = await makeTwoCourses(s, campus.id);
    await call(scheduleRouter.generate, {}, { context: s.owner });
    const shape = (rows: Slot[]) =>
      rows.map((r) => `${r.offeringId}|${r.dayOfWeek}|${r.startTime}|${r.classroomId}`).sort();
    const before1 = await slotsOf(s, [c1.id]);
    const before2 = await slotsOf(s, [c2.id]);

    const result = await call(scheduleRouter.generate, { courseId: c1.id }, { context: s.owner });
    expect(result).toMatchObject({ assigned: 7, conflicts: 0, courses: 1, skipped: [] });
    const after1 = await slotsOf(s, [c1.id]);
    const after2 = await slotsOf(s, [c2.id]);
    // Course 1 got new rows with the same placement; course 2 was not touched.
    expect(after1.map((r) => r.id).sort()).not.toEqual(before1.map((r) => r.id).sort());
    expect(shape(after1)).toEqual(shape(before1));
    expect(after2.map((r) => r.id).sort()).toEqual(before2.map((r) => r.id).sort());
    expectNoDoubleBooking([...after1, ...after2]);
  });

  test("generation respects the busy teachers and rooms of non-target courses (active slots only)", async () => {
    const s = await makeSchool("Ocupados");
    const { campus } = await makeCampus(s, {});
    // One block and one room only: every placement decision is visible.
    await fx.db
      .delete(schema.timeBlock)
      .where(and(eq(schema.timeBlock.campusId, campus.id), sql`${schema.timeBlock.orderNum} <> 1`));
    await fx.db
      .delete(schema.classroom)
      .where(and(eq(schema.classroom.campusId, campus.id), sql`${schema.classroom.code} <> 'A1'`));
    const [room] = await fx.db
      .select()
      .from(schema.classroom)
      .where(eq(schema.classroom.campusId, campus.id));
    const other = await seedCampus(fx, s.tenant);
    const sub = await subjects(s);
    const target = await seedCourse(fx, s.tenant, campus.id, {
      name: "Objetivo",
      academicYear: year,
    });
    const busyCourse = await seedCourse(fx, s.tenant, other.id, {
      name: "Ocupado",
      academicYear: year,
    });
    const roomCourse = await seedCourse(fx, s.tenant, other.id, {
      name: "Sala",
      academicYear: year,
    });
    await seedOffering(fx, s.tenant, target.id, sub.mat.id, { personId: s.teacherA.personId }, 1);
    const busyOffering = await seedOffering(
      fx,
      s.tenant,
      busyCourse.id,
      sub.mat.id,
      { personId: s.teacherA.personId },
      4,
    );
    const roomOffering = await seedOffering(fx, s.tenant, roomCourse.id, sub.mat.id, undefined, 1);
    // Teacher A is busy Monday..Thursday 07:00-08:00 (in another campus' room).
    for (const dayOfWeek of [0, 1, 2, 3]) {
      await seedSlot(fx, s.tenant, other.id, busyOffering, { dayOfWeek, academicYear: year });
    }
    // The only room is busy on Friday: with an ACTIVE slot there is no cell left.
    const roomSlot = await fx.db
      .insert(schema.scheduleSlot)
      .values({
        organizationId: s.tenant.orgId,
        offeringId: roomOffering.id,
        courseId: roomCourse.id,
        classroomId: room!.id,
        dayOfWeek: 4,
        startTime: "07:00",
        endTime: "08:00",
        academicYear: year,
      })
      .returning();
    const blocked = await call(
      scheduleRouter.generate,
      { courseId: target.id },
      { context: s.owner },
    );
    expect(blocked).toMatchObject({ assigned: 0, conflicts: 1, courses: 1 });
    expect(await slotsOf(s, [target.id])).toHaveLength(0);
    expect(await slotsOf(s, [busyCourse.id, roomCourse.id])).toHaveLength(5);

    // An INACTIVE slot of a non-target course never blocks (D5 / exclusions ignore it).
    await fx.db
      .update(schema.scheduleSlot)
      .set({ isActive: false })
      .where(eq(schema.scheduleSlot.id, roomSlot[0]!.id));
    const free = await call(scheduleRouter.generate, { courseId: target.id }, { context: s.owner });
    expect(free).toMatchObject({ assigned: 1, conflicts: 0 });
    const [placed] = await slotsOf(s, [target.id]);
    expect(placed).toMatchObject({ dayOfWeek: 4, classroomId: room!.id });
    expect(placed?.teacherPersonId).toBe(s.teacherA.personId);
  });

  test("skipped lists courses without blocks and Sabatina courses; their hours are conflicts", async () => {
    const s = await makeSchool("Omitidos");
    const { campus } = await makeCampus(s);
    const bare = await seedCampus(fx, s.tenant, { name: "Sede sin bloques" });
    await seedClassroom(fx, s.tenant, bare.id);
    const sub = await subjects(s);
    const regular = await seedCourse(fx, s.tenant, campus.id, {
      name: "Regular",
      academicYear: year,
    });
    const sabatina = await seedCourse(fx, s.tenant, campus.id, {
      name: "Sabatino",
      academicYear: year,
      shift: "Sabatina",
    });
    const noBlocks = await seedCourse(fx, s.tenant, bare.id, {
      name: "Sin bloques",
      academicYear: year,
    });
    await seedOffering(fx, s.tenant, regular.id, sub.mat.id, undefined, 2);
    await seedOffering(fx, s.tenant, sabatina.id, sub.mat.id, undefined, 2);
    await seedOffering(fx, s.tenant, noBlocks.id, sub.mat.id, undefined, 3);

    const result = await call(scheduleRouter.generate, {}, { context: s.owner });
    expect(result).toMatchObject({ assigned: 2, conflicts: 5, courses: 3 });
    expect([...result.skipped].sort((a, b) => a.courseName.localeCompare(b.courseName))).toEqual([
      {
        courseId: sabatina.id,
        courseName: "Sabatino",
        reason: `Sin bloques de tiempo para ${campus.name} · Sabatina.`,
      },
      {
        courseId: noBlocks.id,
        courseName: "Sin bloques",
        reason: "Sin bloques de tiempo para Sede sin bloques · Mañana.",
      },
    ]);
  });

  test("inactive campuses are excluded, courseId wins over campusId, unknown ids are NOT_FOUND", async () => {
    const s = await makeSchool("Filtros");
    const { campus } = await makeCampus(s);
    const { c1, c2 } = await makeTwoCourses(s, campus.id);
    const dead = await makeCampus(s, { active: false });
    const sub = await subjects(s);
    const deadCourse = await seedCourse(fx, s.tenant, dead.campus.id, { academicYear: year });
    const deadOffering = await seedOffering(fx, s.tenant, deadCourse.id, sub.mat.id, undefined, 2);
    const keep = await seedSlot(fx, s.tenant, dead.campus.id, deadOffering, { academicYear: year });

    const all = await call(scheduleRouter.generate, {}, { context: s.owner });
    expect(all).toMatchObject({ assigned: 14, conflicts: 0, courses: 2, skipped: [] });
    // The inactive campus' course keeps its slot and is not even listed.
    expect((await slotsOf(s, [deadCourse.id])).map((r) => r.id)).toEqual([keep.id]);

    // courseId wins over a campusId that points elsewhere.
    const one = await call(
      scheduleRouter.generate,
      { campusId: dead.campus.id, courseId: c2.id },
      { context: s.owner },
    );
    expect(one).toMatchObject({ assigned: 7, courses: 1 });
    // A campus filter targets all its courses.
    expect(
      await call(scheduleRouter.generate, { campusId: campus.id }, { context: s.owner }),
    ).toMatchObject({ assigned: 14, courses: 2 });
    expect(
      await call(scheduleRouter.generate, { campusId: dead.campus.id }, { context: s.owner }),
    ).toMatchObject({
      assigned: 0,
      courses: 0,
    });
    expect(
      (await errorOf(call(scheduleRouter.generate, { courseId: "nope" }, { context: s.owner })))
        ?.code,
    ).toBe("NOT_FOUND");
    const noCampus = await errorOf(
      call(scheduleRouter.generate, { campusId: "nope" }, { context: s.owner }),
    );
    expect(noCampus?.code).toBe("NOT_FOUND");
    expect(noCampus?.message).toBe("La sede no existe.");
    expect(c1.id).not.toBe(c2.id);
  });

  test("two concurrent generate calls serialise and leave exactly one schedule", async () => {
    const s = await makeSchool("Concurrente");
    const { campus } = await makeCampus(s);
    await makeTwoCourses(s, campus.id);
    const results = await Promise.all([
      call(scheduleRouter.generate, {}, { context: s.owner }),
      call(scheduleRouter.generate, {}, { context: s.owner }),
    ]);
    expect(results.map((r) => r.assigned)).toEqual([14, 14]);
    expect(results.map((r) => r.conflicts)).toEqual([0, 0]);
    const slots = await slotsOf(s);
    expect(slots).toHaveLength(14);
    expectNoDoubleBooking(slots);
  });

  test("generate waits on the institution time-block advisory lock", async () => {
    const s = await makeSchool("Candado");
    const { campus } = await makeCampus(s);
    await makeTwoCourses(s, campus.id);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const holder = fx.db.transaction(async (tx) => {
      await tx.execute(lockBlockWrites(s.tenant.orgId));
      locked();
      await held;
    });
    await lockTaken;
    let settled = false;
    const run = errorOf(call(scheduleRouter.generate, {}, { context: s.owner })).finally(() => {
      settled = true;
    });
    try {
      await sleep(300);
      expect(settled).toBe(false);
      expect(await slotsOf(s)).toHaveLength(0);
    } finally {
      release();
      await holder;
    }
    expect(await run).toBeNull();
    expect(await slotsOf(s)).toHaveLength(14);
  });

  test("a block retime racing generation is serialised after it (and refused: now in use)", async () => {
    const s = await makeSchool("Carrera");
    const { campus, blocks } = await makeCampus(s);
    await makeTwoCourses(s, campus.id);
    const first = blocks[0]!;
    let retime: Promise<ORPCError<string, any> | null> | undefined;
    let settledDuringGeneration = true;
    let fired = false;
    const racing = {
      ...s.owner,
      db: racingDb(fx.db, async () => {
        if (fired) return;
        fired = true;
        // The generation transaction already holds the lock when it first writes.
        retime = errorOf(
          call(
            timeBlockRouter.update,
            {
              id: first.id,
              campusId: campus.id,
              name: first.name,
              shift: "Mañana",
              startTime: "07:00",
              endTime: "07:45",
              orderNum: 1,
              isBreak: false,
            },
            { context: s.owner },
          ),
        );
        let early = false;
        void retime.then(() => (early = true));
        await sleep(300);
        settledDuringGeneration = early;
      }),
    } as Context;
    const result = await call(scheduleRouter.generate, {}, { context: racing });
    expect(result).toMatchObject({ assigned: 14, conflicts: 0 });
    expect(fired).toBe(true);
    expect(settledDuringGeneration).toBe(false);
    const error = await retime!;
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe(RETIME_IN_USE);
    const [block] = await fx.db
      .select()
      .from(schema.timeBlock)
      .where(eq(schema.timeBlock.id, first.id));
    expect(block?.endTime.slice(0, 5)).toBe("08:00");
  });

  /* ------------------------------- schedule.get ------------------------------- */

  const generated = async (label: string) => {
    const s = await makeSchool(label);
    const { campus } = await makeCampus(s);
    const courses = await makeTwoCourses(s, campus.id);
    await call(scheduleRouter.generate, {}, { context: s.owner });
    return { s, campus, ...courses };
  };

  const cellsOf = (schedule: { rows: { cells: unknown[] }[] }) =>
    schedule.rows.flatMap((row) => row.cells).filter((cell) => cell !== null) as {
      slotId: string;
      offeringId: string;
      subjectName: string;
      teacherName: string | null;
      classroomName: string;
      courseName: string;
    }[];

  test("a manager gets the course grid: block rows, break row, cells of the course", async () => {
    const { s, c1 } = await generated("VistaCurso");
    const schedule = await call(
      scheduleRouter.get,
      { view: "course", courseId: c1.id },
      { context: s.owner },
    );
    expect(schedule.title).toBe("Horario del grado Sexto A");
    expect(schedule.rows.map((row) => row.time)).toEqual([
      "07:00 - 08:00",
      "08:00 - 09:00",
      "09:00 - 09:30",
      "09:30 - 10:30",
      "10:30 - 11:30",
    ]);
    expect(schedule.rows.map((row) => row.isBreak)).toEqual([false, false, true, false, false]);
    expect(schedule.rows.every((row) => row.cells.length === 5)).toBe(true);
    expect(schedule.rows[2]?.cells.every((cell) => cell === null)).toBe(true);
    const cells = cellsOf(schedule);
    const slots = await slotsOf(s, [c1.id]);
    expect(cells.map((cell) => cell.slotId).sort()).toEqual(slots.map((slot) => slot.id).sort());
    expect(cells.every((cell) => cell.courseName === "Sexto A")).toBe(true);
    const cell = cells[0]!;
    expect(["Matemáticas", "Ciencias Naturales", "Inglés"]).toContain(cell.subjectName);
    expect(cell.teacherName).toMatch(/^(teacher|coordinator) VistaCurso$/);
    expect(cell.classroomName).toMatch(/^(Aula A[123]|Laboratorio 1)$/);
  });

  test("a course without slots returns the empty grid; course view needs a course", async () => {
    const s = await makeSchool("Vacio");
    const { campus } = await makeCampus(s);
    const course = await seedCourse(fx, s.tenant, campus.id, { name: "Vacío", academicYear: year });
    const schedule = await call(
      scheduleRouter.get,
      { view: "course", courseId: course.id },
      { context: s.owner },
    );
    expect(schedule.rows).toHaveLength(5);
    expect(cellsOf(schedule)).toHaveLength(0);
    const missing = await errorOf(
      call(scheduleRouter.get, { view: "course" }, { context: s.owner }),
    );
    expect(missing?.code).toBe("BAD_REQUEST");
    expect(missing?.message).toBe("Debes seleccionar un grado.");
    const unknown = await errorOf(
      call(scheduleRouter.get, { view: "course", courseId: "nope" }, { context: s.owner }),
    );
    expect(unknown?.code).toBe("NOT_FOUND");
    expect(unknown?.message).toBe("El grado no existe.");
  });

  test("a teacher sees only own slots; inactivo hides them, temporal keeps them", async () => {
    const { s, offerings, c1 } = await generated("VistaProfesor");
    const slots = await slotsOf(s);
    const ownCount = (personId: string) =>
      slots.filter((slot) => slot.teacherPersonId === personId).length;
    expect(ownCount(s.teacherA.personId)).toBe(8);
    expect(ownCount(s.teacherB.personId)).toBe(6);

    const mine = await call(
      scheduleRouter.get,
      { view: "teacher" },
      { context: s.teacherA.context },
    );
    expect(mine.title).toBe("Horario de teacher VistaProfesor");
    const cells = cellsOf(mine);
    expect(cells).toHaveLength(8);
    expect(cells.every((cell) => cell.teacherName === "teacher VistaProfesor")).toBe(true);
    expect(new Set(cells.map((cell) => cell.courseName))).toEqual(new Set(["Sexto A", "Sexto B"]));
    // The union of the blocks of the teacher's courses, breaks included.
    expect(mine.rows.map((row) => row.time)).toHaveLength(5);

    const theirs = await call(
      scheduleRouter.get,
      { view: "teacher" },
      { context: s.teacherB.context },
    );
    expect(theirs.title).toBe("Horario de coordinator VistaProfesor");
    expect(cellsOf(theirs)).toHaveLength(6);
    const ids = new Set(cells.map((cell) => cell.slotId));
    expect(cellsOf(theirs).some((cell) => ids.has(cell.slotId))).toBe(false);

    await fx.db
      .update(schema.teacherAssignment)
      .set({ status: "temporal" })
      .where(eq(schema.teacherAssignment.offeringId, offerings.c1Mat.id));
    expect(
      cellsOf(await call(scheduleRouter.get, { view: "teacher" }, { context: s.teacherA.context })),
    ).toHaveLength(8);
    await fx.db
      .update(schema.teacherAssignment)
      .set({ status: "inactivo" })
      .where(eq(schema.teacherAssignment.offeringId, offerings.c1Mat.id));
    const hidden = cellsOf(
      await call(scheduleRouter.get, { view: "teacher" }, { context: s.teacherA.context }),
    );
    expect(hidden).toHaveLength(5);
    expect(hidden.some((cell) => cell.offeringId === offerings.c1Mat.id)).toBe(false);
    expect(c1.id).toBeString();
  });

  test("an unrestricted manager who also teaches gets the D3 status filter in the teacher view", async () => {
    const { s, offerings } = await generated("VistaGestor");
    // The owner is unrestricted (`offeringWhere()` is undefined) yet teaches c1Nat (2 slots).
    const ownerPersonId = s.tenant.people.owner!.personId;
    await fx.db
      .update(schema.offering)
      .set({ teacherPersonId: ownerPersonId })
      .where(eq(schema.offering.id, offerings.c1Nat.id));
    const view = async () =>
      cellsOf(await call(scheduleRouter.get, { view: "teacher" }, { context: s.owner }));
    expect(await view()).toHaveLength(2);

    await fx.db
      .update(schema.teacherAssignment)
      .set({ status: "temporal" })
      .where(eq(schema.teacherAssignment.offeringId, offerings.c1Nat.id));
    expect(await view()).toHaveLength(2);

    await fx.db
      .update(schema.teacherAssignment)
      .set({ status: "inactivo" })
      .where(eq(schema.teacherAssignment.offeringId, offerings.c1Nat.id));
    expect(await view()).toHaveLength(0);
  });

  test("a teacher may view a course in scope (all its slots) and gets NOT_FOUND outside it", async () => {
    const { s, campus, c1 } = await generated("ProfesorCurso");
    const sub = await subjects(s);
    const foreignCourse = await seedCourse(fx, s.tenant, campus.id, {
      name: "Ajeno",
      academicYear: year,
    });
    await seedOffering(
      fx,
      s.tenant,
      foreignCourse.id,
      sub.mat.id,
      { personId: s.teacherB.personId },
      1,
    );
    const view = await call(
      scheduleRouter.get,
      { view: "course", courseId: c1.id },
      { context: s.teacherA.context },
    );
    expect(cellsOf(view)).toHaveLength(7);
    const outside = await errorOf(
      call(
        scheduleRouter.get,
        { view: "course", courseId: foreignCourse.id },
        { context: s.teacherA.context },
      ),
    );
    expect(outside?.code).toBe("NOT_FOUND");
    expect(
      (await errorOf(call(scheduleRouter.get, { view: "course" }, { context: s.teacherA.context })))
        ?.code,
    ).toBe("BAD_REQUEST");
  });

  test("a teacher may view the course they direct without teaching it (OD-21)", async () => {
    const { s, campus } = await generated("ProfesorDirector");
    const sub = await subjects(s);
    const directed = await seedCourse(fx, s.tenant, campus.id, {
      name: "Dirigido",
      academicYear: year,
      directorPersonId: s.teacherA.personId,
    });
    await seedOffering(fx, s.tenant, directed.id, sub.mat.id, { personId: s.teacherB.personId }, 1);
    const view = await call(
      scheduleRouter.get,
      { view: "course", courseId: directed.id },
      { context: s.teacherA.context },
    );
    expect(view.title).toBe("Horario del grado Dirigido");
    // Removing the director removes the course from the teacher's view (INS-R8).
    await fx.db
      .update(schema.course)
      .set({ directorPersonId: null })
      .where(eq(schema.course.id, directed.id));
    const gone = await errorOf(
      call(
        scheduleRouter.get,
        { view: "course", courseId: directed.id },
        { context: s.teacherA.context },
      ),
    );
    expect(gone?.code).toBe("NOT_FOUND");
  });

  /** Gives the tenant's `student` login an academic profile in `courseId` (null = no course). */
  const enrollStudentLogin = async (s: School, campusId: string, courseId: string | null) => {
    await fx.db.insert(schema.student).values({
      organizationId: s.tenant.orgId,
      personId: s.tenant.people.student!.personId,
      campusId,
      courseId,
      enrolledYear: year,
    });
    return fx.contextFor(s.tenant.people.student!, s.tenant);
  };

  test("a student reads their own course by default; another course is NOT_FOUND", async () => {
    const { s, campus, c1, c2 } = await generated("Estudiante");
    const student = await enrollStudentLogin(s, campus.id, c1.id);
    const own = await call(scheduleRouter.get, { view: "course" }, { context: student });
    expect(own.title).toBe("Horario del grado Sexto A");
    expect(cellsOf(own)).toHaveLength(7);
    const explicit = await call(
      scheduleRouter.get,
      { view: "course", courseId: c1.id },
      { context: student },
    );
    expect(cellsOf(explicit)).toHaveLength(7);
    for (const input of [
      { view: "course", courseId: c2.id },
      { view: "course", courseId: "nope" },
    ] as const) {
      const error = await errorOf(call(scheduleRouter.get, input, { context: student }));
      expect(error?.code).toBe("NOT_FOUND");
      expect(error?.message).toBe("El grado no existe.");
    }
    // A student has no teacher view.
    expect(
      (await errorOf(call(scheduleRouter.get, { view: "teacher" }, { context: student })))?.code,
    ).toBe("NOT_FOUND");
  });

  test("a student whose own course has no offerings still reads its (empty) grid", async () => {
    const s = await makeSchool("EstudianteVacio");
    const { campus } = await makeCampus(s);
    const course = await seedCourse(fx, s.tenant, campus.id, { name: "Vacío", academicYear: year });
    const student = await enrollStudentLogin(s, campus.id, course.id);
    const schedule = await call(scheduleRouter.get, { view: "course" }, { context: student });
    expect(schedule.title).toBe("Horario del grado Vacío");
    expect(cellsOf(schedule)).toHaveLength(0);
  });

  test("a student without a course (or without a profile) gets NOT_FOUND Sin curso asignado", async () => {
    const { s, campus, c1 } = await generated("SinCurso");
    const noProfile = await fx.contextFor(s.tenant.people.student!, s.tenant);
    const noProfileError = await errorOf(
      call(scheduleRouter.get, { view: "course" }, { context: noProfile }),
    );
    expect(noProfileError?.code).toBe("NOT_FOUND");
    expect(noProfileError?.message).toBe("Sin curso asignado");
    const student = await enrollStudentLogin(s, campus.id, null);
    for (const input of [{ view: "course" }, { view: "course", courseId: c1.id }] as const) {
      const error = await errorOf(call(scheduleRouter.get, input, { context: student }));
      expect(error?.code).toBe("NOT_FOUND");
      expect(error?.message).toBe(input.courseId ? "El grado no existe." : "Sin curso asignado");
    }
  });

  test("a parent is FORBIDDEN", async () => {
    const { s, c1 } = await generated("Acudiente");
    const parent = await fx.contextFor(s.tenant.people.parent!, s.tenant);
    for (const input of [
      { view: "teacher" },
      { view: "course" },
      { view: "course", courseId: c1.id },
    ] as const) {
      expect((await errorOf(call(scheduleRouter.get, input, { context: parent })))?.code).toBe(
        "FORBIDDEN",
      );
    }
  });

  /* ----------------------------- schedule.deleteSlot ----------------------------- */

  test("deleteSlot removes one slot and audits it; a repeated delete is NOT_FOUND", async () => {
    const { s, c1 } = await generated("Borrar");
    const [slot] = await slotsOf(s, [c1.id]);
    s.audit.reset();
    expect(
      await call(scheduleRouter.deleteSlot, { slotId: slot!.id }, { context: s.owner }),
    ).toEqual({
      deleted: true,
    });
    expect(await slotsOf(s)).toHaveLength(13);
    expect(s.audit.events).toHaveLength(1);
    expect(s.audit.events[0]).toMatchObject({
      action: "schedule.slot_deleted",
      targetType: "schedule_slot",
      targetId: slot!.id,
      metadata: {
        offeringId: slot!.offeringId,
        dayOfWeek: slot!.dayOfWeek,
        startTime: slot!.startTime.slice(0, 5),
        endTime: slot!.endTime.slice(0, 5),
      },
    });
    s.audit.reset();
    const again = await errorOf(
      call(scheduleRouter.deleteSlot, { slotId: slot!.id }, { context: s.owner }),
    );
    expect(again?.code).toBe("NOT_FOUND");
    expect(again?.message).toBe("La clase no existe.");
    expect(s.audit.events).toHaveLength(0);
    expect(
      (
        await errorOf(
          call(scheduleRouter.deleteSlot, { slotId: "" } as never, { context: s.owner }),
        )
      )?.code,
    ).toBe("BAD_REQUEST");
  });
});

/* ------------------------------ permission matrix ------------------------------ */

await testPermissionMatrix({
  name: "schedule",
  procedures: [
    {
      name: "schedule.get",
      permissions: null,
      anyOf: [{ schedule: ["read"] }, { student: ["read"] }],
      run: (context) => call(scheduleRouter.get, { view: "teacher" }, { context }),
    },
    {
      name: "schedule.generate",
      permissions: { schedule: ["generate"] },
      run: (context) => call(scheduleRouter.generate, { courseId: "missing" }, { context }),
    },
    {
      name: "schedule.deleteSlot",
      permissions: { schedule: ["update"] },
      run: (context) => call(scheduleRouter.deleteSlot, { slotId: "missing" }, { context }),
    },
  ],
});

/* ------------------------------- tenant isolation ------------------------------- */

type Seed = { courseId: string; courseName: string; slotId: string; campusId: string };
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const year = await currentAcademicYear(fx.db, tenant.orgId);
  const course = await seedCourse(fx, tenant, campus.id, {
    name: `Aislado ${tenant.slug}`,
    academicYear: year,
  });
  const subject = await seedSubject(fx, tenant);
  const offering = await seedOffering(fx, tenant, course.id, subject.id);
  const slot = await seedSlot(fx, tenant, campus.id, offering, { academicYear: year });
  return { courseId: course.id, courseName: course.name, slotId: slot.id, campusId: campus.id };
};
const intact = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.courseId, foreign.courseId));
  expect(rows.map((row) => row.id)).toEqual([foreign.slotId]);
};

await testTenantIsolation({
  name: "schedule",
  cases: [
    isolationCase({
      name: "schedule.get of a foreign course is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(scheduleRouter.get, { view: "course", courseId: foreign.courseId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "schedule.get for the teacher view never contains the other tenant's slots",
      seed,
      as: "teacher",
      run: ({ context }) => call(scheduleRouter.get, { view: "teacher" }, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.slotId, foreign.courseId, foreign.courseName],
    }),
    isolationCase({
      name: "schedule.generate of a foreign course is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(scheduleRouter.generate, { courseId: foreign.courseId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "schedule.generate of a foreign campus is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(scheduleRouter.generate, { campusId: foreign.campusId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "schedule.generate without filters never touches the other tenant's slots",
      seed,
      run: ({ context }) => call(scheduleRouter.generate, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.slotId, foreign.courseId, foreign.courseName],
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "schedule.deleteSlot of a foreign slot is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(scheduleRouter.deleteSlot, { slotId: foreign.slotId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
  ],
});

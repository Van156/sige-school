import { describe, expect, test } from "bun:test";

import { buildScheduleRows, generateSchedule, preferredRoomType, timesOverlap } from "./schedule";
import type {
  BusyEntry,
  ClassroomType,
  SlotCell,
  SolverBlock,
  SolverClassroom,
  SolverCourse,
  SolverInput,
  SolverOffering,
} from "./schedule";

describe("timesOverlap (half-open)", () => {
  test("adjacent intervals do not overlap", () => {
    expect(timesOverlap("10:00", "11:00", "11:00", "12:00")).toBe(false);
    expect(timesOverlap("11:00", "12:00", "10:00", "11:00")).toBe(false);
  });
  test("equal, nested and one-minute overlaps do", () => {
    expect(timesOverlap("10:00", "11:00", "10:00", "11:00")).toBe(true);
    expect(timesOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true);
    expect(timesOverlap("10:00", "11:00", "10:59", "12:00")).toBe(true);
  });
  test("accepts HH:MM:SS from the database", () => {
    expect(timesOverlap("10:00:00", "11:00:00", "11:00", "12:00")).toBe(false);
    expect(timesOverlap("10:00:00", "11:00:01", "11:00", "12:00")).toBe(false);
  });
});

describe("preferredRoomType (OQ-SCH-2)", () => {
  test("maps the name heuristic, ignoring accents and case", () => {
    expect(preferredRoomType("Educación Física")).toBe("cancha");
    expect(preferredRoomType("Ciencias Naturales")).toBe("laboratorio");
    expect(preferredRoomType("Tecnología e Informática")).toBe("laboratorio");
    expect(preferredRoomType("Matemáticas")).toBe("aula");
  });
});

describe("buildScheduleRows", () => {
  const cell = (slotId: string): SlotCell => ({
    slotId,
    offeringId: "o",
    subjectName: "Mat",
    teacherName: null,
    classroomName: "A1",
    courseName: "6-01",
  });
  const blocks = [
    { startTime: "08:00:00", endTime: "09:00:00", isBreak: false },
    { startTime: "07:00", endTime: "08:00", isBreak: false },
    { startTime: "09:00", endTime: "09:30", isBreak: true },
    { startTime: "09:00", endTime: "09:30", isBreak: false },
    { startTime: "07:00", endTime: "08:00", isBreak: false },
  ];

  test("distinct pairs sorted by start; a row is a break only if all its blocks are", () => {
    const rows = buildScheduleRows(blocks, []);
    expect(rows.map((row) => [row.time, row.isBreak])).toEqual([
      ["07:00 - 08:00", false],
      ["08:00 - 09:00", false],
      ["09:00 - 09:30", false],
    ]);
  });
  test("all-break rows are breaks", () => {
    const rows = buildScheduleRows(
      [
        { startTime: "09:00", endTime: "09:30", isBreak: true },
        { startTime: "09:00", endTime: "09:30", isBreak: true },
      ],
      [],
    );
    expect(rows[0]?.isBreak).toBe(true);
  });
  test("places each entry in the row it starts at, on its weekday", () => {
    const rows = buildScheduleRows(blocks, [
      { dayOfWeek: 2, startTime: "08:00:00", cell: cell("s1") },
      { dayOfWeek: 0, startTime: "07:00", cell: cell("s2") },
    ]);
    expect(rows[1]?.cells.map((c) => c?.slotId ?? null)).toEqual([null, null, "s1", null, null]);
    expect(rows[0]?.cells[0]?.slotId).toBe("s2");
    expect(rows[0]?.cells).toHaveLength(5);
  });
});

/* ------------------------------ Solver fixtures ------------------------------ */

const SUBJECTS = [
  ["Matemáticas", 5],
  ["Lengua Castellana", 4],
  ["Ciencias Naturales", 4],
  ["Ciencias Sociales", 3],
  ["Inglés", 3],
  ["Educación Física", 2],
  ["Artes", 2],
  ["Tecnología e Informática", 2],
  ["Ética", 1],
  ["Religión", 1],
] as const;

function block(
  campusId: string,
  shift: string,
  orderNum: number,
  startTime: string,
  endTime: string,
  isBreak = false,
): SolverBlock {
  return { campusId, shift, academicYear: "2026", isBreak, orderNum, startTime, endTime };
}

/** Seed-sized institution: 2 campuses x 3 courses, Mañana/Tarde, ten subjects, 12 teachers. */
function seedFixture(): SolverInput {
  const courses: SolverCourse[] = [];
  const offerings: SolverOffering[] = [];
  const classrooms: SolverClassroom[] = [];
  const blocks: SolverBlock[] = [];
  const teachers = Array.from({ length: 12 }, (_, i) => `t${String(i).padStart(2, "0")}`);
  for (const [campusIndex, campus] of ["c1", "c2"].entries()) {
    const campusName = `Sede ${campus}`;
    const types: ClassroomType[] = ["aula", "aula", "aula", "aula", "laboratorio", "cancha"];
    for (const [i, classroomType] of types.entries()) {
      classrooms.push({ id: `${campus}-r${i}`, campusId: campus, code: `R${i}`, classroomType });
    }
    const hours = [
      ["07:00", "08:00"],
      ["08:00", "09:00"],
      ["09:00", "10:00"],
      ["10:30", "11:30"],
      ["11:30", "12:30"],
      ["12:30", "13:30"],
    ] as const;
    for (const shift of ["Mañana", "Tarde"]) {
      for (const [n, [start, end]] of hours.entries()) {
        const shiftHour = shift === "Mañana" ? 0 : 7;
        const s = String(Number(start.slice(0, 2)) + shiftHour).padStart(2, "0") + start.slice(2);
        const e = String(Number(end.slice(0, 2)) + shiftHour).padStart(2, "0") + end.slice(2);
        blocks.push(block(campus, shift, n + 1, s, e));
      }
      blocks.push(block(campus, shift, 99, "10:00", "10:30", true));
    }
    for (const [courseIndex, shift] of ["Mañana", "Mañana", "Tarde"].entries()) {
      const courseId = `${campus}-g${courseIndex}`;
      courses.push({
        id: courseId,
        name: `${6 + courseIndex}-01`,
        campusId: campus,
        campusName,
        shift,
        academicYear: "2026",
        campusRank: courseIndex,
      });
      for (const [subjectIndex, [subjectName, hoursPerWeek]] of SUBJECTS.entries()) {
        offerings.push({
          id: `${courseId}-s${subjectIndex}`,
          courseId,
          subjectName,
          teacherPersonId: teachers[(campusIndex * 3 + courseIndex + subjectIndex) % 12] ?? null,
          hoursPerWeek,
        });
      }
    }
  }
  return { courses, offerings, blocks, classrooms };
}

function assertNoOverlaps(input: SolverInput, slots: ReturnType<typeof generateSchedule>["slots"]) {
  const teacherOf = new Map(input.offerings.map((o) => [o.id, o.teacherPersonId]));
  const groups = new Map<string, typeof slots>();
  const push = (key: string, slot: (typeof slots)[number]) =>
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  for (const slot of slots) {
    push(`room:${slot.classroomId}:${slot.dayOfWeek}`, slot);
    push(`course:${slot.courseId}:${slot.dayOfWeek}`, slot);
    const teacher = teacherOf.get(slot.offeringId);
    if (teacher) push(`teacher:${teacher}:${slot.dayOfWeek}`, slot);
  }
  for (const [key, list] of groups) {
    for (const [i, a] of list.entries()) {
      for (const b of list.slice(i + 1)) {
        const overlap = timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
        if (overlap) throw new Error(`overlap in ${key}: ${a.offeringId} vs ${b.offeringId}`);
      }
    }
  }
}

describe("generateSchedule", () => {
  test("is deterministic and independent of input order", () => {
    const input = seedFixture();
    const first = generateSchedule(input);
    expect(generateSchedule(input)).toEqual(first);
    const shuffled: SolverInput = {
      ...input,
      courses: [...input.courses].reverse(),
      offerings: [...input.offerings].reverse(),
      blocks: [...input.blocks].reverse(),
      classrooms: [...input.classrooms].reverse(),
    };
    expect(generateSchedule(shuffled)).toEqual(first);
  });

  test("never overlaps a room, a teacher or a course (seed-sized fixture)", () => {
    const input = seedFixture();
    const result = generateSchedule(input);
    expect(result.assigned).toBe(result.slots.length);
    expect(result.assigned).toBeGreaterThan(100);
    assertNoOverlaps(input, result.slots);
  });

  test("places exactly hours_per_week slots per offering when capacity allows", () => {
    const input = seedFixture();
    const result = generateSchedule(input);
    const total = input.offerings.reduce((sum, o) => sum + o.hoursPerWeek, 0);
    expect(result.conflicts).toBe(total - result.assigned);
    for (const slot of result.slots) {
      expect(input.blocks.some((b) => b.startTime === slot.startTime && !b.isBreak)).toBe(true);
    }
  });

  test("property: holds across many generated variants", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const base = seedFixture();
      const offerings = base.offerings.map((o, i) => ({
        ...o,
        hoursPerWeek: 1 + ((i * seed) % 6),
        teacherPersonId: (i + seed) % 5 === 0 ? null : `t${(i * seed) % 7}`,
      }));
      const input = { ...base, offerings };
      assertNoOverlaps(input, generateSchedule(input).slots);
    }
  });

  test("counts unplaceable hours as conflicts when blocks are scarce", () => {
    const input: SolverInput = {
      courses: [
        {
          id: "g",
          name: "6-01",
          campusId: "c",
          campusName: "Sede",
          shift: "Mañana",
          academicYear: "2026",
          campusRank: 0,
        },
      ],
      offerings: [
        { id: "o1", courseId: "g", subjectName: "Mat", teacherPersonId: null, hoursPerWeek: 20 },
      ],
      blocks: [block("c", "Mañana", 1, "07:00", "08:00")],
      classrooms: [{ id: "r", campusId: "c", code: "A", classroomType: "aula" }],
    };
    const result = generateSchedule(input);
    expect(result.assigned).toBe(5);
    expect(result.conflicts).toBe(15);
  });

  test("respects busy teachers and classrooms of non-target courses", () => {
    const input = seedFixture();
    const free = generateSchedule(input);
    const busyTeachers: BusyEntry[] = [];
    const busyClassrooms: BusyEntry[] = [];
    for (const day of [0, 1, 2, 3, 4]) {
      busyTeachers.push({ id: "t00", dayOfWeek: day, startTime: "07:00", endTime: "09:00" });
      busyClassrooms.push({ id: "c1-r0", dayOfWeek: day, startTime: "07:30", endTime: "08:30" });
    }
    const result = generateSchedule({ ...input, busyTeachers, busyClassrooms });
    const teacherOf = new Map(input.offerings.map((o) => [o.id, o.teacherPersonId]));
    for (const slot of result.slots) {
      if (teacherOf.get(slot.offeringId) === "t00") {
        expect(timesOverlap(slot.startTime, slot.endTime, "07:00", "09:00")).toBe(false);
      }
      if (slot.classroomId === "c1-r0") {
        expect(timesOverlap(slot.startTime, slot.endTime, "07:30", "08:30")).toBe(false);
      }
    }
    expect(free.slots.some((s) => s.classroomId === "c1-r0" && s.startTime === "07:00")).toBe(true);
    assertNoOverlaps(input, result.slots);
  });

  test("skips courses without blocks with the reason, and Sabatina always", () => {
    const base = seedFixture();
    const input: SolverInput = {
      ...base,
      courses: [
        ...base.courses,
        {
          id: "sab",
          name: "11-S",
          campusId: "c1",
          campusName: "Sede c1",
          shift: "Sabatina",
          academicYear: "2026",
          campusRank: 9,
        },
        {
          id: "noc",
          name: "10-N",
          campusId: "c1",
          campusName: "Sede c1",
          shift: "Nocturna",
          academicYear: "2026",
          campusRank: 10,
        },
      ],
      offerings: [
        ...base.offerings,
        {
          id: "sab-o",
          courseId: "sab",
          subjectName: "Mat",
          teacherPersonId: null,
          hoursPerWeek: 4,
        },
        {
          id: "noc-o",
          courseId: "noc",
          subjectName: "Mat",
          teacherPersonId: null,
          hoursPerWeek: 3,
        },
      ],
    };
    const withOnly = generateSchedule(base);
    const result = generateSchedule(input);
    expect(result.skipped).toEqual([
      {
        courseId: "sab",
        courseName: "11-S",
        reason: "Sin bloques de tiempo para Sede c1 · Sabatina.",
      },
      {
        courseId: "noc",
        courseName: "10-N",
        reason: "Sin bloques de tiempo para Sede c1 · Nocturna.",
      },
    ]);
    expect(result.conflicts).toBe(withOnly.conflicts + 7);
    expect(result.slots.some((s) => s.courseId === "sab" || s.courseId === "noc")).toBe(false);
  });

  test("prefers rooms of the subject's type", () => {
    const result = generateSchedule(seedFixture());
    const roomType = new Map(seedFixture().classrooms.map((r) => [r.id, r.classroomType]));
    const subjectOf = new Map(seedFixture().offerings.map((o) => [o.id, o.subjectName]));
    const pe = result.slots.filter((s) => subjectOf.get(s.offeringId) === "Educación Física");
    const inField = pe.filter((s) => roomType.get(s.classroomId) === "cancha");
    expect(pe.length).toBeGreaterThan(0);
    expect(inField.length).toBeGreaterThan(pe.length / 2);
    const labs = result.slots.filter((s) => subjectOf.get(s.offeringId) === "Ciencias Naturales");
    expect(labs.some((s) => roomType.get(s.classroomId) === "laboratorio")).toBe(true);
  });

  test("falls back to the home classroom or any aula when the preferred type is taken or missing", () => {
    const input: SolverInput = {
      courses: [
        {
          id: "g",
          name: "6-01",
          campusId: "c",
          campusName: "Sede",
          shift: "Mañana",
          academicYear: "2026",
          campusRank: 0,
        },
      ],
      offerings: [
        {
          id: "o1",
          courseId: "g",
          subjectName: "Educación Física",
          teacherPersonId: null,
          hoursPerWeek: 2,
        },
      ],
      blocks: [
        block("c", "Mañana", 1, "07:00", "08:00"),
        block("c", "Mañana", 2, "08:00", "09:00"),
      ],
      classrooms: [{ id: "r", campusId: "c", code: "A", classroomType: "aula" }],
    };
    const result = generateSchedule(input);
    expect(result.assigned).toBe(2);
    expect(result.slots.every((s) => s.classroomId === "r")).toBe(true);
  });
});

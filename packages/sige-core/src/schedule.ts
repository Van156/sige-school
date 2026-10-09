/**
 * Pure scheduling rules (sige/04 §3.5, SCH-R9, SCH-R10): half-open interval overlap, the weekly
 * grid rows and the deterministic timetable solver. No framework or database imports so the API
 * service, the seed and the web share one definition.
 */

export const SCHEDULE_DAYS = 5;
export type DayOfWeek = 0 | 1 | 2 | 3 | 4;
export type ClassroomType = "aula" | "laboratorio" | "auditorio" | "cancha";

/** Minutes since midnight of an `HH:MM` or `HH:MM:SS` time. */
export function toMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** `HH:MM` display form of an `HH:MM` or `HH:MM:SS` time. */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** Half-open overlap: `[aStart, aEnd)` and `[bStart, bEnd)` share time. Adjacent intervals do not. */
export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

/* ------------------------------ Weekly grid ------------------------------ */

export type SlotCell = {
  slotId: string;
  offeringId: string;
  subjectName: string;
  teacherName: string | null;
  classroomName: string;
  courseName: string;
};

export type WeeklyScheduleRow = {
  /** "07:00 - 08:00". */
  time: string;
  /** A row is a break only when every block sharing it is a break. */
  isBreak: boolean;
  /** Monday..Friday (index 0..4). */
  cells: (SlotCell | null)[];
};

export type WeeklySchedule = {
  title: string;
  rows: WeeklyScheduleRow[];
};

export type GridBlock = { startTime: string; endTime: string; isBreak: boolean };
export type GridEntry = { dayOfWeek: number; startTime: string; cell: SlotCell };

/**
 * One row per distinct `(start, end)` pair of `blocks`, sorted by start time (then end), with the
 * entry that starts at the row start on each weekday.
 */
export function buildScheduleRows(
  blocks: readonly GridBlock[],
  entries: readonly GridEntry[],
): WeeklyScheduleRow[] {
  const rows = new Map<string, { start: string; end: string; isBreak: boolean }>();
  for (const block of blocks) {
    const start = formatTime(block.startTime);
    const end = formatTime(block.endTime);
    const key = `${start}-${end}`;
    const known = rows.get(key);
    rows.set(key, { start, end, isBreak: known ? known.isBreak && block.isBreak : block.isBreak });
  }
  return [...rows.values()]
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
    .map((row) => ({
      time: `${row.start} - ${row.end}`,
      isBreak: row.isBreak,
      cells: Array.from(
        { length: SCHEDULE_DAYS },
        (_, day) =>
          entries.find(
            (entry) => entry.dayOfWeek === day && formatTime(entry.startTime) === row.start,
          )?.cell ?? null,
      ),
    }));
}

/* ------------------------------ Room heuristic ------------------------------ */

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Room type a subject prefers (OQ-SCH-2): PE on the field, sciences and technology in labs,
 * everything else in a regular classroom.
 */
export function preferredRoomType(subjectName: string): ClassroomType {
  const name = normalize(subjectName);
  if (name.includes("fisica")) return "cancha";
  if (name.includes("natural") || name.includes("tecnolog")) return "laboratorio";
  return "aula";
}

/* ------------------------------ Solver ------------------------------ */

export type SolverCourse = {
  id: string;
  name: string;
  campusId: string;
  campusName: string;
  /** `Mañana`, `Tarde`, `Nocturna`, `Única` or `Sabatina` (never has blocks). */
  shift: string;
  academicYear: string;
  /** Position of the course among all courses of its campus; picks its home classroom. */
  campusRank: number;
};

export type SolverOffering = {
  id: string;
  courseId: string;
  subjectName: string;
  teacherPersonId: string | null;
  hoursPerWeek: number;
};

export type SolverBlock = {
  campusId: string;
  shift: string;
  academicYear: string;
  isBreak: boolean;
  orderNum: number;
  startTime: string;
  endTime: string;
};

export type SolverClassroom = {
  id: string;
  campusId: string;
  code: string;
  classroomType: ClassroomType;
};

/** A time already taken by a teacher or classroom outside the target courses. */
export type BusyEntry = { id: string; dayOfWeek: number; startTime: string; endTime: string };

export type SolverInput = {
  courses: readonly SolverCourse[];
  offerings: readonly SolverOffering[];
  blocks: readonly SolverBlock[];
  classrooms: readonly SolverClassroom[];
  busyTeachers?: readonly BusyEntry[];
  busyClassrooms?: readonly BusyEntry[];
};

export type GeneratedSlot = {
  courseId: string;
  offeringId: string;
  classroomId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  academicYear: string;
};

export type SkippedCourse = { courseId: string; courseName: string; reason: string };

export type ScheduleResult = {
  slots: GeneratedSlot[];
  assigned: number;
  conflicts: number;
  skipped: SkippedCourse[];
};

type Busy = Map<string, { day: number; start: number; end: number }[]>;

function isFree(busy: Busy, id: string, day: number, start: number, end: number): boolean {
  return !(busy.get(id) ?? []).some(
    (taken) => taken.day === day && taken.start < end && start < taken.end,
  );
}

function markBusy(busy: Busy, id: string, day: number, start: number, end: number): void {
  const list = busy.get(id) ?? [];
  list.push({ day, start, end });
  busy.set(id, list);
}

function seedBusy(entries: readonly BusyEntry[] | undefined): Busy {
  const busy: Busy = new Map();
  for (const entry of entries ?? []) {
    markBusy(busy, entry.id, entry.dayOfWeek, toMinutes(entry.startTime), toMinutes(entry.endTime));
  }
  return busy;
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function noBlocksReason(campusName: string, shift: string): string {
  return `Sin bloques de tiempo para ${campusName} · ${shift}.`;
}

/**
 * Deterministic greedy timetable (SCH-R10): places every weekly hour of each offering in a
 * non-break block of the course's campus, shift and year, without overlapping a room, a teacher
 * or the course itself, honouring the busy sets of non-target courses. Hours that find no cell
 * count as conflicts. Output depends only on the input values, never on input order.
 */
export function generateSchedule(input: SolverInput): ScheduleResult {
  const teacherBusy = seedBusy(input.busyTeachers);
  const roomBusy = seedBusy(input.busyClassrooms);
  const slots: GeneratedSlot[] = [];
  const skipped: SkippedCourse[] = [];
  let conflicts = 0;

  const courses = [...input.courses].sort(
    (a, b) => compare(a.campusId, b.campusId) || a.campusRank - b.campusRank || compare(a.id, b.id),
  );

  for (const course of courses) {
    const items = input.offerings
      .filter((offering) => offering.courseId === course.id)
      .sort((a, b) => b.hoursPerWeek - a.hoursPerWeek || compare(a.id, b.id));

    const blocks = input.blocks
      .filter(
        (block) =>
          block.campusId === course.campusId &&
          block.shift === course.shift &&
          block.academicYear === course.academicYear &&
          !block.isBreak,
      )
      .sort((a, b) => a.orderNum - b.orderNum || compare(a.startTime, b.startTime));

    if (blocks.length === 0) {
      skipped.push({
        courseId: course.id,
        courseName: course.name,
        reason: noBlocksReason(course.campusName, course.shift),
      });
      conflicts += items.reduce((sum, item) => sum + item.hoursPerWeek, 0);
      continue;
    }

    const rooms = input.classrooms
      .filter((room) => room.campusId === course.campusId)
      .sort((a, b) => compare(a.code, b.code) || compare(a.id, b.id));
    const aulas = rooms.filter((room) => room.classroomType === "aula");
    const homeRoom = aulas.length > 0 ? aulas[course.campusRank % aulas.length] : undefined;

    const courseCells = new Set<string>();
    const daysUsed = new Map<string, Set<number>>();
    const maxHours = Math.max(0, ...items.map((item) => item.hoursPerWeek));

    for (let hour = 0; hour < maxHours; hour += 1) {
      for (const [index, item] of items.entries()) {
        if (item.hoursPerWeek <= hour) continue;
        const used = daysUsed.get(item.id) ?? new Set<number>();
        const rotation = (index + hour * 2) % SCHEDULE_DAYS;
        const days = Array.from(
          { length: SCHEDULE_DAYS },
          (_, d) => (d + rotation) % SCHEDULE_DAYS,
        );
        const orderedDays = [
          ...days.filter((day) => !used.has(day)),
          ...days.filter((day) => used.has(day)),
        ];
        const type = preferredRoomType(item.subjectName);
        const candidates = [
          ...rooms.filter((room) => room.classroomType === type),
          ...(homeRoom ? [homeRoom] : []),
          ...aulas,
        ];

        let placed = false;
        for (const day of orderedDays) {
          for (let offset = 0; offset < blocks.length && !placed; offset += 1) {
            const block = blocks[(index + day + offset) % blocks.length];
            if (!block) continue;
            const cell = `${day}-${block.startTime}-${block.endTime}`;
            if (courseCells.has(cell)) continue;
            const start = toMinutes(block.startTime);
            const end = toMinutes(block.endTime);
            if (item.teacherPersonId && !isFree(teacherBusy, item.teacherPersonId, day, start, end))
              continue;
            const room = candidates.find((candidate) =>
              isFree(roomBusy, candidate.id, day, start, end),
            );
            if (!room) continue;

            if (item.teacherPersonId) markBusy(teacherBusy, item.teacherPersonId, day, start, end);
            markBusy(roomBusy, room.id, day, start, end);
            courseCells.add(cell);
            used.add(day);
            daysUsed.set(item.id, used);
            slots.push({
              courseId: course.id,
              offeringId: item.id,
              classroomId: room.id,
              dayOfWeek: day as DayOfWeek,
              startTime: block.startTime,
              endTime: block.endTime,
              academicYear: course.academicYear,
            });
            placed = true;
          }
          if (placed) break;
        }
        if (!placed) conflicts += 1;
      }
    }
  }

  return { slots, assigned: slots.length, conflicts, skipped };
}

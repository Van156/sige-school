import { attendance, finalGrades } from "./academics";
import { gradeStore, subjectStore, userStore, type DeleteResult } from "./admin";
import { REFERENCE_DATE, timesOverlap } from "./dates";
import {
  assignmentStore,
  blockStore,
  classroomStore,
  enrollmentStore,
  parentLinkStore,
  scheduleStore,
  studentStore,
  subjectGradeStore,
} from "./school";
import type { ClassroomType, DayOfWeek } from "./types";

/**
 * Writes that touch several T3 stores at once (enrolling, assigning, generating schedules) and the
 * guarded deletions of the student and scheduling entities. Same contract as `admin.ts`: a delete
 * either removes the entity or returns the reason it has dependents.
 */

const OK: DeleteResult = { ok: true };
const blocked = (reason: string): DeleteResult => ({ ok: false, reason });

/* ------------------------------ Guarded deletions ------------------------------ */

/** Deleting a student removes the profile, its guardian links and the user account. */
export function deleteStudent(studentId: number): DeleteResult {
  const student = studentStore.getSnapshot().find((entry) => entry.id === studentId);
  if (!student) return OK;
  const hasRecords =
    finalGrades.some((grade) => grade.studentId === studentId) ||
    attendance.some((row) => row.studentId === studentId) ||
    enrollmentStore.getSnapshot().some((row) => row.studentId === studentId);
  if (hasRecords) return blocked("El estudiante tiene matrículas, notas o asistencia registradas.");
  parentLinkStore
    .getSnapshot()
    .filter((link) => link.studentId === studentId)
    .forEach((link) => parentLinkStore.remove(link.id));
  studentStore.remove(studentId);
  userStore.remove(student.userId);
  return OK;
}

export function deleteSubjectGrade(subjectGradeId: number): DeleteResult {
  if (enrollmentStore.getSnapshot().some((row) => row.subjectGradeId === subjectGradeId)) {
    return blocked("La materia del grado tiene estudiantes matriculados.");
  }
  if (scheduleStore.getSnapshot().some((row) => row.subjectGradeId === subjectGradeId)) {
    return blocked("La materia del grado tiene clases programadas en el horario.");
  }
  assignmentStore
    .getSnapshot()
    .filter((row) => row.subjectGradeId === subjectGradeId)
    .forEach((row) => assignmentStore.remove(row.id));
  subjectGradeStore.remove(subjectGradeId);
  return OK;
}

export function deleteClassroom(classroomId: number): DeleteResult {
  if (scheduleStore.getSnapshot().some((row) => row.classroomId === classroomId)) {
    return blocked("El salón tiene clases programadas en el horario.");
  }
  classroomStore.remove(classroomId);
  return OK;
}

/** A block is "in use" when a course of its campus and shift has a class starting at its time. */
export function deleteBlock(blockId: number): DeleteResult {
  const block = blockStore.getSnapshot().find((entry) => entry.id === blockId);
  if (!block) return OK;
  const courseIds = new Set(
    gradeStore
      .getSnapshot()
      .filter((grade) => grade.campusId === block.campusId && grade.shift === block.shift)
      .map((grade) => grade.id),
  );
  const subjectGradeIds = new Set(
    subjectGradeStore
      .getSnapshot()
      .filter((item) => courseIds.has(item.gradeId))
      .map((item) => item.id),
  );
  const inUse = scheduleStore
    .getSnapshot()
    .some((row) => subjectGradeIds.has(row.subjectGradeId) && row.startTime === block.startTime);
  if (inUse) return blocked("El bloque tiene clases programadas en el horario.");
  blockStore.remove(blockId);
  return OK;
}

/** Removing a teacher assignment leaves the subject without teacher ("Sin asignar"). */
export function deleteAssignment(assignmentId: number) {
  const assignment = assignmentStore.getSnapshot().find((row) => row.id === assignmentId);
  if (!assignment) return;
  subjectGradeStore.update(assignment.subjectGradeId, { teacherId: undefined });
  assignmentStore.remove(assignmentId);
}

/* ------------------------------- Enrollment ------------------------------- */

/**
 * Enrolls the students in every subject of the course and moves them to it (SCH-02 create mode).
 * Returns how many subject enrollments were created.
 */
export function enrollStudents(
  gradeId: number,
  studentIds: readonly number[],
  academicYear: string,
): number {
  const grade = gradeStore.getSnapshot().find((entry) => entry.id === gradeId);
  if (!grade) return 0;
  const courseSubjects = subjectGradeStore.getSnapshot().filter((item) => item.gradeId === gradeId);
  let created = 0;
  for (const studentId of studentIds) {
    studentStore.update(studentId, { gradeId, campusId: grade.campusId });
    for (const item of courseSubjects) {
      const exists = enrollmentStore
        .getSnapshot()
        .some(
          (row) =>
            row.studentId === studentId &&
            row.subjectGradeId === item.id &&
            row.academicYear === academicYear,
        );
      if (exists) continue;
      enrollmentStore.add({
        studentId,
        subjectGradeId: item.id,
        academicYear,
        enrollmentDate: REFERENCE_DATE,
        status: "activa",
      });
      created += 1;
    }
  }
  return created;
}

/* ------------------------------ Subject-grades ------------------------------ */

/** Registers the teacher assignment row of a subject-grade (one per subject-grade). */
function upsertAssignment(subjectGradeId: number, teacherId: number, academicYear: string) {
  const existing = assignmentStore
    .getSnapshot()
    .find((row) => row.subjectGradeId === subjectGradeId);
  if (existing) {
    assignmentStore.update(existing.id, { teacherId, status: "activo" });
  } else {
    assignmentStore.add({
      subjectGradeId,
      teacherId,
      academicYear,
      assignmentDate: REFERENCE_DATE,
      status: "activo",
    });
  }
}

/** Assigns every subject to every course (SCH-06); existing pairs are skipped. */
export function assignSubjects(input: {
  gradeIds: readonly number[];
  subjectIds: readonly number[];
  teacherId?: number;
  hoursPerWeek: number;
  academicYear: string;
}): { created: number; skipped: number } {
  let created = 0;
  let skipped = 0;
  for (const gradeId of input.gradeIds) {
    for (const subjectId of input.subjectIds) {
      const exists = subjectGradeStore
        .getSnapshot()
        .some((item) => item.gradeId === gradeId && item.subjectId === subjectId);
      if (exists) {
        skipped += 1;
        continue;
      }
      const item = subjectGradeStore.add({
        gradeId,
        subjectId,
        teacherId: input.teacherId,
        hoursPerWeek: input.hoursPerWeek,
      });
      if (input.teacherId !== undefined) {
        upsertAssignment(item.id, input.teacherId, input.academicYear);
      }
      created += 1;
    }
  }
  return { created, skipped };
}

/** SCH-04 create: sets the teacher of a (course, subject), creating the subject-grade if needed. */
export function assignTeacher(input: {
  gradeId: number;
  subjectId: number;
  teacherId: number;
  academicYear: string;
  notes?: string;
}) {
  const existing = subjectGradeStore
    .getSnapshot()
    .find((item) => item.gradeId === input.gradeId && item.subjectId === input.subjectId);
  const subjectGradeId = existing
    ? existing.id
    : subjectGradeStore.add({
        gradeId: input.gradeId,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        hoursPerWeek: 4,
      }).id;
  if (existing) subjectGradeStore.update(existing.id, { teacherId: input.teacherId });
  upsertAssignment(subjectGradeId, input.teacherId, input.academicYear);
  if (input.notes) {
    const row = assignmentStore
      .getSnapshot()
      .find((entry) => entry.subjectGradeId === subjectGradeId);
    if (row) assignmentStore.update(row.id, { notes: input.notes });
  }
}

/* --------------------------- Schedule generation --------------------------- */

interface BusySlot {
  day: number;
  start: string;
  end: string;
}

type Busy = Map<number, BusySlot[]>;

function isFree(busy: Busy, id: number, slot: BusySlot): boolean {
  return !(busy.get(id) ?? []).some(
    (taken) => taken.day === slot.day && timesOverlap(taken.start, taken.end, slot.start, slot.end),
  );
}

function markBusy(busy: Busy, id: number, slot: BusySlot) {
  busy.set(id, [...(busy.get(id) ?? []), slot]);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Room type a subject prefers (PE on the field, sciences and technology in labs). */
function preferredRoomType(subjectName: string): ClassroomType {
  const name = normalize(subjectName);
  if (name.includes("fisica")) return "cancha";
  if (name.includes("natural") || name.includes("tecnolog")) return "laboratorio";
  return "aula";
}

export interface ScheduleRun {
  assigned: number;
  conflicts: number;
}

/**
 * Greedy timetable (SCH-12): replaces the schedule of the given courses, placing every weekly hour
 * of each subject in a non-break block of the course's campus and shift without double-booking a
 * teacher, a room or the course itself. Hours that find no slot count as conflicts.
 */
export function generateSchedule(gradeIds: readonly number[], academicYear: string): ScheduleRun {
  const targets = new Set(gradeIds);
  const allSubjectGrades = subjectGradeStore.getSnapshot();
  const subjectById = new Map(subjectStore.getSnapshot().map((subject) => [subject.id, subject]));
  const teacherOf = new Map(allSubjectGrades.map((item) => [item.id, item.teacherId]));
  const gradeOf = new Map(allSubjectGrades.map((item) => [item.id, item.gradeId]));

  scheduleStore
    .getSnapshot()
    .filter((row) => targets.has(gradeOf.get(row.subjectGradeId) ?? -1))
    .forEach((row) => scheduleStore.remove(row.id));

  const teacherBusy: Busy = new Map();
  const roomBusy: Busy = new Map();
  for (const row of scheduleStore.getSnapshot()) {
    const slot = { day: row.dayOfWeek, start: row.startTime, end: row.endTime };
    const teacherId = teacherOf.get(row.subjectGradeId);
    if (teacherId !== undefined) markBusy(teacherBusy, teacherId, slot);
    markBusy(roomBusy, row.classroomId, slot);
  }

  let assigned = 0;
  let conflicts = 0;
  const allBlocks = blockStore.getSnapshot();
  const allRooms = classroomStore.getSnapshot();

  for (const grade of gradeStore.getSnapshot().filter((entry) => targets.has(entry.id))) {
    const blocks = allBlocks
      .filter(
        (block) =>
          block.campusId === grade.campusId &&
          block.shift === grade.shift &&
          block.academicYear === academicYear &&
          !block.isBreak,
      )
      .sort((a, b) => a.orderNum - b.orderNum);
    const rooms = allRooms.filter((room) => room.campusId === grade.campusId);
    const classrooms = rooms.filter((room) => room.classroomType === "aula");
    const campusGrades = gradeStore
      .getSnapshot()
      .filter((entry) => entry.campusId === grade.campusId);
    const homeRoom =
      classrooms[
        Math.max(
          0,
          campusGrades.findIndex((e) => e.id === grade.id),
        ) % Math.max(1, classrooms.length)
      ];

    const items = allSubjectGrades
      .filter((item) => item.gradeId === grade.id)
      .sort((a, b) => b.hoursPerWeek - a.hoursPerWeek || a.id - b.id);
    const groupCells = new Set<string>();
    const daysUsed = new Map<number, Set<number>>();
    const maxHours = Math.max(0, ...items.map((item) => item.hoursPerWeek));

    for (let hour = 0; hour < maxHours; hour += 1) {
      for (const item of items) {
        if (item.hoursPerWeek <= hour) continue;
        const used = daysUsed.get(item.id) ?? new Set<number>();
        const rotation = (item.id + hour * 2) % 5;
        const days = Array.from({ length: 5 }, (_, index) => (index + rotation) % 5);
        const orderedDays = [
          ...days.filter((day) => !used.has(day)),
          ...days.filter((day) => used.has(day)),
        ];
        const type = preferredRoomType(subjectById.get(item.subjectId)?.name ?? "");
        const candidates = [
          ...rooms.filter((room) => room.classroomType === type),
          ...(homeRoom ? [homeRoom] : []),
          ...classrooms,
        ];

        let placed = false;
        for (const day of orderedDays) {
          for (let offset = 0; offset < blocks.length && !placed; offset += 1) {
            const block = blocks[(item.id + day + offset) % blocks.length];
            if (!block) continue;
            const cell = `${day}-${block.id}`;
            if (groupCells.has(cell)) continue;
            const slot = { day, start: block.startTime, end: block.endTime };
            if (item.teacherId !== undefined && !isFree(teacherBusy, item.teacherId, slot))
              continue;
            const room = candidates.find((candidate) => isFree(roomBusy, candidate.id, slot));
            if (!room) continue;

            if (item.teacherId !== undefined) markBusy(teacherBusy, item.teacherId, slot);
            markBusy(roomBusy, room.id, slot);
            groupCells.add(cell);
            used.add(day);
            daysUsed.set(item.id, used);
            scheduleStore.add({
              subjectGradeId: item.id,
              classroomId: room.id,
              dayOfWeek: day as DayOfWeek,
              startTime: block.startTime,
              endTime: block.endTime,
              academicYear,
              isActive: true,
            });
            assigned += 1;
            placed = true;
          }
          if (placed) break;
        }
        if (!placed) conflicts += 1;
      }
    }
  }
  return { assigned, conflicts };
}

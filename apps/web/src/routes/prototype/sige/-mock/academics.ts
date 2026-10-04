import {
  ACTIVE_PERIOD_CRITERION_IDS,
  TEACHER_ID,
  criteria,
  grades,
  periods,
  scheduleBlocks,
  subjectHoursPerWeek,
  subjects,
  type SubjectCode,
  type TeacherKey,
} from "./base";
import {
  ACADEMIC_YEAR,
  REFERENCE_DATE,
  addDays,
  dateRange,
  timesOverlap,
  weekdayIndex,
} from "./dates";
import {
  annualScore,
  annualStatusFromScore,
  clampScore,
  finalScore,
  round,
  statusFromScore,
} from "./helpers";
import { students, studentName, userById } from "./people";
import { createRng } from "./prng";
import type {
  AnnualGrade,
  Attendance,
  AttendanceStatus,
  DayOfWeek,
  FinalGrade,
  GradeRecord,
  Schedule,
  StudentEnrollment,
  SubjectGrade,
  TeacherSubjectAssignment,
} from "./types";

/** Subject-grades, schedules, enrollments, grades and attendance (inventory 5.3, 5.5, 5.8, 5.9). */

const rng = createRng(4242);

const ALL_GROUPS = ["6-01", "6-02", "7-01", "11-01", "1-01", "5-01"] as const;

interface TeachingRow {
  teacher: TeacherKey;
  subject: SubjectCode;
  groups: readonly string[];
}

/** Who teaches what: exactly one teacher per subject and group. */
const TEACHING_PLAN: readonly TeachingRow[] = [
  { teacher: "laura", subject: "MAT", groups: ["6-01", "6-02", "7-01"] },
  { teacher: "andres", subject: "LEN", groups: ["6-01", "6-02", "7-01"] },
  { teacher: "carolina", subject: "CNA", groups: ["6-01", "6-02", "7-01"] },
  { teacher: "jorge", subject: "MAT", groups: ["11-01"] },
  { teacher: "jorge", subject: "CNA", groups: ["11-01"] },
  { teacher: "marcela", subject: "MAT", groups: ["1-01"] },
  { teacher: "marcela", subject: "LEN", groups: ["1-01"] },
  { teacher: "marcela", subject: "CNA", groups: ["1-01"] },
  { teacher: "marcela", subject: "SOC", groups: ["1-01"] },
  { teacher: "marcela", subject: "TEC", groups: ["1-01"] },
  { teacher: "diego", subject: "MAT", groups: ["5-01"] },
  { teacher: "diego", subject: "LEN", groups: ["5-01"] },
  { teacher: "diego", subject: "CNA", groups: ["5-01"] },
  { teacher: "diego", subject: "SOC", groups: ["5-01"] },
  { teacher: "sandra", subject: "SOC", groups: ["6-01", "6-02", "7-01"] },
  { teacher: "sandra", subject: "ETI", groups: ["6-01", "6-02", "7-01", "11-01"] },
  { teacher: "felipe", subject: "ING", groups: ["6-01", "6-02", "7-01", "11-01", "5-01"] },
  { teacher: "natalia", subject: "TEC", groups: ["6-01", "6-02", "7-01", "11-01", "5-01"] },
  { teacher: "natalia", subject: "ART", groups: ["6-01", "6-02", "7-01", "11-01"] },
  { teacher: "oscar", subject: "EDF", groups: ALL_GROUPS },
  { teacher: "juliana", subject: "LEN", groups: ["11-01"] },
  { teacher: "juliana", subject: "SOC", groups: ["11-01"] },
  { teacher: "juliana", subject: "ART", groups: ["1-01", "5-01"] },
  { teacher: "mauricio", subject: "REL", groups: ALL_GROUPS },
  { teacher: "mauricio", subject: "ETI", groups: ["1-01", "5-01"] },
];

const gradeByName = new Map(grades.map((grade) => [grade.name, grade]));
const subjectByCode = new Map(subjects.map((subject) => [subject.code as SubjectCode, subject]));
export const gradeById = new Map(grades.map((grade) => [grade.id, grade]));
export const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

export const subjectGrades: SubjectGrade[] = TEACHING_PLAN.flatMap((row) =>
  row.groups.map((groupName) => ({
    subjectId: (subjectByCode.get(row.subject) as { id: number }).id,
    gradeId: (gradeByName.get(groupName) as { id: number }).id,
    teacherId: TEACHER_ID[row.teacher],
    hoursPerWeek: subjectHoursPerWeek[row.subject],
  })),
)
  .sort((a, b) => a.gradeId - b.gradeId || a.subjectId - b.subjectId)
  .map((row, index) => ({ id: index + 1, ...row }));

export const subjectGradeById = new Map(subjectGrades.map((item) => [item.id, item]));

export function subjectGradeLabel(subjectGradeId: number): string {
  const item = subjectGradeById.get(subjectGradeId);
  if (!item) return "";
  return `${subjectById.get(item.subjectId)?.name} · ${gradeById.get(item.gradeId)?.name}`;
}

function subjectCodeOf(item: SubjectGrade): SubjectCode {
  return subjectById.get(item.subjectId)?.code as SubjectCode;
}

export const teacherAssignments: TeacherSubjectAssignment[] = subjectGrades.map((item) => {
  const code = subjectCodeOf(item);
  const groupName = gradeById.get(item.gradeId)?.name;
  const temporary = code === "ART" && groupName === "5-01";
  const inactive = code === "ETI" && groupName === "11-01";
  return {
    id: item.id,
    subjectGradeId: item.id,
    teacherId: item.teacherId,
    academicYear: ACADEMIC_YEAR,
    assignmentDate: "2026-01-19",
    status: temporary ? "temporal" : inactive ? "inactivo" : "activo",
    notes: temporary
      ? "Reemplazo temporal por incapacidad médica"
      : inactive
        ? "Pendiente de reasignación para el cuarto periodo"
        : undefined,
  };
});

/* ------------------------------ Schedules ------------------------------ */

const HOME_ROOM: Record<string, number> = {
  "6-01": 1,
  "6-02": 2,
  "7-01": 3,
  "11-01": 4,
  "1-01": 11,
  "5-01": 12,
};

const ROOM_ID = {
  lab: 7,
  computers: 8,
  field: 10,
  northField: 14,
  northArts: 13,
} as const;

function preferredRoom(code: SubjectCode, campusId: number): number | undefined {
  if (campusId === 1) {
    if (code === "CNA") return ROOM_ID.lab;
    if (code === "TEC") return ROOM_ID.computers;
    if (code === "EDF") return ROOM_ID.field;
  } else {
    if (code === "EDF") return ROOM_ID.northField;
    if (code === "ART") return ROOM_ID.northArts;
  }
  return undefined;
}

interface BusySlot {
  day: number;
  start: string;
  end: string;
}

function isFree(
  busy: Map<number, BusySlot[]>,
  id: number,
  day: number,
  start: string,
  end: string,
) {
  return !(busy.get(id) ?? []).some(
    (slot) => slot.day === day && timesOverlap(slot.start, slot.end, start, end),
  );
}

function markBusy(busy: Map<number, BusySlot[]>, id: number, slot: BusySlot) {
  busy.set(id, [...(busy.get(id) ?? []), slot]);
}

/**
 * Greedy timetable: every group gets all its weekly hours Monday-Friday, no teacher or room is
 * ever double-booked (overlap-aware, across campuses and shifts).
 */
function generateSchedules(): Schedule[] {
  const result: Schedule[] = [];
  const teacherBusy = new Map<number, BusySlot[]>();
  const roomBusy = new Map<number, BusySlot[]>();

  for (const grade of grades) {
    const blocks = scheduleBlocks
      .filter(
        (block) =>
          block.campusId === grade.campusId && block.shift === grade.shift && !block.isBreak,
      )
      .sort((a, b) => a.orderNum - b.orderNum);
    const groupCells = new Set<string>();
    const daysBySubjectGrade = new Map<number, Set<number>>();
    const gradeSubjects = subjectGrades
      .filter((item) => item.gradeId === grade.id)
      .sort((a, b) => b.hoursPerWeek - a.hoursPerWeek || a.id - b.id);
    const maxHours = Math.max(...gradeSubjects.map((item) => item.hoursPerWeek));

    for (let hour = 0; hour < maxHours; hour += 1) {
      for (const item of gradeSubjects) {
        if (item.hoursPerWeek <= hour) continue;
        const used = daysBySubjectGrade.get(item.id) ?? new Set<number>();
        const rotation = (item.id + hour * 2) % 5;
        const days = Array.from({ length: 5 }, (_, index) => (index + rotation) % 5);
        const orderedDays = [
          ...days.filter((day) => !used.has(day)),
          ...days.filter((day) => used.has(day)),
        ];
        const code = subjectCodeOf(item);
        const special = preferredRoom(code, grade.campusId);
        let placed = false;

        for (const day of orderedDays) {
          for (let offset = 0; offset < blocks.length && !placed; offset += 1) {
            const block = blocks[(item.id + day + offset) % blocks.length];
            if (!block) continue;
            const cell = `${day}-${block.id}`;
            if (groupCells.has(cell)) continue;
            if (!isFree(teacherBusy, item.teacherId, day, block.startTime, block.endTime)) continue;
            const roomId =
              special && isFree(roomBusy, special, day, block.startTime, block.endTime)
                ? special
                : (HOME_ROOM[grade.name] as number);
            if (!isFree(roomBusy, roomId, day, block.startTime, block.endTime)) continue;

            const slot = { day, start: block.startTime, end: block.endTime };
            markBusy(teacherBusy, item.teacherId, slot);
            markBusy(roomBusy, roomId, slot);
            groupCells.add(cell);
            used.add(day);
            daysBySubjectGrade.set(item.id, used);
            result.push({
              id: result.length + 1,
              subjectGradeId: item.id,
              classroomId: roomId,
              dayOfWeek: day as DayOfWeek,
              startTime: block.startTime,
              endTime: block.endTime,
              academicYear: ACADEMIC_YEAR,
              isActive: true,
            });
            placed = true;
          }
          if (placed) break;
        }
      }
    }
  }
  return result;
}

export const schedules: Schedule[] = generateSchedules();

/* ----------------------------- Enrollments ----------------------------- */

export const enrollments: StudentEnrollment[] = (() => {
  const result: StudentEnrollment[] = [];
  for (const student of students) {
    if (!student.gradeId || student.status === "graduado") continue;
    const name = studentName(student.id);
    for (const item of subjectGrades.filter((entry) => entry.gradeId === student.gradeId)) {
      if (student.status === "retirado" && subjectCodeOf(item) !== "MAT") continue;
      const code = subjectCodeOf(item);
      const cancelled = name === "Kevin Stiven Ortega Lozano" && code === "ART";
      result.push({
        id: result.length + 1,
        studentId: student.id,
        subjectGradeId: item.id,
        academicYear: ACADEMIC_YEAR,
        enrollmentDate: "2026-01-20",
        status: student.status === "retirado" ? "retirada" : cancelled ? "cancelada" : "activa",
        statusNote:
          student.status === "retirado"
            ? "Retiro voluntario del estudiante"
            : cancelled
              ? "Cancelada por cruce de horario con práctica deportiva"
              : undefined,
      });
    }
  }
  return result;
})();

/* ------------------------------- Grades -------------------------------- */

/** Overall "ability" overrides so the featured storylines stay deterministic. */
const ABILITY_OVERRIDE: Record<string, number> = {
  "Valentina Rojas Pineda": 4.75,
  "Mateo Ramírez Cruz": 2.95,
  "Sofía Castro Vega": 4.4,
  "Camila Fernanda Ruiz Mora": 4.1,
  "Samuel Torres Quintero": 3.4,
  "Isabella Gómez Herrera": 3.7,
  "Mariana López Sánchez": 3.9,
  "Santiago Duarte Mejía": 2.8,
};

/** Exact period finals for storyline students (subject code x period order 1-4). */
function targetScore(
  name: string,
  code: SubjectCode,
  order: number,
  subjectIndex: number,
): number | undefined {
  const pick = (values: readonly number[]) => values[order - 1];
  switch (name) {
    case "Valentina Rojas Pineda":
      return round(4.6 + ((subjectIndex * 7 + order * 3) % 5) * 0.1, 1);
    case "Santiago Duarte Mejía":
      if (code === "MAT") return pick([2.6, 2.4, 2.1, 2.3]);
      if (code === "CNA") return pick([2.9, 2.7, 2.7, 2.6]);
      if (code === "LEN") return pick([3.1, 2.9, 2.8, 2.7]);
      return order === 3
        ? round(3.1 + ((subjectIndex + order) % 3) * 0.1, 1)
        : round(2.6 + ((subjectIndex + order) % 6) * 0.1, 1);
    case "Mariana López Sánchez":
      return code === "LEN" ? pick([4.3, 4.2, 3.5, 3.4]) : undefined;
    case "Isabella Gómez Herrera":
      return code === "MAT" ? pick([2.9, 2.8, 4, 4.1]) : undefined;
    case "Samuel Torres Quintero":
      return code === "MAT" && order === 3 ? 2.3 : undefined;
    case "Alejandro Ramos Giraldo":
      return code === "MAT" && order === 3 ? 2.6 : undefined;
    case "Thiago Bermúdez Orozco":
      return code === "MAT" && order === 3 ? 2.8 : undefined;
    default:
      return undefined;
  }
}

/** Passing MAT finals for the rest of 6-02 in P3, so exactly three students fail (group at risk). */
function groupTarget(
  groupName: string | undefined,
  code: SubjectCode,
  order: number,
  studentId: number,
): number | undefined {
  if (groupName === "6-02" && code === "MAT" && order === 3) {
    return round(3.3 + (studentId % 4) * 0.2, 1);
  }
  return undefined;
}

/** MAT disparity between the two sixth-grade groups (drives the "Disparidad en MAT" suggestion). */
function groupSubjectDelta(groupName: string | undefined, code: SubjectCode): number {
  if (code !== "MAT") return 0;
  if (groupName === "6-01") return 0.35;
  if (groupName === "6-02") return -0.45;
  return 0;
}

const GRADE_NOTES = [
  "Entregó el taller incompleto",
  "Excelente participación",
  "Debe reforzar los conceptos de la unidad",
  "Muy buen trabajo en equipo",
];

export const gradeRecords: GradeRecord[] = [];
export const finalGrades: FinalGrade[] = [];

(() => {
  for (const student of students) {
    if (!student.gradeId || student.status !== "activo") continue;
    const name = studentName(student.id);
    const ability = ABILITY_OVERRIDE[name] ?? Math.min(4.9, Math.max(2, rng.normal(3.8, 0.55)));
    const groupName = gradeById.get(student.gradeId)?.name;
    const studentSubjectGrades = subjectGrades.filter((item) => item.gradeId === student.gradeId);

    for (const item of studentSubjectGrades) {
      const code = subjectCodeOf(item);
      const subjectIndex = (item.subjectId - 1) as number;
      const offset = rng.range(-0.4, 0.4);

      for (const period of periods) {
        const criterionIds = period.isActive
          ? ACTIVE_PERIOD_CRITERION_IDS
          : criteria.map((criterion) => criterion.id);
        const target =
          targetScore(name, code, period.order, subjectIndex) ??
          groupTarget(groupName, code, period.order, student.id);
        const base = target ?? ability + offset + groupSubjectDelta(groupName, code);
        const comboRecords: GradeRecord[] = [];

        for (const criterionId of criterionIds) {
          const noise = target === undefined ? rng.range(-0.3, 0.3) : rng.range(-0.1, 0.1);
          comboRecords.push({
            id: gradeRecords.length + comboRecords.length + 1,
            studentId: student.id,
            subjectGradeId: item.id,
            periodId: period.id,
            criterionId,
            score: round(clampScore(base + noise), 1),
            observation: rng.chance(0.02) ? rng.pick(GRADE_NOTES) : undefined,
            createdBy: item.teacherId,
            locked: !period.isActive,
          });
        }
        gradeRecords.push(...comboRecords);

        const final = finalScore(comboRecords, criteria);
        if (final !== null) {
          finalGrades.push({
            id: finalGrades.length + 1,
            studentId: student.id,
            subjectGradeId: item.id,
            periodId: period.id,
            finalScore: final,
            status: statusFromScore(final),
            calculatedAt: period.isActive ? REFERENCE_DATE : period.endDate,
          });
        }
      }
    }
  }
})();

/** Annual preview: mean of the closed periods (P1-P3) until P4 closes. */
export const annualGrades: AnnualGrade[] = (() => {
  const result: AnnualGrade[] = [];
  const closedIds = new Set(
    periods.filter((period) => !period.isActive).map((period) => period.id),
  );
  const groups = new Map<string, FinalGrade[]>();
  for (const final of finalGrades) {
    if (!closedIds.has(final.periodId)) continue;
    const key = `${final.studentId}-${final.subjectGradeId}`;
    groups.set(key, [...(groups.get(key) ?? []), final]);
  }
  for (const rows of groups.values()) {
    const first = rows[0];
    if (!first) continue;
    const score = annualScore(rows.map((row) => row.finalScore));
    result.push({
      id: result.length + 1,
      studentId: first.studentId,
      subjectGradeId: first.subjectGradeId,
      academicYear: ACADEMIC_YEAR,
      annualScore: score ?? 0,
      status: annualStatusFromScore(score),
    });
  }
  return result;
})();

/* ----------------------------- Attendance ------------------------------ */

const ATTENDANCE_WINDOW_START = "2026-09-07";
const ATTENDANCE_WINDOW_END = "2026-10-02";
/** Last-30-days window used by the absence alerts. */
export const ABSENCE_WINDOW_START = addDays(REFERENCE_DATE, -30);

const JUSTIFICATIONS = [
  "Cita médica",
  "Calamidad doméstica",
  "Incapacidad médica",
  "Diligencia familiar",
];

function randomStatus(): AttendanceStatus {
  const roll = rng.next();
  if (roll < 0.91) return "presente";
  if (roll < 0.96) return "ausente";
  if (roll < 0.99) return "justificado";
  return "excusado";
}

/** Students whose attendance is forced (perfect, or a fixed share of absences). */
const ABSENCE_TARGET: Record<string, number> = {
  "Valentina Rojas Pineda": 0,
  "Sofía Castro Vega": 0,
  "Samuel Torres Quintero": 0.28,
  "Mateo Ramírez Cruz": 0.22,
};

export const attendance: Attendance[] = (() => {
  const result: Attendance[] = [];
  const dates = dateRange(ATTENDANCE_WINDOW_START, ATTENDANCE_WINDOW_END);
  const sessionsBySubjectGrade = new Map<number, Schedule[]>();
  for (const schedule of schedules) {
    sessionsBySubjectGrade.set(schedule.subjectGradeId, [
      ...(sessionsBySubjectGrade.get(schedule.subjectGradeId) ?? []),
      schedule,
    ]);
  }

  for (const item of subjectGrades) {
    const classStudents = students.filter(
      (student) => student.gradeId === item.gradeId && student.status === "activo",
    );
    const slots = sessionsBySubjectGrade.get(item.id) ?? [];
    const sessionDates = dates
      .filter((date) => slots.some((slot) => slot.dayOfWeek === weekdayIndex(date)))
      .sort();
    for (const date of sessionDates) {
      for (const student of classStudents) {
        result.push({
          id: result.length + 1,
          studentId: student.id,
          subjectGradeId: item.id,
          date,
          status: randomStatus(),
          recordedBy: item.teacherId,
        });
      }
    }
  }

  // Pin the storyline students: exact absence share over the last 30 days, mixed statuses.
  for (const [name, target] of Object.entries(ABSENCE_TARGET)) {
    const student = students.find((entry) => studentName(entry.id) === name);
    if (!student) continue;
    const rows = result
      .filter((row) => row.studentId === student.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.subjectGradeId - b.subjectGradeId);
    rows.forEach((row, index) => {
      const marked = Math.floor((index + 1) * target) > Math.floor(index * target);
      row.status = !marked ? "presente" : index % 3 === 2 ? "justificado" : "ausente";
      row.observation = row.status === "justificado" ? rng.pick(JUSTIFICATIONS) : undefined;
    });
  }

  for (const row of result) {
    if (row.status === "justificado" && !row.observation) {
      row.observation = rng.pick(JUSTIFICATIONS);
    }
  }
  return result;
})();

export function teacherName(teacherId: number): string {
  const user = userById.get(teacherId);
  return user ? `${user.firstName} ${user.lastName}` : "Profesor";
}

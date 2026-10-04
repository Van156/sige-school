import { attendance, gradeRecords } from "./academics";
import { criteriaStore } from "./admin";
import { REFERENCE_DATE } from "./dates";
import { average, finalScore, performanceLevel } from "./helpers";
import { reportCardObservations, reportCards } from "./records";
import { studentStore, subjectGradeStore } from "./school";
import { createMockCollection } from "./store";
import type {
  AttendanceStatus,
  DeliveryStatus,
  GradeRecord,
  PerformanceLevel,
  ReportCard,
} from "./types";

/**
 * Editable grading, attendance and report-card stores (T4). They start as copies of the static
 * records of `academics.ts` / `records.ts`; the GRD, ATT and RPT screens read and write these, so
 * edits live until the page reloads. Final and annual grades are not stored: screens derive them
 * from the criterion records with the same rules as the seed (inventory 2.3).
 */

export const gradeRecordStore = createMockCollection(gradeRecords);
export const attendanceStore = createMockCollection(attendance);
export const reportCardStore = createMockCollection(reportCards);
export const reportCardObservationStore = createMockCollection(reportCardObservations);

/* ------------------------------ Period locks ------------------------------ */

/** Lock of one subject-grade in one period (legacy: a flag on every grade record). */
export interface PeriodLock {
  id: number;
  subjectGradeId: number;
  periodId: number;
  locked: boolean;
}

function seedLocks(): PeriodLock[] {
  const state = new Map<string, PeriodLock>();
  for (const record of gradeRecords) {
    const key = `${record.subjectGradeId}-${record.periodId}`;
    const lock = state.get(key);
    if (lock) {
      lock.locked = lock.locked && record.locked;
    } else {
      state.set(key, {
        id: state.size + 1,
        subjectGradeId: record.subjectGradeId,
        periodId: record.periodId,
        locked: record.locked,
      });
    }
  }
  return [...state.values()];
}

export const periodLockStore = createMockCollection<PeriodLock>(seedLocks());

export function setPeriodLock(subjectGradeId: number, periodId: number, locked: boolean) {
  const existing = periodLockStore
    .getSnapshot()
    .find((lock) => lock.subjectGradeId === subjectGradeId && lock.periodId === periodId);
  if (existing) {
    periodLockStore.update(existing.id, { locked });
  } else {
    periodLockStore.add({ subjectGradeId, periodId, locked });
  }
}

/* ------------------------------ Grade records ----------------------------- */

export interface GradeCell {
  studentId: number;
  criterionId: number;
  /** `null` clears the cell (the record is removed). */
  score: number | null;
  observation?: string;
}

/** Upserts the given cells of one subject-grade and period; cells outside `cells` stay as they are. */
export function saveGradeCells(input: {
  subjectGradeId: number;
  periodId: number;
  cells: readonly GradeCell[];
  userId: number;
}) {
  const { subjectGradeId, periodId, cells, userId } = input;
  const key = (studentId: number, criterionId: number) => `${studentId}-${criterionId}`;
  const incoming = new Map(cells.map((cell) => [key(cell.studentId, cell.criterionId), cell]));
  const current = gradeRecordStore.getSnapshot();
  let nextId = current.reduce((max, record) => Math.max(max, record.id), 0) + 1;
  const handled = new Set<string>();
  const next: GradeRecord[] = [];

  for (const record of current) {
    const cellKey = key(record.studentId, record.criterionId);
    const cell =
      record.subjectGradeId === subjectGradeId && record.periodId === periodId
        ? incoming.get(cellKey)
        : undefined;
    if (!cell) {
      next.push(record);
      continue;
    }
    handled.add(cellKey);
    if (cell.score === null) continue;
    next.push({ ...record, score: cell.score, observation: cell.observation, createdBy: userId });
  }

  for (const cell of cells) {
    const cellKey = key(cell.studentId, cell.criterionId);
    if (handled.has(cellKey) || cell.score === null) continue;
    next.push({
      id: nextId,
      studentId: cell.studentId,
      subjectGradeId,
      periodId,
      criterionId: cell.criterionId,
      score: cell.score,
      observation: cell.observation,
      createdBy: userId,
      locked: false,
    });
    nextId += 1;
  }
  gradeRecordStore.replace(next);
}

/* ------------------------------- Attendance ------------------------------- */

export interface AttendanceEntry {
  studentId: number;
  status: AttendanceStatus;
  observation?: string;
}

/** One `Attendance` per student, subject-grade and date: existing rows are updated, new ones added. */
export function saveAttendance(input: {
  subjectGradeId: number;
  date: string;
  entries: readonly AttendanceEntry[];
  recordedBy: number;
}) {
  const { subjectGradeId, date, entries, recordedBy } = input;
  const incoming = new Map(entries.map((entry) => [entry.studentId, entry]));
  const current = attendanceStore.getSnapshot();
  let nextId = current.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  const handled = new Set<number>();

  const next = current.map((row) => {
    const entry =
      row.subjectGradeId === subjectGradeId && row.date === date
        ? incoming.get(row.studentId)
        : undefined;
    if (!entry) return row;
    handled.add(row.studentId);
    return { ...row, status: entry.status, observation: entry.observation, recordedBy };
  });
  for (const entry of entries) {
    if (handled.has(entry.studentId)) continue;
    next.push({
      id: nextId,
      studentId: entry.studentId,
      subjectGradeId,
      date,
      status: entry.status,
      observation: entry.observation,
      recordedBy,
    });
    nextId += 1;
  }
  attendanceStore.replace(next);
}

/* ------------------------------- Report cards ------------------------------ */

export type GenerateResult =
  | { ok: true; card: ReportCard; regenerated: boolean }
  | { ok: false; reason: string };

const GENERATED_AT = `${REFERENCE_DATE}T09:30`;

const GENERAL_REMARK: Record<PerformanceLevel, string> = {
  Superior: "Excelente desempeño académico y actitud ejemplar durante el periodo.",
  Alto: "Buen desempeño general; se invita a mantener el ritmo de trabajo.",
  Básico: "Cumple con los logros mínimos; debe fortalecer el estudio autónomo.",
  Bajo: "Requiere un plan de refuerzo y acompañamiento de la familia.",
};

/** Builds (or rebuilds) the report card of a student for a period from the grade records. */
export function generateReportCard(input: {
  studentId: number;
  periodId: number;
  generatedBy: number;
}): GenerateResult {
  const { studentId, periodId, generatedBy } = input;
  const student = studentStore.getSnapshot().find((entry) => entry.id === studentId);
  if (!student?.gradeId) return { ok: false, reason: "El estudiante no tiene un grado asignado." };

  const classes = subjectGradeStore
    .getSnapshot()
    .filter((item) => item.gradeId === student.gradeId);
  if (classes.length === 0) {
    return { ok: false, reason: "No hay asignaturas configuradas para este grado." };
  }

  const criteria = criteriaStore.getSnapshot();
  const records = gradeRecordStore.getSnapshot();
  const finals = classes.flatMap((item) => {
    const own = records.filter(
      (record) =>
        record.studentId === studentId &&
        record.subjectGradeId === item.id &&
        record.periodId === periodId,
    );
    const score = finalScore(own, criteria);
    return score === null ? [] : [{ subjectGradeId: item.id, score }];
  });
  if (finals.length === 0) {
    return {
      ok: false,
      reason: "No hay calificaciones registradas para este estudiante en este periodo.",
    };
  }

  const mean = average(finals.map((final) => final.score)) ?? 3;
  const existing = reportCardStore
    .getSnapshot()
    .find((card) => card.studentId === studentId && card.periodId === periodId);

  if (existing) reportCardStore.update(existing.id, { generatedAt: GENERATED_AT, generatedBy });
  const card: ReportCard =
    existing ??
    reportCardStore.add({
      studentId,
      periodId,
      generatedAt: GENERATED_AT,
      pdfPath: "/samples/boletin-ejemplo.pdf",
      generalObservation: GENERAL_REMARK[performanceLevel(mean)],
      generatedBy,
      deliveryStatus: "pendiente",
    });

  // Subject comments follow the grades: refresh the ones of this card.
  reportCardObservationStore
    .getSnapshot()
    .filter((comment) => comment.reportCardId === card.id)
    .forEach((comment) => reportCardObservationStore.remove(comment.id));
  for (const final of finals.filter((entry) => entry.score >= 4.6 || entry.score < 3).slice(0, 4)) {
    reportCardObservationStore.add({
      reportCardId: card.id,
      subjectGradeId: final.subjectGradeId,
      observation:
        final.score >= 4.6
          ? "Desempeño sobresaliente; participa y entrega con calidad."
          : "Debe reforzar los conceptos trabajados en el periodo.",
    });
  }
  return { ok: true, card, regenerated: Boolean(existing) };
}

export interface BulkReportEntry {
  studentId: number;
  outcome: "generado" | "omitido" | "error";
  reason?: string;
}

/** Generates the report card of every active student of a course. */
export function generateReportCards(input: {
  gradeId: number;
  periodId: number;
  generatedBy: number;
}): BulkReportEntry[] {
  return studentStore
    .getSnapshot()
    .filter((student) => student.gradeId === input.gradeId && student.status === "activo")
    .map((student): BulkReportEntry => {
      const result = generateReportCard({
        studentId: student.id,
        periodId: input.periodId,
        generatedBy: input.generatedBy,
      });
      if (result.ok) return { studentId: student.id, outcome: "generado" };
      const skipped = result.reason.startsWith("No hay calificaciones");
      return {
        studentId: student.id,
        outcome: skipped ? "omitido" : "error",
        reason: result.reason,
      };
    });
}

export function setReportDelivery(input: {
  cardId: number;
  status: DeliveryStatus;
  generalObservation?: string;
}) {
  reportCardStore.update(input.cardId, {
    deliveryStatus: input.status,
    deliveryDate: input.status === "entregado" ? REFERENCE_DATE : undefined,
    generalObservation: input.generalObservation,
  });
}

export function deleteReportCard(cardId: number) {
  reportCardObservationStore
    .getSnapshot()
    .filter((comment) => comment.reportCardId === cardId)
    .forEach((comment) => reportCardObservationStore.remove(comment.id));
  reportCardStore.remove(cardId);
}

import { achievements } from "./base";
import { REFERENCE_DATE, timesOverlap, weekdayIndex } from "./dates";
import { userStore } from "./admin";
import { createRng } from "./prng";
import { qrAccessLogs, qrTokens, observations, alerts, studentAchievements } from "./records";
import {
  classroomStore,
  enrollmentStore,
  scheduleStore,
  studentStore,
  subjectGradeStore,
} from "./school";
import { createMockCollection } from "./store";
import type { Alert, Observation, QRAccessLog, QRLogStatus, QRToken, Role, User } from "./types";
import { fullName } from "./people";

/**
 * Editable copies of the observation, alert, achievement and QR collections (T5). Like the earlier
 * stores they start as the seeded static arrays and live until the page reloads; the OBS, ALR, ACH,
 * PAR and QR screens read and write these.
 */

export const observationStore = createMockCollection<Observation>(observations);
export const alertStore = createMockCollection<Alert>(alerts);
export const achievementStore = createMockCollection(achievements);
export const studentAchievementStore = createMockCollection(studentAchievements);
export const qrTokenStore = createMockCollection<QRToken>(qrTokens);
export const qrAccessLogStore = createMockCollection<QRAccessLog>(qrAccessLogs);

/* ------------------------------- Observations ------------------------------ */

/** Manual "marcar como notificada": no real messaging, only the flag flips (inventory 3.9). */
export function markObservationNotified(id: number) {
  observationStore.update(id, { notified: true });
}

/* --------------------------------- Alerts --------------------------------- */

export function resolveAlert(input: { id: number; resolvedBy: number; notes?: string }) {
  alertStore.update(input.id, {
    resolved: true,
    resolvedAt: `${REFERENCE_DATE}T12:00`,
    resolvedBy: input.resolvedBy,
    notes: input.notes?.trim() || undefined,
  });
}

/* ----------------------------------- QR ----------------------------------- */

const tokenRng = createRng(7_281_994);

/** UUID v4 shaped token; deterministic sequence so reloads replay the same codes. */
function nextToken(): string {
  const hex = (length: number) =>
    Array.from({ length }, () => tokenRng.int(0, 15).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${tokenRng.pick(["8", "9", "a", "b"])}${hex(3)}-${hex(12)}`;
}

/** Replaces the active token of a user (the previous one stops working immediately). */
export function regenerateQrToken(userId: number): QRToken {
  const current = qrTokenStore.getSnapshot().find((token) => token.userId === userId);
  const token = nextToken();
  if (current) {
    qrTokenStore.update(current.id, { token, isActive: true, createdAt: REFERENCE_DATE });
    return { ...current, token, isActive: true, createdAt: REFERENCE_DATE };
  }
  return qrTokenStore.add({ userId, token, isActive: true, createdAt: REFERENCE_DATE });
}

export interface QrScanInput {
  classroomId: number | undefined;
  token: string;
  /** `HH:MM` of the simulated scan; the date is always the reference Monday. */
  time: string;
}

export interface QrScanResult {
  status: QRLogStatus;
  message: string;
  userName?: string;
}

const STAFF_ROLES: readonly Role[] = ["root", "admin", "coordinator"];

function logScan(entry: Omit<QRAccessLog, "id" | "ipAddress" | "timestamp">, input: QrScanInput) {
  qrAccessLogStore.add({
    ...entry,
    timestamp: `${REFERENCE_DATE}T${input.time}`,
    ipAddress: "SIM-127.0.0.1",
  });
}

/**
 * Hardware simulator (QR-02): validates the token against the room and the weekly schedule and
 * logs the attempt. Staff enter anywhere; teachers need the class taught in that room at that
 * time, students an active enrollment in it (inventory 3.15).
 */
export function simulateQrScan(input: QrScanInput): QrScanResult {
  const classroom = classroomStore.getSnapshot().find((room) => room.id === input.classroomId);
  const tokenRow = qrTokenStore
    .getSnapshot()
    .find((row) => row.token === input.token.trim() && row.isActive);
  const user: User | undefined = tokenRow
    ? userStore.getSnapshot().find((entry) => entry.id === tokenRow.userId)
    : undefined;

  const finish = (
    status: QRLogStatus,
    message: string,
    withUser: User | undefined,
  ): QrScanResult => {
    logScan({ userId: withUser?.id, classroomId: classroom?.id, status, message }, input);
    return { status, message, userName: withUser ? fullName(withUser) : undefined };
  };

  if (!tokenRow || !user) return finish("invalid_token", "Token inválido o inactivo", undefined);
  if (!classroom) return finish("denied", "Ubicación no reconocida", user);

  if (STAFF_ROLES.includes(user.role)) {
    qrTokenStore.update(tokenRow.id, { lastUsedAt: `${REFERENCE_DATE}T${input.time}` });
    return finish("authorized", "Acceso autorizado (personal directivo)", user);
  }
  if (user.role !== "teacher" && user.role !== "student") {
    return finish("denied", "Su rol no tiene acceso a salones", user);
  }

  const day = weekdayIndex(REFERENCE_DATE);
  const nextTime = `${input.time.slice(0, 2)}:${String(Math.min(59, Number(input.time.slice(3)) + 1)).padStart(2, "0")}`;
  const subjectGrades = subjectGradeStore.getSnapshot();
  const student = studentStore.getSnapshot().find((entry) => entry.userId === user.id);
  const enrolled = new Set(
    enrollmentStore
      .getSnapshot()
      .filter((row) => row.studentId === student?.id && row.status === "activa")
      .map((row) => row.subjectGradeId),
  );
  const allowed = scheduleStore.getSnapshot().some((row) => {
    if (row.classroomId !== classroom.id || row.dayOfWeek !== day || !row.isActive) return false;
    if (!timesOverlap(row.startTime, row.endTime, input.time, nextTime)) return false;
    return user.role === "teacher"
      ? subjectGrades.some((item) => item.id === row.subjectGradeId && item.teacherId === user.id)
      : enrolled.has(row.subjectGradeId);
  });

  if (!allowed) return finish("wrong_schedule", "Fuera de horario de clase", user);
  qrTokenStore.update(tokenRow.id, { lastUsedAt: `${REFERENCE_DATE}T${input.time}` });
  return finish("authorized", "Acceso autorizado", user);
}

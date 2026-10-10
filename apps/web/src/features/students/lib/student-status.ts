import { STUDENT_STATUSES } from "@base-template/sige-core";

import type { StudentStatus } from "../types";

/** Badge text of each student status (sige/05 §5.1, §5.6). */
export const STUDENT_STATUS_LABELS: Readonly<Record<StudentStatus, string>> = {
  activo: "Activo",
  retirado: "Retirado",
  graduado: "Graduado",
};

/** Badge colour of each status (sige/05 §5.6): "Activo" success, "Retirado" secondary, "Graduado" info. */
export const STUDENT_STATUS_VARIANTS = {
  activo: "success",
  retirado: "secondary",
  graduado: "info",
} as const satisfies Record<StudentStatus, string>;

/** Whether `value` is one of the `student_status` enum values. */
export function isStudentStatus(value: unknown): value is StudentStatus {
  return (STUDENT_STATUSES as readonly unknown[]).includes(value);
}

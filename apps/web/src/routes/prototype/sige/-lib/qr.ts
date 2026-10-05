import type { QRLogStatus } from "../-mock/types";
import type { BadgeTone } from "./roles";

/** Personal-activity labels (QR-01) and monitoring labels (QR-03) of an access attempt. */
export const QR_STATUS_LABEL: Record<QRLogStatus, string> = {
  authorized: "Autorizado",
  wrong_schedule: "Fuera de Horario",
  denied: "Denegado",
  invalid_token: "Denegado",
};

export const QR_MONITOR_LABEL: Record<QRLogStatus, string> = {
  authorized: "ÉXITO",
  wrong_schedule: "HORARIO",
  denied: "ERROR",
  invalid_token: "ERROR",
};

export const QR_STATUS_TONE: Record<QRLogStatus, BadgeTone> = {
  authorized: "success",
  wrong_schedule: "warning",
  denied: "destructive",
  invalid_token: "destructive",
};

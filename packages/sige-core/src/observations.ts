/**
 * Observation rules of sige/08 §3, shared by the `observation.*` procedures, the web, the seed,
 * the "Compañero" achievement and the dashboards (R3.18, OBS-R10). Pure data and predicates: the
 * notification flag is stored (generated) in the database and only read here.
 */
import { SIGE_RULES } from "./rules";

/** DB enum `observation_type` (08 §2), in the order the OBS-03/OBS-04 forms offer them. */
export const OBSERVATION_TYPE_CODES = [
  "positiva",
  "negativa",
  "seguimiento",
  "convivencia",
] as const;
export type ObservationType = (typeof OBSERVATION_TYPE_CODES)[number];

export type ObservationTypeInfo = {
  code: ObservationType;
  /** Badge and option text. */
  label: string;
  /** Emoji of the option and of the timeline pill. */
  glyph: string;
  tone: "success" | "destructive" | "info" | "warning";
  /** OBS-04 side card "Tipos de Observación" (08 §3, verbatim). */
  hint: string;
};

/** Label, glyph, tone and hint of each type (08 §3): green, red, blue, amber. */
export const OBSERVATION_TYPES: readonly ObservationTypeInfo[] = [
  {
    code: "positiva",
    label: "Positiva",
    glyph: "👍",
    tone: "success",
    hint: "Reconocimiento de buen comportamiento o logro",
  },
  {
    code: "negativa",
    label: "Negativa",
    glyph: "⚠️",
    tone: "destructive",
    hint: "Comportamiento inadecuado o falta grave",
  },
  {
    code: "seguimiento",
    label: "Seguimiento",
    glyph: "📋",
    tone: "info",
    hint: "Monitoreo de progreso o situación",
  },
  {
    code: "convivencia",
    label: "Convivencia",
    glyph: "🤝",
    tone: "warning",
    hint: "Aspectos relacionados con la convivencia escolar",
  },
];

/** The seven values `observation.category` admits (08 §3); anything else is refused. */
export const OBSERVATION_CATEGORIES = [
  "Disciplina",
  "Rendimiento",
  "Valores",
  "Convivencia",
  "Responsabilidad",
  "Participación",
  "Otro",
] as const;
export type ObservationCategory = (typeof OBSERVATION_CATEGORIES)[number];

/** OBS-04 offers the first six of §3, so the quick form never shows "Otro" (prototype). */
export const OBSERVATION_QUICK_CATEGORIES: readonly ObservationCategory[] =
  OBSERVATION_CATEGORIES.slice(0, 6);

/**
 * Verbatim OBS-R2…R6 messages (08 §5) for the zod schemas, the services and the web.
 * `invalidCategory` is authored (OBS-R2 states the rule without a message) and `invalidDate`
 * repeats the ATT-R3 wording, which the spec gives for `observedOn` only as a shape rule.
 */
export const observationMessages = {
  /** OBS-R2 per-field issues. */
  studentRequired: "Debes seleccionar un estudiante.",
  typeRequired: "Debes seleccionar un tipo.",
  /** OBS-04 radio tiles. */
  quickTypeRequired: "Selecciona el tipo de observación.",
  descriptionRequired: "La descripción es obligatoria.",
  descriptionTooLong: `La descripción no puede superar ${SIGE_RULES.OBSERVATION_DESCRIPTION_MAX} caracteres.`,
  commitmentsTooLong: `Los compromisos no pueden superar ${SIGE_RULES.OBSERVATION_COMMITMENTS_MAX} caracteres.`,
  invalidCategory: "Categoría inválida.",
  invalidDate: "Fecha inválida",
  /** OBS-R2 (R2.10): only `activo` students receive observations. */
  studentNotActive: "El estudiante no está activo.",
  /** OBS-R3. */
  futureDate: "No se puede registrar una observación con fecha futura.",
  /** OBS-R1 out-of-scope student or observation. */
  studentNotFound: "Estudiante no encontrado.",
  notFound: "Observación no encontrada.",
  /** OBS-R4 `markNotified` on a type that needs no notification. */
  notificationNotRequired: "Esta observación no requiere notificación.",
  /** OBS-R5: the row is visible, so this is `FORBIDDEN`, not `NOT_FOUND`. */
  onlyAuthorCanEdit: "Solo el autor puede editar esta observación.",
  /** OBS-R5 (no final period in the prototype copy). */
  studentImmutable: "No se puede cambiar el estudiante de una observación existente",
  /** OBS-R4 creation toast; the notice line only for negativa and convivencia (OQ-OBS-2). */
  createdToastTitle: "Observación creada exitosamente",
  createdToastNotice: "El director de grupo será notificado.",
  updatedToast: "Observación actualizada",
  deletedToast: "Observación eliminada",
  notifiedToast: "Observación marcada como notificada",
} as const;

/** OBS-R4: negative and convivencia observations must reach the guardians. */
export function requiresNotification(type: ObservationType): boolean {
  return type === "negativa" || type === "convivencia";
}

/** OBS-R8 "Pendientes": requires notification and has not been notified yet. */
export function isPending(observation: { type: ObservationType; notified: boolean }): boolean {
  return requiresNotification(observation.type) && !observation.notified;
}

export type ObservationCounts = {
  total: number;
  positiva: number;
  negativa: number;
  seguimiento: number;
  convivencia: number;
  /** Every notified row, whatever its type (a notified `negativa` turned `positiva` keeps it). */
  notified: number;
  pending: number;
};

/** OBS-01 and OBS-05 tiles over the caller's scope (08 §3, OBS-R8). */
export function countObservations(
  rows: readonly { type: ObservationType; notified: boolean }[],
): ObservationCounts {
  const counts: ObservationCounts = {
    total: rows.length,
    positiva: 0,
    negativa: 0,
    seguimiento: 0,
    convivencia: 0,
    notified: 0,
    pending: 0,
  };
  for (const row of rows) {
    counts[row.type] += 1;
    if (row.notified) counts.notified += 1;
    if (isPending(row)) counts.pending += 1;
  }
  return counts;
}

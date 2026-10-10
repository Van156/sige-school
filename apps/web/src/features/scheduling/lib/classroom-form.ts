import { classroomInput } from "@base-template/api/sige/schemas/scheduling";
import { z } from "zod";

import type { ClassroomRow } from "../types";

const DEFAULT_CAPACITY = "40";
const DEFAULT_FLOOR = "1";

/** Blank number inputs fall back to the API default (it applies when the value is `undefined`). */
const numberText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : Number(value)));

type ApiInput = z.input<typeof classroomInput>;

/**
 * What the "Recursos (JSON)" textarea turns into before the API rule runs: blank = no resources,
 * a JSON value as parsed, and text that is not JSON stays a string. The cast is deliberate: the
 * API's object rule then rejects it (as it does arrays and scalars) with "El formato JSON no es
 * válido.", so that message lives in one place.
 */
export function parseResourcesText(text: string): ApiInput["resources"] {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  try {
    return JSON.parse(trimmed) as ApiInput["resources"];
  } catch {
    return trimmed as unknown as ApiInput["resources"];
  }
}

/** The textarea text of stored resources: pretty JSON, blank when there are none. */
export function resourcesToText(resources: ClassroomRow["resources"]): string {
  return resources === null ? "" : JSON.stringify(resources, null, 2);
}

/**
 * SCH-08 form rules. Every control holds a string; the text is shaped (blank numbers use the API
 * defaults, the JSON text is parsed) and then piped into the API's own `classroomInput`, so each
 * rule and message (sige/04 §4.1) lives in one place.
 */
export const classroomFormSchema = z
  .object({
    campusId: z.string(),
    name: z.string(),
    code: z.string(),
    capacity: numberText,
    floor: numberText,
    classroomType: z.string(),
    building: z.string(),
    resources: z.string(),
  })
  .transform((values): ApiInput => ({
    ...values,
    // Raw select text: the API's enum rule reports an unchosen type.
    classroomType: values.classroomType as ApiInput["classroomType"],
    resources: parseResourcesText(values.resources),
  }))
  .pipe(classroomInput);

/** Form state: every control holds a string; the selects hold an id/value or "". */
export type ClassroomFormValues = z.input<typeof classroomFormSchema>;

/** The validated form: the shape `classroom.create` and `classroom.update` take (full replace). */
export type ClassroomInput = z.output<typeof classroomFormSchema>;

/** SCH-08 defaults: capacity 40, floor 1, "Aula". */
export const emptyClassroomForm: ClassroomFormValues = {
  campusId: "",
  name: "",
  code: "",
  capacity: DEFAULT_CAPACITY,
  floor: DEFAULT_FLOOR,
  classroomType: "aula",
  building: "",
  resources: "",
};

/** Names of the fields the classroom form renders. */
export const CLASSROOM_FIELDS = [
  "campusId",
  "name",
  "code",
  "capacity",
  "classroomType",
  "building",
  "floor",
  "resources",
] as const;

export function classroomToFormValues(room: ClassroomRow): ClassroomFormValues {
  return {
    campusId: room.campusId,
    name: room.name,
    code: room.code,
    capacity: String(room.capacity),
    floor: String(room.floor),
    classroomType: room.classroomType,
    building: room.building ?? "",
    resources: resourcesToText(room.resources),
  };
}

export function toClassroomInput(values: ClassroomFormValues): ClassroomInput {
  return classroomFormSchema.parse(values);
}

export const CLASSROOM_SAVE_FALLBACK = "No se pudo guardar el salón. Intente nuevamente.";

/**
 * Server messages that belong under a specific classroom field (sige/04 §4.1). The campus message
 * of a classroom with slots is authored by the API (the campus is locked once classes exist).
 */
export const CLASSROOM_FIELD_BY_MESSAGE: Readonly<Record<string, keyof ClassroomFormValues>> = {
  "Ya existe un salón con este código en la sede.": "code",
  "La sede no existe.": "campusId",
  "La sede seleccionada no está activa.": "campusId",
  "No se puede cambiar la sede de un salón con clases programadas.": "campusId",
};

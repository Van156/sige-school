import { timeBlockInput } from "@base-template/api/sige/schemas/scheduling";
import { z } from "zod";

import type { TimeBlockRow, TimeBlockShift } from "../types";

/** Blank or non-numeric text becomes `NaN`, which the API's order rule rejects with its message. */
const orderText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? Number.NaN : Number(value)));

/**
 * SCH-10 form rules. Every control holds a string (the order is parsed) and the shaped values are
 * piped into the API's own `timeBlockInput`, so required fields, `start < end` and the other
 * messages (sige/04 §4.1) live in one place.
 */
export const timeBlockFormSchema = z
  .object({
    campusId: z.string(),
    name: z.string(),
    shift: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    orderNum: orderText,
    isBreak: z.boolean(),
  })
  .transform((values): z.input<typeof timeBlockInput> => ({
    ...values,
    // Raw select text: the API's enum rule reports an unchosen jornada.
    shift: values.shift as z.input<typeof timeBlockInput>["shift"],
  }))
  .pipe(timeBlockInput);

/** Form state: text controls hold strings, the break switch a boolean. */
export type TimeBlockFormValues = z.input<typeof timeBlockFormSchema>;

/** The validated form: the shape `timeBlock.create` and `timeBlock.update` take (full replace). */
export type TimeBlockInput = z.output<typeof timeBlockFormSchema>;

/** SCH-10 defaults (sige/04 §5.2): "Mañana", 07:00–08:00, a class block; `orderNum` is the next free. */
export function emptyTimeBlockForm(orderNum = 1): TimeBlockFormValues {
  return {
    campusId: "",
    name: "",
    shift: "Mañana",
    startTime: "07:00",
    endTime: "08:00",
    orderNum: String(orderNum),
    isBreak: false,
  };
}

/** Names of the fields the time block form renders. */
export const TIME_BLOCK_FIELDS = [
  "campusId",
  "name",
  "shift",
  "startTime",
  "endTime",
  "orderNum",
  "isBreak",
] as const;

export function timeBlockToFormValues(block: TimeBlockRow): TimeBlockFormValues {
  return {
    campusId: block.campusId,
    name: block.name,
    shift: block.shift,
    startTime: block.startTime,
    endTime: block.endTime,
    orderNum: String(block.orderNum),
    isBreak: block.isBreak,
  };
}

export function toTimeBlockInput(values: TimeBlockFormValues): TimeBlockInput {
  return timeBlockFormSchema.parse(values);
}

export const TIME_BLOCK_SAVE_FALLBACK = "No se pudo guardar el bloque. Intente nuevamente.";

/**
 * Server messages that belong under a specific field (sige/04 §4.1). The overlap message names the
 * clashing block and the in-use message covers the campus, jornada and times together, so those
 * two stay on the form as a whole.
 */
export const TIME_BLOCK_FIELD_BY_MESSAGE: Readonly<Record<string, keyof TimeBlockFormValues>> = {
  "Ya existe un bloque con este nombre en la sede y jornada.": "name",
  "La sede no existe.": "campusId",
  "La sede seleccionada no está activa.": "campusId",
};

/**
 * The default "Orden" of a new block: one past the highest order already used in the same campus
 * and jornada (1 when none, or while the campus is not chosen yet).
 */
export function nextOrderNum(
  blocks: readonly Pick<TimeBlockRow, "campusId" | "shift" | "orderNum">[],
  campusId: string,
  shift: TimeBlockShift | string,
): number {
  const used = blocks
    .filter((block) => block.campusId === campusId && block.shift === shift)
    .map((block) => block.orderNum);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

/** One row of the "Ejemplo de bloques típicos" help (sige/04 §5.2). */
export type ExampleBlock = {
  orderNum: number;
  name: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
};

export const EXAMPLE_BLOCKS: readonly ExampleBlock[] = [
  { orderNum: 1, name: "Bloque 1", startTime: "07:00", endTime: "08:00", isBreak: false },
  { orderNum: 2, name: "Bloque 2", startTime: "08:00", endTime: "09:00", isBreak: false },
  { orderNum: 3, name: "Recreo", startTime: "09:00", endTime: "09:30", isBreak: true },
  { orderNum: 4, name: "Bloque 3", startTime: "09:30", endTime: "10:30", isBreak: false },
  { orderNum: 5, name: "Bloque 4", startTime: "10:30", endTime: "11:30", isBreak: false },
  { orderNum: 6, name: "Almuerzo", startTime: "11:30", endTime: "12:30", isBreak: true },
  { orderNum: 7, name: "Bloque 5", startTime: "12:30", endTime: "13:30", isBreak: false },
  { orderNum: 8, name: "Bloque 6", startTime: "13:30", endTime: "14:30", isBreak: false },
];

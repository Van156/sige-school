import { periodInput } from "@base-template/api/sige/schemas/institution";
import { z } from "zod";

import { mapSubmitError, type SubmitFailure } from "./server-form-error";
import type { PeriodRow } from "../types";

/**
 * INS-16 form rules. Stage one holds what the controls produce (strings, plus the switch); the
 * order text becomes a number and the API's own fragment then validates it, so the client shows
 * the server's messages (blank order reads as 0 and fails the "desde 1" rule).
 */
export const periodFormSchema = z
  .object({
    academicYear: z.string(),
    orderNum: z
      .string()
      .trim()
      .transform((value) => Number(value)),
    name: z.string(),
    shortName: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    isActive: z.boolean().optional(),
  })
  .pipe(periodInput);

/** Form state: every control holds a string, the switch a boolean. */
export type PeriodFormValues = z.input<typeof periodFormSchema>;

/** The validated form: the shape `period.create` / `period.update` take. */
export type PeriodInput = z.output<typeof periodFormSchema>;

/** INS-16 defaults: the institution's year, order 1, the first period starts active (INS-R5). */
export function emptyPeriodForm(academicYear: string, isFirstPeriod: boolean): PeriodFormValues {
  return {
    academicYear,
    orderNum: "1",
    name: "",
    shortName: "",
    startDate: "",
    endDate: "",
    isActive: isFirstPeriod,
  };
}

/** Names of the fields the period form renders. */
export const PERIOD_FIELDS = [
  "name",
  "shortName",
  "startDate",
  "endDate",
  "academicYear",
  "orderNum",
  "isActive",
] as const;

export function periodToFormValues(period: PeriodRow): PeriodFormValues {
  return {
    academicYear: period.academicYear,
    orderNum: String(period.orderNum),
    name: period.name,
    shortName: period.shortName,
    startDate: period.startDate,
    endDate: period.endDate,
    isActive: period.isActive,
  };
}

export function toPeriodInput(values: PeriodFormValues): PeriodInput {
  return periodFormSchema.parse(values);
}

/**
 * How a validated form is saved. `create` / `update` with `isActive: true` while another period is
 * active is a CONFLICT by design, so the write always goes out inactive (or, for an already-active
 * period, as it is) and turning the switch on is a separate `period.activate` call (INS-R5).
 */
export type PeriodSavePlan = {
  /** Payload of `period.create` / `period.update`. */
  input: PeriodInput;
  /** Whether `period.activate` must run once the write succeeds. */
  activateAfter: boolean;
};

export function planPeriodSave(input: PeriodInput, wasActive: boolean): PeriodSavePlan {
  const activateAfter = input.isActive && !wasActive;
  return { input: activateAfter ? { ...input, isActive: false } : input, activateAfter };
}

/** Result of a save whose write succeeded: `activated` is false when only the activation failed. */
export type PeriodSaveOutcome = { id: string; activated: boolean };

/**
 * Runs the write and then, when the plan asks for it, the activation. A failing write rejects
 * (nothing was saved); a failing activation does not, because the period already exists and a
 * resubmit from the create form would duplicate it — the outcome reports it instead.
 */
export async function runPeriodSave(
  plan: PeriodSavePlan,
  steps: {
    write: (input: PeriodInput) => Promise<{ id: string }>;
    activate: (id: string) => Promise<unknown>;
  },
): Promise<PeriodSaveOutcome> {
  const { id } = await steps.write(plan.input);
  if (!plan.activateAfter) {
    return { id, activated: true };
  }
  try {
    await steps.activate(id);
    return { id, activated: true };
  } catch {
    return { id, activated: false };
  }
}

export const PERIOD_ACTIVATION_FAILED_MESSAGE =
  "El periodo se guardó, pero no se pudo activar. Intenta activarlo de nuevo.";

export const PERIOD_SAVE_FALLBACK = "No se pudo guardar el periodo. Intente nuevamente.";

/** Server messages that belong under a specific period field (sige/02 §4.1, INS-R5). */
export const PERIOD_FIELD_BY_MESSAGE: Readonly<Record<string, keyof PeriodFormValues>> = {
  "Ya existe un periodo con este nombre corto en el año.": "shortName",
  "Ya existe un periodo con este orden en el año.": "orderNum",
  "Debe haber un periodo activo. Active otro periodo para cambiar.": "isActive",
};

const OVERLAP_PREFIX = "Las fechas se superponen con el periodo ";

/** INS-R9 overlap message ("... con el periodo {nombre}."), which names the clashing period. */
export function isOverlapMessage(message: unknown): message is string {
  return typeof message === "string" && message.startsWith(OVERLAP_PREFIX);
}

/** `mapSubmitError` for the period form: the overlap conflict lands under both date fields. */
export function mapPeriodSubmitError(error: unknown): SubmitFailure {
  const message = (error as { message?: unknown } | null)?.message;
  if ((error as { code?: unknown } | null)?.code === "CONFLICT" && isOverlapMessage(message)) {
    return { fieldErrors: { startDate: message, endDate: message }, formError: null };
  }
  return mapSubmitError(error, {
    fields: PERIOD_FIELDS,
    fieldByMessage: PERIOD_FIELD_BY_MESSAGE,
    fallback: PERIOD_SAVE_FALLBACK,
  });
}

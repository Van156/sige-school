import { criterionInput } from "@base-template/api/sige/schemas/institution";
import { sumWeights } from "@base-template/sige-core";
import { z } from "zod";

import type { CriterionRow } from "../types";

/**
 * INS-18 form rules. Number inputs hold text, so weight and order are parsed first and then
 * checked by the API's own fragment (blank weight is "obligatorio", not 0).
 */
export const criterionFormSchema = z.object({
  name: criterionInput.shape.name,
  weight: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : Number(value)))
    .pipe(criterionInput.shape.weight),
  description: criterionInput.shape.description,
  orderNum: z
    .string()
    .trim()
    .transform((value) => (value === "" ? 0 : Number(value)))
    .pipe(criterionInput.shape.orderNum),
});

export type CriterionFormValues = z.input<typeof criterionFormSchema>;

/** The validated form: the shape `criterion.create` / `criterion.update` take. */
export type CriterionInput = z.output<typeof criterionFormSchema>;

/** `orderNum` defaults to the next free position (the list is ordered, so max + 1). */
export function emptyCriterionForm(nextOrder: number): CriterionFormValues {
  return { name: "", weight: "", description: "", orderNum: String(nextOrder) };
}

/** Names of the fields the criterion form renders. */
export const CRITERION_FIELDS = Object.keys(emptyCriterionForm(1));

export function criterionToFormValues(criterion: CriterionRow): CriterionFormValues {
  return {
    name: criterion.name,
    weight: String(criterion.weight),
    description: criterion.description ?? "",
    orderNum: String(criterion.orderNum),
  };
}

export function toCriterionInput(values: CriterionFormValues): CriterionInput {
  return criterionFormSchema.parse(values);
}

export function nextCriterionOrder(rows: readonly CriterionRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.orderNum), 0) + 1;
}

export const CRITERION_SAVE_FALLBACK = "No se pudo guardar el criterio. Intente nuevamente.";

/**
 * The live "Total con este criterio: {n}%" of the INS-18 side card: Σ of the other criteria plus
 * the weight being typed (ignored while it is not a valid number).
 */
export function totalWithCriterion(
  rows: readonly CriterionRow[],
  editingId: string | null,
  draftWeight: string,
): number {
  const weights = rows.filter((row) => row.id !== editingId).map((row) => row.weight);
  const draft = draftWeight.trim() === "" ? Number.NaN : Number(draftWeight);
  return sumWeights(Number.isFinite(draft) ? [...weights, draft] : weights);
}

/** Toast after a successful update; mentions recalculated finals only when there were any. */
export function criterionUpdatedMessage(affectedFinals: number): string {
  return affectedFinals > 0
    ? `Criterio actualizado. Se recalcularon ${affectedFinals} notas finales.`
    : "Criterio actualizado";
}

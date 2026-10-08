import { levelInput } from "@base-template/api/sige/schemas/institution";
import { z } from "zod";

import type { CampusOption, LevelRow } from "../types";

const CAMPUS_REQUIRED = "Debes seleccionar una sede.";

/**
 * INS-10 form rules. The API's own fragments carry the messages; only `orderNum` differs: a number
 * input holds text, so it is parsed (blank = 0, the default) and then checked by the API rule.
 */
export const levelFormSchema = z.object({
  campusId: z.string().min(1, CAMPUS_REQUIRED),
  name: levelInput.shape.name,
  orderNum: z
    .string()
    .trim()
    .transform((value) => (value === "" ? 0 : Number(value)))
    .pipe(levelInput.shape.orderNum.removeDefault()),
});

/** Form state: every control holds a string, the campus select holds an id or "". */
export type LevelFormValues = z.input<typeof levelFormSchema>;

/** The validated form: the shape `level.create` takes. */
export type LevelInput = z.output<typeof levelFormSchema>;

export const emptyLevelForm: LevelFormValues = { campusId: "", name: "", orderNum: "0" };

/** Names of the fields the level form renders. */
export const LEVEL_FIELDS = Object.keys(emptyLevelForm);

export function levelToFormValues(level: LevelRow): LevelFormValues {
  return { campusId: level.campusId, name: level.name, orderNum: String(level.orderNum) };
}

export function toLevelInput(values: LevelFormValues): LevelInput {
  return levelFormSchema.parse(values);
}

/** `level.update` takes no campus: it is immutable once the level exists (INS-R6). */
export function toLevelUpdate(input: LevelInput): { name: string; orderNum: number } {
  return { name: input.name, orderNum: input.orderNum };
}

export const LEVEL_SAVE_FALLBACK = "No se pudo guardar el nivel. Intente nuevamente.";

/** Server messages that belong under a specific level field (sige/02 §4.1). */
export const LEVEL_FIELD_BY_MESSAGE: Readonly<Record<string, keyof LevelFormValues>> = {
  "Ya existe un nivel con este nombre en la sede.": "name",
  "La sede no existe.": "campusId",
};

/** "{nombre} (Principal)" for the main campus (INS-10). */
export function campusOptionLabel(campus: CampusOption): string {
  return campus.isMain ? `${campus.name} (Principal)` : campus.name;
}

/**
 * The campus select's choices. `campus.options` lists active campuses only, so editing a level of
 * a campus that was deactivated since still shows that campus (the select is disabled there).
 */
export function campusChoices(
  options: readonly CampusOption[],
  current?: Pick<LevelRow, "campusId" | "campusName">,
): CampusOption[] {
  if (!current || options.some((option) => option.id === current.campusId)) {
    return [...options];
  }
  return [...options, { id: current.campusId, name: current.campusName, isMain: false }];
}

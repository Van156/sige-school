import { profileInput } from "@base-template/api/sige/schemas/institution";
import type { z } from "zod";

import type { InstitutionProfile } from "../types";

/** INS-06 form rules: the API's own fragment, so the client and the server messages agree. */
export const profileFormSchema = profileInput;

export type ProfileInput = ReturnType<typeof profileFormSchema.parse>;

/** Form state is the schema's input; every control is always filled with a string (blank = absent). */
export type ProfileFormValues = z.input<typeof profileFormSchema>;

export function profileToFormValues(profile: InstitutionProfile): ProfileFormValues {
  return {
    name: profile.name,
    nit: profile.nit ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    address: profile.address ?? "",
    municipality: profile.municipality ?? "",
    department: profile.department ?? "",
    academicYear: profile.currentAcademicYear,
    resolution: profile.resolution ?? "",
  };
}

/** Validated form to the `institution.update` input; blank optional text is omitted. */
export function toProfileInput(values: ProfileFormValues): ProfileInput {
  return profileFormSchema.parse(values);
}

export const PROFILE_SAVE_FALLBACK = "No se pudo guardar la configuración. Intente nuevamente.";

/** Server messages that belong under a specific profile field (sige/02 §4.1). */
export const PROFILE_FIELD_BY_MESSAGE: Readonly<Record<string, keyof ProfileFormValues>> = {
  "Ya existe una institución con este NIT.": "nit",
};

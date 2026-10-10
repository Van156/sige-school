import { z } from "zod";

import type { StudentDetail } from "../types";

/** STU-02 tabs (sige/05 §5.2), in their order; `info` is the default and stays out of the URL. */
export const STUDENT_PROFILE_TABS = ["info", "horario", "acudientes"] as const;
export type StudentProfileTab = (typeof STUDENT_PROFILE_TABS)[number];

export const STUDENT_PROFILE_TAB_LABELS: Readonly<Record<StudentProfileTab, string>> = {
  info: "Información",
  horario: "Horario",
  acudientes: "Acudientes",
};

/** `validateSearch` of `/estudiantes/$studentId`: `?tab=`; anything unknown is the default tab. */
export const studentProfileSearchSchema = z.object({
  tab: z.enum(STUDENT_PROFILE_TABS).catch("info").default("info"),
});

export type StudentProfileSearch = z.infer<typeof studentProfileSearchSchema>;

export const studentProfileSearchDefaults: StudentProfileSearch = studentProfileSearchSchema.parse(
  {},
);

export function isStudentProfileTab(value: unknown): value is StudentProfileTab {
  return STUDENT_PROFILE_TABS.some((tab) => tab === value);
}

/** Every empty profile value reads "N/A" (sige/05 §5.2). */
export const EMPTY_VALUE = "N/A";

export function displayValue(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? EMPTY_VALUE : String(value);
}

const GENDER_LABELS: Readonly<Record<NonNullable<StudentDetail["gender"]>, string>> = {
  M: "Masculino",
  F: "Femenino",
  Otro: "Otro",
};

export function genderLabel(gender: StudentDetail["gender"]): string {
  return gender === null ? EMPTY_VALUE : GENDER_LABELS[gender];
}

/** "Fecha de Nacimiento" as `dd/mm/yyyy`; "N/A" when empty. */
export function birthDateLabel(birthDate: string | null): string {
  if (!birthDate) {
    return EMPTY_VALUE;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : birthDate;
}

import type { InstitutionRow } from "../types";

type Location = Pick<InstitutionRow, "municipality" | "department">;

/** "{municipio}, {departamento}" from whatever is filled in, or `null` when neither is. */
export function institutionLocation({ municipality, department }: Location): string | null {
  const parts = [municipality, department].map((part) => part?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Table cell: the location or "-". */
export function locationOrDash(location: Location): string {
  return institutionLocation(location) ?? "-";
}

/** Detail dialog subtitle: "Año {año} · {municipio}, {departamento}" or "No especificada". */
export function institutionSubtitle(
  institution: Location & Pick<InstitutionRow, "academicYear">,
): string {
  return `Año ${institution.academicYear} · ${institutionLocation(institution) ?? "No especificada"}`;
}

/** Empty optional detail fields read "-". */
export function valueOrDash(value: string | null | undefined): string {
  return value?.trim() ? value : "-";
}

const CREATED_DATE = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "dd/mm/yyyy" of a creation timestamp (the edit form's "Información" card). */
export function formatCreatedDate(createdAt: Date | string): string {
  return CREATED_DATE.format(new Date(createdAt));
}

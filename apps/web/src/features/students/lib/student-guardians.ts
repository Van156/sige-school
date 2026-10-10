import { guardianLinkInput } from "@base-template/api/sige/schemas/student";
import { GUARDIAN_RELATIONSHIPS, type GuardianRelationship } from "@base-template/sige-core";
import type { StandardSchemaV1 } from "@tanstack/react-form";

import type { Option } from "@/shared/lib/data-table/types";

import type { GuardianCandidate, GuardianLink } from "../types";

/** "Parentesco / Relación" choices (sige/05 §2.2, `guardian_relationship`). */
export const GUARDIAN_RELATIONSHIP_OPTIONS: readonly Option[] = GUARDIAN_RELATIONSHIPS.map(
  (relationship) => ({ value: relationship, label: relationship }),
);

/** The STU-04 "Asignar Nuevo Acudiente" form: both values are select choices. */
export type GuardianLinkFormValues = { guardianPersonId: string; relationship: string };

/** A fresh form: no guardian picked, relationship "Acudiente" (the prototype's default). */
export const GUARDIAN_LINK_DEFAULTS: GuardianLinkFormValues = {
  guardianPersonId: "",
  relationship: "Acudiente" satisfies GuardianRelationship,
};

export const GUARDIAN_LINK_FIELDS = ["guardianPersonId", "relationship"] as const;

/**
 * Client validation of the link form with the API's own messages: "Selecciona un acudiente."
 * (STU-R6) and "Debes seleccionar un parentesco.".
 */
export const guardianLinkValidator = guardianLinkInput.omit({
  studentId: true,
}) as StandardSchemaV1<GuardianLinkFormValues, unknown>;

/** The `guardian.link` input of a validated form. */
export function toGuardianLinkInput(studentId: string, values: GuardianLinkFormValues) {
  return guardianLinkInput.parse({ studentId, ...values });
}

/** Shown when a link fails for a reason the server did not explain (network, unexpected). */
export const GUARDIAN_LINK_FALLBACK = "No se pudo asignar el acudiente. Intente nuevamente.";

/** "{nombre} ({username}) - {documento}" (the candidate select options). */
export function candidateLabel(candidate: GuardianCandidate): string {
  return `${candidate.name} (${candidate.username}) - ${candidate.document}`;
}

export function candidateOption(candidate: GuardianCandidate): Option {
  return { value: candidate.personId, label: candidateLabel(candidate) };
}

/**
 * The combobox items: the candidates found, plus the picked one while it is still the form value
 * and a later search no longer lists it (so the chosen guardian keeps showing until the form is
 * submitted or reset).
 */
export function candidateItems(
  candidates: readonly GuardianCandidate[],
  picked: Option | undefined,
  selectedId: string,
): Option[] {
  const items = candidates.map(candidateOption);
  const keepPicked = picked !== undefined && selectedId !== "" && picked.value === selectedId;
  if (keepPicked && !items.some((item) => item.value === picked.value)) {
    items.unshift(picked);
  }
  return items;
}

/** How the candidate search stands; drives the empty and error notices. */
export type CandidatesStatus = "loading" | "ready" | "searching" | "unavailable" | "search-failed";

/**
 * Maps the candidates query to a status. `term` is the (debounced) search the query ran with: a
 * failure of the blank first list leaves nothing to pick from, while a failure of a typed term
 * happens after the list loaded. A refetch in flight (a retry) counts as searching.
 */
export function candidatesStatus(
  query: { isPending: boolean; isFetching: boolean; isError: boolean },
  term: string,
): CandidatesStatus {
  if (query.isError && !query.isFetching) {
    return term === "" ? "unavailable" : "search-failed";
  }
  if (query.isPending) {
    return "loading";
  }
  return query.isFetching ? "searching" : "ready";
}

export const CANDIDATES_UNAVAILABLE_NOTICE = "No se pudo cargar la lista de acudientes.";
export const CANDIDATES_SEARCH_FAILED_NOTICE =
  "No se pudo buscar acudientes. Cambia el término o reintenta.";

/** The inline notice for a failed candidates query; none while it works. */
export function candidatesNotice(status: CandidatesStatus): string | undefined {
  if (status === "unavailable") {
    return CANDIDATES_UNAVAILABLE_NOTICE;
  }
  return status === "search-failed" ? CANDIDATES_SEARCH_FAILED_NOTICE : undefined;
}

/**
 * "No hay acudientes creados en la institución." applies only when the unfiltered list came back
 * empty: no guardian account is left to link. An empty typed search is a "no results" instead.
 */
export function hasNoCandidates(
  status: CandidatesStatus,
  term: string,
  candidates: readonly GuardianCandidate[],
): boolean {
  return status === "ready" && term === "" && candidates.length === 0;
}

/** "{email} | {teléfono o Sin teléfono}" of an assigned guardian; placeholder emails are `null`. */
export function guardianContactLine(guardian: Pick<GuardianLink, "email" | "phone">): string {
  return `${guardian.email || "Sin correo"} | ${guardian.phone || "Sin teléfono"}`;
}

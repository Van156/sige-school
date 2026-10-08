/** Where a superadmin picks the institution to work in (INS-03). */
export const INSTITUTION_SELECTOR_PATH = "/admin/instituciones" as const;

export type InstitutionScopeDecision = "pending" | "allow" | "select-institution";

/**
 * sige/02 §5.3: a superadmin with no active organization has no institution to show on a tenant
 * structure route. Everyone else (a member, or a root impersonating the rector) already has one.
 * While the session is still loading nothing is known yet, so the decision is `pending`.
 */
export function decideInstitutionScope({
  isPending = false,
  isSuperadmin,
  activeOrganizationId,
}: {
  isPending?: boolean;
  isSuperadmin: boolean;
  activeOrganizationId: string | null | undefined;
}): InstitutionScopeDecision {
  if (isPending) {
    return "pending";
  }
  return isSuperadmin && !activeOrganizationId ? "select-institution" : "allow";
}

/** Badge of the institution banner: "Vista Root" while a superadmin impersonates the rector. */
export function institutionBannerBadge(impersonatedBy: string | null | undefined): string {
  return impersonatedBy ? "Vista Root" : "Tu Institución";
}

/** Callout of the selector redirect; `pageName` is the structure the user tried to open. */
export function selectInstitutionMessage(pageName: string): string {
  return `Necesitas seleccionar una institución para ver ${pageName}.`;
}

/** "{municipio}, {departamento}" or the empty-location copy. */
export function formatInstitutionLocation(
  municipality: string | null | undefined,
  department: string | null | undefined,
): string {
  const parts = [municipality, department].map((part) => part?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Ubicación no especificada";
}

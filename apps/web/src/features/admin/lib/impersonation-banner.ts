/**
 * Whether the app-wide impersonation banner (R6.4) should render: whenever
 * the current session has `impersonatedBy` set (better-auth's admin-plugin
 * session field, added by `adminClient`'s `SessionWithImpersonatedBy`).
 */
export function shouldShowImpersonationBanner(impersonatedBy: string | null | undefined): boolean {
  return Boolean(impersonatedBy);
}

/**
 * Banner copy (sige/02 INS-03). While managing an institution the banner names it; for any other
 * impersonation (a platform user detail page) it names the impersonated account.
 */
export function impersonationBannerMessage({
  institutionName,
  userName,
  userEmail,
}: {
  institutionName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
}): string {
  if (institutionName) {
    return `Vista Root: estás gestionando ${institutionName}.`;
  }
  const account = [userName, userEmail ? `(${userEmail})` : null].filter(Boolean).join(" ");
  return account
    ? `Vista Root: estás gestionando la sesión de ${account}.`
    : "Vista Root: estás gestionando otra sesión.";
}

/**
 * Query key of the banner's institution lookup, scoped by the active organization: the server
 * answers `institution.get` for whichever organization is active, so a key without it would serve
 * the previous institution's cached name right after switching.
 */
export function institutionQueryKeyFor<TKey extends readonly unknown[]>(
  baseKey: TKey,
  activeOrganizationId: string | null | undefined,
) {
  return [...baseKey, { activeOrganizationId: activeOrganizationId ?? null }] as const;
}

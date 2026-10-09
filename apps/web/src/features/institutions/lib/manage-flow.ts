/** The calls `startManagement` makes, injected so the flow stays free of the API and auth clients. */
export type ManageDeps = {
  /** `institutionAdmin.manage`: the user to impersonate (the institution's rector). */
  resolveRector: (institutionId: string) => Promise<{ userId: string }>;
  /** better-auth admin `impersonateUser`; rejects when the session could not be started. */
  impersonate: (userId: string) => Promise<void>;
};

/**
 * INS-03 "Gestionar" (OD-3): ask the API which user manages the institution, then start the
 * existing audited impersonation as that user. Nothing is impersonated when the lookup fails
 * (e.g. the institution has no administrator).
 */
export async function startManagement(deps: ManageDeps, institutionId: string): Promise<void> {
  const { userId } = await deps.resolveRector(institutionId);
  await deps.impersonate(userId);
}

export const MANAGE_FAILED_MESSAGE = "No se pudo gestionar la institución. Intente nuevamente.";

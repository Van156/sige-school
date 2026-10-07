import type { FetchQueryOptions, QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { toast } from "sonner";

/** AUTH-03 route: the only page a user with `must_change_password` may use (sige/01 AUTH-R1). */
export const PASSWORD_CHANGE_PATH = "/cambiar-contrasena";

export const PASSWORD_CHANGE_NOTICE = "⚠️ Debe cambiar su contraseña antes de continuar.";

/** The oRPC error a SIGE procedure throws while the initial password is unchanged (403). */
export function isPasswordChangeRequiredError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "PASSWORD_CHANGE_REQUIRED"
  );
}

/**
 * Global handler for a stray `PASSWORD_CHANGE_REQUIRED` (e.g. the flag was set while the page was
 * open): hard-redirects to AUTH-03. Returns whether the error was handled, so callers skip their
 * generic error toast.
 */
export function redirectOnPasswordChangeRequired(error: unknown): boolean {
  if (!isPasswordChangeRequiredError(error)) {
    return false;
  }
  if (window.location.pathname !== PASSWORD_CHANGE_PATH) {
    window.location.assign(PASSWORD_CHANGE_PATH);
  }
  return true;
}

type MeResult = { person: { mustChangePassword: boolean } };

/**
 * Route guard for SIGE routes: redirects to AUTH-03 while `me.person.mustChangePassword` is set.
 * `me.get` is the only gate-exempt procedure; users without a person (platform admins, accounts
 * outside an institution) and failed lookups pass, since every SIGE procedure re-checks the gate.
 * The result is cached briefly so navigating inside the app does not refetch per route.
 */
export async function enforcePasswordChangeGate<TMe extends MeResult>(
  queryClient: QueryClient,
  meQuery: FetchQueryOptions<TMe>,
): Promise<void> {
  let me: TMe;
  try {
    me = await queryClient.fetchQuery({ ...meQuery, staleTime: 30_000 });
  } catch {
    return;
  }
  if (me.person.mustChangePassword) {
    toast.warning(PASSWORD_CHANGE_NOTICE);
    throw redirect({ to: PASSWORD_CHANGE_PATH });
  }
}

import type { QueryClient } from "@tanstack/react-query";
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

/** Cache key of the gate lookup: `null` data means "no person, no gate". */
export const PASSWORD_GATE_QUERY_KEY = ["password-gate"] as const;

/** `me.get` rejection for an account without a person row in the institution (platform admins). */
const NO_PERSON_CODE = "NO_PERSON";

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === code;
}

/**
 * Route guard for SIGE routes: redirects to AUTH-03 while `me.person.mustChangePassword` is set.
 * `me.get` is the only gate-exempt procedure. An account without a person (`NO_PERSON`: platform
 * admins, accounts outside an institution) has no gate; that outcome is cached like any other so
 * navigation does not refetch it. Any other lookup failure does not block navigation (every SIGE
 * procedure re-checks the gate server side) but is logged and never cached as "no gate".
 */
export async function enforcePasswordChangeGate<TMe extends MeResult>(
  queryClient: QueryClient,
  fetchMe: () => Promise<TMe>,
): Promise<void> {
  let me: TMe | null;
  try {
    me = await queryClient.fetchQuery<TMe | null>({
      queryKey: PASSWORD_GATE_QUERY_KEY,
      queryFn: async () => {
        try {
          return await fetchMe();
        } catch (error) {
          if (hasErrorCode(error, NO_PERSON_CODE)) {
            return null;
          }
          throw error;
        }
      },
      staleTime: 30_000,
      retry: false,
    });
  } catch (error) {
    console.error("Password change gate lookup failed; continuing without the gate.", error);
    return;
  }
  if (me?.person.mustChangePassword) {
    toast.warning(PASSWORD_CHANGE_NOTICE);
    throw redirect({ to: PASSWORD_CHANGE_PATH });
  }
}

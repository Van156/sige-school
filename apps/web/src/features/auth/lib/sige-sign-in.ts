import { betterAuthErrorBody, betterAuthErrorCode } from "./auth-errors";

export const SIGN_IN_REQUIRED_MESSAGE = "Por favor ingrese usuario y contraseña.";
export const SIGN_IN_INVALID_MESSAGE = "Usuario o contraseña incorrectos.";
export const SIGN_IN_RATE_LIMITED_MESSAGE =
  "Demasiados intentos. Intente de nuevo en unos minutos.";
export const SIGN_IN_FALLBACK_MESSAGE = "No se pudo iniciar sesión. Intente nuevamente.";

/** sige/01 AUTH-R6: an identifier containing `@` is an email, anything else a username. */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

/** What `authClient.signIn` exposes that the form needs: one call per identifier kind. */
export type SignInClient<TResult> = {
  email: (input: { email: string; password: string }) => Promise<TResult>;
  username: (input: { username: string; password: string }) => Promise<TResult>;
};

/** Routes the identifier to `signIn.email` or `signIn.username` (the web decides, the server serves both). */
export function signInWithIdentifier<TResult>(
  client: SignInClient<TResult>,
  identifier: string,
  password: string,
): Promise<TResult> {
  const value = identifier.trim();
  return isEmailIdentifier(value)
    ? client.email({ email: value, password })
    : client.username({ username: value, password });
}

/**
 * sige/01 §4.1: a deactivated account shows the server's own message; rate limiting and bad
 * credentials (identical for unknown user and wrong password, no enumeration) get fixed copy.
 */
export function signInErrorMessage(error: unknown): string {
  const body = betterAuthErrorBody(error);
  if (!body) {
    return SIGN_IN_FALLBACK_MESSAGE;
  }
  if (betterAuthErrorCode(error) === "ACCOUNT_DISABLED" && body.message) {
    return body.message;
  }
  if (body.status === 429) {
    return SIGN_IN_RATE_LIMITED_MESSAGE;
  }
  if ((body.status ?? 0) >= 500) {
    return SIGN_IN_FALLBACK_MESSAGE;
  }
  return SIGN_IN_INVALID_MESSAGE;
}

/** First word of the display name, for the "Bienvenido/a, {nombre}!" toast. */
export function firstNameOf(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/)[0] ?? "";
}

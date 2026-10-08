export type SubmitFailure = {
  /** Messages to show under the named form fields. */
  fieldErrors: Record<string, string>;
  /** A message for the form as a whole; `null` when the field errors say everything. */
  formError: string | null;
};

/** Codes whose message is the server's own Spanish text (field rule, conflict or missing row). */
const MESSAGE_CODES = new Set(["BAD_REQUEST", "CONFLICT", "NOT_FOUND"]);

type ErrorShape = { code?: unknown; message?: unknown; data?: unknown };

function issueFields(data: unknown): Record<string, string> {
  const issues = (data as { issues?: unknown } | null | undefined)?.issues;
  if (!Array.isArray(issues)) {
    return {};
  }
  const fields: Record<string, string> = {};
  for (const issue of issues as { message?: unknown; path?: unknown }[]) {
    const head = Array.isArray(issue?.path) ? issue.path[0] : undefined;
    const key = typeof head === "object" && head !== null ? (head as { key?: unknown }).key : head;
    if (typeof key === "string" && typeof issue.message === "string" && !(key in fields)) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

/**
 * Turns a rejected structure mutation into form feedback (sige/02 §4.1: the server returns the
 * same strings as `BAD_REQUEST` field issues). Input-validation issues land under their field;
 * a conflict or domain message lands under the field `fieldByMessage` assigns it (e.g. the
 * one-main-campus rule under `isMain`), else on the form; anything else, including a network
 * failure, gets `fallback`.
 */
export function mapSubmitError(
  error: unknown,
  options: { fieldByMessage?: Readonly<Record<string, string>>; fallback: string },
): SubmitFailure {
  const { code, message, data } = (
    typeof error === "object" && error !== null ? error : {}
  ) as ErrorShape;
  if (typeof code !== "string" || !MESSAGE_CODES.has(code)) {
    return { fieldErrors: {}, formError: options.fallback };
  }
  const fromIssues = issueFields(data);
  if (Object.keys(fromIssues).length > 0) {
    return { fieldErrors: fromIssues, formError: null };
  }
  if (typeof message !== "string" || !message.trim()) {
    return { fieldErrors: {}, formError: options.fallback };
  }
  const field = options.fieldByMessage?.[message];
  return field
    ? { fieldErrors: { [field]: message }, formError: null }
    : { fieldErrors: {}, formError: message };
}

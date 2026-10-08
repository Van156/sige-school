export type SubmitFailure = {
  /** Messages to show under the named form fields. */
  fieldErrors: Record<string, string>;
  /** A message for the form as a whole; `null` when the field errors say everything. */
  formError: string | null;
};

/** Codes whose message is the server's own Spanish text (field rule, conflict or missing row). */
const MESSAGE_CODES = new Set(["BAD_REQUEST", "CONFLICT", "NOT_FOUND"]);

type ErrorShape = { code?: unknown; message?: unknown; data?: unknown };

type Issues = {
  /** Messages keyed by the rendered field they belong to. */
  fields: Record<string, string>;
  /** First issue message whose path matches no rendered field (or whose field already has one). */
  firstUnmatched: string | null;
};

function readIssues(data: unknown, knownFields: ReadonlySet<string>): Issues {
  const issues = (data as { issues?: unknown } | null | undefined)?.issues;
  const result: Issues = { fields: {}, firstUnmatched: null };
  if (!Array.isArray(issues)) {
    return result;
  }
  for (const issue of issues as { message?: unknown; path?: unknown }[]) {
    if (typeof issue?.message !== "string" || !issue.message.trim()) {
      continue;
    }
    const head = Array.isArray(issue.path) ? issue.path[0] : undefined;
    const key = typeof head === "object" && head !== null ? (head as { key?: unknown }).key : head;
    if (typeof key === "string" && knownFields.has(key)) {
      result.fields[key] ??= issue.message;
    } else {
      result.firstUnmatched ??= issue.message;
    }
  }
  return result;
}

/**
 * Turns a rejected structure mutation into form feedback (sige/02 §4.1: the server returns the
 * same strings as `BAD_REQUEST` field issues). Input-validation issues land under their field;
 * a conflict or domain message lands under the field `fieldByMessage` assigns it (e.g. the
 * one-main-campus rule under `isMain`), else on the form; anything else, including a network
 * failure, gets `fallback`. `fields` lists the form's rendered field names: an issue whose path
 * matches none of them is shown on the form (`formError`, first one) instead of being dropped, also
 * when other issues do match fields.
 */
export function mapSubmitError(
  error: unknown,
  options: {
    fields: readonly string[];
    fieldByMessage?: Readonly<Record<string, string>>;
    fallback: string;
  },
): SubmitFailure {
  const { code, message, data } = (
    typeof error === "object" && error !== null ? error : {}
  ) as ErrorShape;
  if (typeof code !== "string" || !MESSAGE_CODES.has(code)) {
    return { fieldErrors: {}, formError: options.fallback };
  }
  const issues = readIssues(data, new Set(options.fields));
  if (Object.keys(issues.fields).length > 0) {
    return { fieldErrors: issues.fields, formError: issues.firstUnmatched };
  }
  if (issues.firstUnmatched) {
    return { fieldErrors: {}, formError: issues.firstUnmatched };
  }
  if (typeof message !== "string" || !message.trim()) {
    return { fieldErrors: {}, formError: options.fallback };
  }
  const field = options.fieldByMessage?.[message];
  return field
    ? { fieldErrors: { [field]: message }, formError: null }
    : { fieldErrors: {}, formError: message };
}

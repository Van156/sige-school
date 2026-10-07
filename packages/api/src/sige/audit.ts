import type { AuditLogger } from "@base-template/auth/audit";
import type { SigeAuditAction } from "@base-template/sige-core";

/**
 * Audit helper for SIGE mutations (foundation §6.9, R3.26): each mutation records exactly one
 * organization-scoped event; tenant and actor come from the request context, never from input.
 * Metadata carries before/after of the changed fields only and never secrets.
 */

/** The slice of the request context the helper needs (structural, so tests need no full context). */
export type AuditContext = {
  auditLogger: AuditLogger;
  org: { id: string };
  session: {
    user: { id: string };
    session: { impersonatedBy?: string | null };
  } | null;
};

export type AuditInput = {
  action: SigeAuditAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
};

export type FieldChange = { from: unknown; to: unknown };

/** `null` and `undefined` are the same "empty" value; dates compare by instant. */
function normalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Fields of `after` whose value differs from `before` as `{ from, to }`. Only keys present in
 * `after` are considered, so a partial update never reports untouched columns.
 */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  for (const key of Object.keys(after)) {
    if (normalize(before[key]) !== normalize(after[key])) {
      changes[key] = { from: before[key] ?? null, to: after[key] ?? null };
    }
  }
  return changes;
}

const SECRET_KEY = /password|passwd|secret|token|credential|api[-_]?key/i;

/** Defense in depth for R7.2: drops secret-looking keys at any depth. */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SECRET_KEY.test(key))
        .map(([key, inner]) => [key, redact(inner)]),
    );
  }
  return value;
}

export async function recordAudit(context: AuditContext, input: AuditInput): Promise<void> {
  if (!context.session) {
    throw new Error("Cannot record an audit event without a session.");
  }
  await context.auditLogger.record({
    scope: "organization",
    organizationId: context.org.id,
    actorUserId: context.session.user.id,
    impersonatorUserId: context.session.session.impersonatedBy ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ? (redact(input.metadata) as Record<string, unknown>) : null,
  });
}

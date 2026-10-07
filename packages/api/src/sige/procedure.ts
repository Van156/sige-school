import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { orgProcedure } from "../index";
import { createScopePolicy } from "./scope";
import type { CallerKind, ScopePolicy } from "./scope";

/**
 * `sigeProcedure`: the base of every SIGE tenant procedure (sige/00 §4, R3.1; sige/01 AUTH-R1).
 * It is `orgProcedure` (session, active organization, membership; tenant from the session only)
 * plus `requireActivePerson`, which loads the caller's `person`, applies the account gates and
 * injects `context.person` and `context.scope`. Per-procedure permission checks stay
 * `requirePermission({...})`, reusing the existing authorization port.
 * See docs/architecture/authorization.md#sige-procedures
 */

export type PersonContext = {
  id: string;
  userId: string;
  kind: CallerKind;
  roleName: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
};

const SIGE_KINDS: readonly string[] = [
  "owner",
  "admin",
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
];

/** `member.role` holds one built-in name (R1.9); anything else is a custom, institution-wide role. */
export function resolveCallerKind(role: string): CallerKind {
  return SIGE_KINDS.includes(role) ? (role as CallerKind) : "custom";
}

/** Custom codes with status 403, like `NO_ACTIVE_ORGANIZATION` (409): clients map them (R3.5). */
function forbidden(code: string, message: string) {
  return new ORPCError(code, { status: 403, message });
}

type SigeProcedureOptions = {
  /** `me.get` only: lets a caller who must change their password still read their own identity. */
  allowPasswordChangePending?: boolean;
};

function createSigeProcedure(options: SigeProcedureOptions = {}) {
  return orgProcedure.use(async ({ context, next }) => {
    const [row] = await context.db
      .select({
        id: schema.person.id,
        userId: schema.person.userId,
        firstName: schema.person.firstName,
        lastName: schema.person.lastName,
        isActive: schema.person.isActive,
        mustChangePassword: schema.person.mustChangePassword,
      })
      .from(schema.person)
      .where(
        and(
          eq(schema.person.organizationId, context.org.id),
          eq(schema.person.userId, context.session.user.id),
        ),
      )
      .limit(1);

    if (!row) {
      throw forbidden("NO_PERSON", "No person profile in this institution.");
    }
    if (!row.isActive) {
      throw forbidden("ACCOUNT_DISABLED", "Account is disabled.");
    }
    if (row.mustChangePassword && !options.allowPasswordChangePending) {
      throw forbidden("PASSWORD_CHANGE_REQUIRED", "Password change required.");
    }

    const kind = resolveCallerKind(context.member.role);
    const person: PersonContext = {
      id: row.id,
      userId: row.userId,
      kind,
      roleName: context.member.role,
      firstName: row.firstName,
      lastName: row.lastName,
      mustChangePassword: row.mustChangePassword,
    };
    const scope: ScopePolicy = createScopePolicy({
      kind,
      organizationId: context.org.id,
      personId: row.id,
    });
    return next({ context: { person, scope } });
  });
}

/** Default for SIGE procedures: blocked while the initial password is still unchanged (R1.21). */
export const sigeProcedure = createSigeProcedure();

/** Exempt from the password gate. Use only for `me.get` (the web needs it to route to AUTH-03). */
export const sigePasswordGateExemptProcedure = createSigeProcedure({
  allowPasswordChangePending: true,
});

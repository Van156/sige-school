import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { createAuthMiddleware } from "@better-auth/core/api";
import { APIError } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { eq, or, sql } from "drizzle-orm";

/** Stable error code and Spanish copy of the deactivated-person block (sige/01 AUTH-R7, §4.1). */
export const ACCOUNT_DISABLED_CODE = "ACCOUNT_DISABLED";
export const ACCOUNT_DISABLED_MESSAGE = "Su cuenta está desactivada. Contacte al administrador.";

function accountDisabled() {
  return new APIError("FORBIDDEN", {
    code: ACCOUNT_DISABLED_CODE,
    message: ACCOUNT_DISABLED_MESSAGE,
  });
}

/**
 * Single choke point for AUTH-R7: wired as `databaseHooks.session.create.before`, it runs for every
 * session better-auth issues (email, username, Google, invitation sign-up, impersonation, ...), so
 * a new sign-in route cannot forget the check. Users without a `person` are untouched.
 */
export function createSessionGuard(database: Database) {
  return async (session: { userId: string }): Promise<void> => {
    const [row] = await database
      .select({ isActive: schema.person.isActive })
      .from(schema.person)
      .where(eq(schema.person.userId, session.userId))
      .limit(1);
    if (row && !row.isActive) {
      throw accountDisabled();
    }
  };
}

const SIGN_IN_PATHS = new Set(["/sign-in/email", "/sign-in/username"]);

/**
 * SIGE sign-in hooks (sige/01 AUTH-R7, AUTH-R8). Before: a user whose `person` is inactive gets no
 * session. `createSessionGuard` covers every other session route. After: a successful sign-in stamps `person.last_login_at` (best-effort). Users without a `person`
 * (platform admins) are untouched. See docs/architecture/auth.md#sige-sign-in-hooks
 */
export function sigeSignInPlugin(database: Database) {
  return {
    id: "sige-sign-in",
    hooks: {
      before: [
        {
          matcher: (context) => SIGN_IN_PATHS.has(context.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const body = (ctx.body ?? {}) as { email?: unknown; username?: unknown };
            const identifier = ctx.path === "/sign-in/email" ? body.email : body.username;
            if (typeof identifier !== "string" || identifier === "") {
              return;
            }
            const normalized = identifier.trim().toLowerCase();
            const [row] = await database
              .select({ isActive: schema.person.isActive })
              .from(schema.user)
              .innerJoin(schema.person, eq(schema.person.userId, schema.user.id))
              .where(
                ctx.path === "/sign-in/email"
                  ? eq(sql`lower(${schema.user.email})`, normalized)
                  : or(
                      eq(schema.user.username, normalized),
                      eq(schema.user.displayUsername, identifier),
                    ),
              )
              .limit(1);
            if (row && !row.isActive) {
              throw accountDisabled();
            }
          }),
        },
      ],
      after: [
        {
          matcher: (context) => SIGN_IN_PATHS.has(context.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            if (returned instanceof Error) {
              return;
            }
            const userId = (returned as { user?: { id?: string } } | undefined)?.user?.id;
            if (!userId) {
              return;
            }
            // Best-effort: a failed stamp must never fail a sign-in that already succeeded.
            try {
              await database
                .update(schema.person)
                .set({ lastLoginAt: new Date() })
                .where(eq(schema.person.userId, userId));
            } catch (error) {
              console.error("[sige-sign-in] last_login_at update failed", error);
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

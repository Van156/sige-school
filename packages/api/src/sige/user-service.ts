import type { AuditLogger } from "@base-template/auth/audit";
import { provisionUser, ProvisionUserError } from "@base-template/auth/provision-user";
import type { ProvisionInput } from "@base-template/auth/provision-user";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { placeholderEmail } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq, ne, sql } from "drizzle-orm";
import type { z } from "zod";

import { hasRoleToken } from "../lib/user-list-config";
import { changedFields, recordAudit } from "./audit";
import { rethrowDbError } from "./pg-errors";
import type { userCreateInput, userEditInput, userResetPasswordInput } from "./schemas/user";
import {
  loadUserDetail,
  onLogin,
  onMember,
  primaryRole,
  rowColumns,
  toUserRow,
} from "./user-queries";

/**
 * User service (sige/03 §3.3, USR-R3/R4/R6/R7/R8): the rules behind `user.create|update|setActive|
 * delete`, written once so the tenant router, the platform router (INS-04/05) and the import share
 * them. The tenant is an explicit `organizationId`; `actor.platform` is what lets a caller reach
 * `owner`/`admin` members (USR-R4), so org routers pass `false` and platform routers `true`.
 *
 * Every mutation is one transaction that ends with its audit event, so a failed audit write rolls
 * the change back (the audit port uses its own connection, so a commit that fails after the event
 * was written is the only residue: an event for a change that did not happen).
 */

export type UserServiceDeps = { db: Database; auditLogger: AuditLogger };

export type UserActor = {
  userId: string;
  impersonatorUserId?: string | null;
  /** Platform callers may manage `owner`/`admin` members; org callers never can (USR-R4). */
  platform: boolean;
};

export type UserCreateInput = z.output<typeof userCreateInput>;
export type UserEditInput = z.output<typeof userEditInput>;
export type UserResetPasswordInput = z.output<typeof userResetPasswordInput>;

export const ADMIN_ROLE_MESSAGE = "Solo la plataforma puede crear administradores.";
const NOT_FOUND_MESSAGE = "El usuario no existe.";
// Not in spec §4.1 (writer-authored).
const PROTECTED_MESSAGE = "Los administradores de la institución solo los gestiona la plataforma.";
const SELF_DEACTIVATE_MESSAGE = "No puede desactivar su propia cuenta.";
const SELF_DELETE_MESSAGE = "No puede eliminar su propia cuenta.";
const SECOND_OWNER_MESSAGE = "La institución ya tiene un propietario.";
export const LAST_OWNER_MESSAGE = "La institución debe conservar al menos un administrador activo.";

const notFound = () => new ORPCError("NOT_FOUND", { message: NOT_FOUND_MESSAGE });
const forbidden = (message: string) => new ORPCError("FORBIDDEN", { message });

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const auditContext = (deps: UserServiceDeps, organizationId: string, actor: UserActor) => ({
  auditLogger: deps.auditLogger,
  org: { id: organizationId },
  session: {
    user: { id: actor.userId },
    session: { impersonatedBy: actor.impersonatorUserId ?? null },
  },
});

const roleTokens = (role: string) =>
  role
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token !== "");
const isOwner = (role: string) => roleTokens(role).includes("owner");
const isProtected = (role: string) => isOwner(role) || roleTokens(role).includes("admin");

/** Locks the person row so concurrent edits of one user serialize; `NOT_FOUND` outside the tenant. */
async function lockTarget(tx: Tx, organizationId: string, personId: string) {
  const [row] = await tx
    .select({
      ...rowColumns,
      documentNumber: schema.person.documentNumber,
      documentType: schema.person.documentType,
    })
    .from(schema.person)
    .innerJoin(schema.user, onLogin)
    .innerJoin(schema.member, onMember)
    .where(and(eq(schema.person.organizationId, organizationId), eq(schema.person.id, personId)))
    .for("update", { of: schema.person });
  if (!row) {
    throw notFound();
  }
  return row;
}
type Target = Awaited<ReturnType<typeof lockTarget>>;

function assertManageable(target: Target, actor: UserActor): void {
  if (isProtected(target.role) && !actor.platform) {
    throw forbidden(PROTECTED_MESSAGE);
  }
}

/**
 * Keeps one active owner (USR-R4, R1.3) when `target` is about to stop being one. A transaction
 * advisory lock per institution serializes owner removals, so two concurrent requests cannot each
 * see the other owner still active; the count is read after the lock is held.
 */
async function assertKeepsActiveOwner(tx: Tx, organizationId: string, target: Target) {
  if (!isOwner(target.role) || !target.isActive) {
    return;
  }
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`sige:owners:${organizationId}`}))`);
  const [others] = await tx
    .select({ active: count() })
    .from(schema.person)
    .innerJoin(schema.member, onMember)
    .where(
      and(
        eq(schema.person.organizationId, organizationId),
        eq(schema.person.isActive, true),
        ne(schema.person.id, target.personId),
        hasRoleToken("owner"),
      ),
    );
  if ((others?.active ?? 0) === 0) {
    throw new ORPCError("CONFLICT", { status: 409, message: LAST_OWNER_MESSAGE });
  }
}

const provisionAuth = { $context: Promise.resolve({ password: { hash: hashPassword } }) };

function mapProvisionError(error: ProvisionUserError): ORPCError<string, unknown> {
  switch (error.code) {
    case "DOCUMENT_TAKEN":
    case "EMAIL_TAKEN": {
      return new ORPCError("CONFLICT", { status: 409, message: error.message });
    }
    case "ORGANIZATION_NOT_FOUND": {
      return new ORPCError("NOT_FOUND", { message: error.message });
    }
    default: {
      return new ORPCError("BAD_REQUEST", { message: error.message });
    }
  }
}

export async function createUser(
  deps: UserServiceDeps,
  organizationId: string,
  input: UserCreateInput,
  actor: UserActor,
) {
  const role = input.role as string;
  if (!actor.platform && (role === "admin" || role === "owner")) {
    throw new ORPCError("BAD_REQUEST", { message: ADMIN_ROLE_MESSAGE });
  }
  if (role === "owner") {
    throw new ORPCError("BAD_REQUEST", { message: SECOND_OWNER_MESSAGE });
  }
  let provisioned: Awaited<ReturnType<typeof provisionUser>>;
  try {
    provisioned = await provisionUser(
      { database: deps.db, auth: provisionAuth, auditLogger: deps.auditLogger },
      {
        ...(input as Omit<ProvisionInput, "organizationId" | "actor">),
        organizationId,
        actor: { userId: actor.userId, impersonatorUserId: actor.impersonatorUserId ?? undefined },
      },
    );
  } catch (error) {
    if (error instanceof ProvisionUserError) {
      throw mapProvisionError(error);
    }
    throw error;
  }
  const user = await loadUserRow(deps.db, organizationId, provisioned.personId, actor.userId);
  return {
    user,
    username: provisioned.username,
    next:
      user.role === "student"
        ? { screen: "STU-03" as const, personId: provisioned.personId }
        : null,
  };
}

async function loadUserRow(
  db: Database,
  organizationId: string,
  personId: string,
  selfUserId: string,
) {
  const [row] = await db
    .select(rowColumns)
    .from(schema.person)
    .innerJoin(schema.user, onLogin)
    .innerJoin(schema.member, onMember)
    .where(and(eq(schema.person.organizationId, organizationId), eq(schema.person.id, personId)));
  if (!row) {
    throw notFound();
  }
  return toUserRow(row, row.userId === selfUserId);
}

/**
 * Credential reset inside a transaction (USR-R8/R9): stores the new hash, re-arms the forced
 * change and revokes every session of the user (D10). The caller records the audit event.
 */
export async function applyPasswordReset(
  tx: Tx,
  target: { userId: string; personId: string },
  passwordHash: string,
): Promise<void> {
  await tx
    .update(schema.account)
    .set({ password: passwordHash })
    .where(
      and(eq(schema.account.userId, target.userId), eq(schema.account.providerId, "credential")),
    );
  await tx
    .update(schema.person)
    .set({ mustChangePassword: true })
    .where(eq(schema.person.id, target.personId));
  await tx.delete(schema.session).where(eq(schema.session.userId, target.userId));
}

const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "documentType",
  "documentNumber",
  "birthDate",
  "gender",
  "phone",
  "address",
  "country",
  "department",
  "municipality",
] as const;

export async function updateUser(
  deps: UserServiceDeps,
  organizationId: string,
  personId: string,
  input: UserEditInput,
  actor: UserActor,
) {
  // Hash before the transaction: it is CPU-bound and must not hold row locks.
  const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : undefined;
  try {
    await deps.db.transaction(async (tx) => {
      const target = await lockTarget(tx, organizationId, personId);
      assertManageable(target, actor);
      const [current] = await tx.select().from(schema.person).where(eq(schema.person.id, personId));
      const [org] = await tx
        .select({ slug: schema.organization.slug })
        .from(schema.organization)
        .where(eq(schema.organization.id, organizationId));
      if (!current || !org) {
        throw notFound();
      }

      const values = {
        firstName: input.firstName,
        lastName: input.lastName,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        birthDate: input.birthDate ?? null,
        gender: input.gender ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        country: input.country ?? null,
        department: input.department ?? null,
        municipality: input.municipality ?? null,
      };
      const beforeEmail = current.hasRealEmail ? target.email : null;
      const afterEmail = input.email ?? null;
      const changes = changedFields(
        { ...Object.fromEntries(PROFILE_FIELDS.map((f) => [f, current[f]])), email: beforeEmail },
        { ...values, email: afterEmail },
      );

      await tx
        .update(schema.person)
        .set({ ...values, hasRealEmail: afterEmail !== null })
        .where(eq(schema.person.id, personId));
      await tx
        .update(schema.user)
        .set({
          name: `${input.firstName} ${input.lastName}`,
          ...(afterEmail === null
            ? current.hasRealEmail
              ? { email: placeholderEmail(target.username ?? "", org.slug), emailVerified: false }
              : {}
            : { email: afterEmail, emailVerified: true }),
        })
        .where(eq(schema.user.id, target.userId));

      if (passwordHash) {
        await applyPasswordReset(tx, { userId: target.userId, personId }, passwordHash);
      }
      // Audit last: it uses its own connection, so an event recorded before a failing write
      // would outlive the rollback.
      const changedKeys = Object.keys(changes);
      if (changedKeys.length > 0) {
        await recordAudit(auditContext(deps, organizationId, actor), {
          action: "user.updated",
          targetType: "user",
          targetId: target.userId,
          metadata: {
            personId,
            changed: changedKeys,
            before: Object.fromEntries(changedKeys.map((k) => [k, changes[k]!.from])),
            after: Object.fromEntries(changedKeys.map((k) => [k, changes[k]!.to])),
          },
        });
      }
      if (passwordHash) {
        await recordAudit(auditContext(deps, organizationId, actor), {
          action: "user.password_reset",
          targetType: "user",
          targetId: target.userId,
          metadata: { personId, mode: "custom" },
        });
      }
    });
  } catch (error) {
    rethrowDbError(error, "write");
  }
  const detail = await loadUserDetail(deps.db, organizationId, personId, null);
  if (!detail) {
    throw notFound();
  }
  return { ...detail, isSelf: detail.userId === actor.userId };
}

/**
 * `user.resetPassword` (USR-R9): `document` resets to the person's current document number,
 * `custom` to the given password. Both re-arm the forced change and revoke every session in one
 * transaction; the audit event (mode only, never the secret) is the last statement. The spec does
 * not forbid resetting yourself, so it is allowed (org callers cannot reach their own row anyway
 * when it is `owner`/`admin`, which are the only roles holding `user:reset_password`).
 */
export async function resetUserPassword(
  deps: UserServiceDeps,
  organizationId: string,
  input: UserResetPasswordInput,
  actor: UserActor,
): Promise<{ ok: true }> {
  // Hashing is CPU-bound, so it stays outside the transaction; document mode reads the number
  // under the row lock below and hashes it there (the lock is held for one hash only).
  const customHash = input.mode === "custom" ? await hashPassword(input.newPassword) : undefined;
  try {
    await deps.db.transaction(async (tx) => {
      const target = await lockTarget(tx, organizationId, input.personId);
      assertManageable(target, actor);
      const passwordHash = customHash ?? (await hashPassword(target.documentNumber));
      await applyPasswordReset(
        tx,
        { userId: target.userId, personId: input.personId },
        passwordHash,
      );
      await recordAudit(auditContext(deps, organizationId, actor), {
        action: "user.password_reset",
        targetType: "user",
        targetId: target.userId,
        metadata: { personId: input.personId, mode: input.mode },
      });
    });
  } catch (error) {
    rethrowDbError(error, "write");
  }
  return { ok: true };
}

export async function setUserActive(
  deps: UserServiceDeps,
  organizationId: string,
  personId: string,
  active: boolean,
  actor: UserActor,
) {
  await deps.db.transaction(async (tx) => {
    const target = await lockTarget(tx, organizationId, personId);
    if (!active && target.userId === actor.userId) {
      throw forbidden(SELF_DEACTIVATE_MESSAGE);
    }
    assertManageable(target, actor);
    if (target.isActive === active) {
      return;
    }
    if (!active) {
      await assertKeepsActiveOwner(tx, organizationId, target);
    }
    await tx.update(schema.person).set({ isActive: active }).where(eq(schema.person.id, personId));
    if (!active) {
      // D10: same transaction, so no window where the user is inactive yet keeps a live session.
      await tx.delete(schema.session).where(eq(schema.session.userId, target.userId));
    }
    await recordAudit(auditContext(deps, organizationId, actor), {
      action: active ? "user.reactivated" : "user.deactivated",
      targetType: "user",
      targetId: target.userId,
      metadata: { personId, role: primaryRole(target.role) },
    });
  });
  return loadUserRow(deps.db, organizationId, personId, actor.userId);
}

export async function deleteUser(
  deps: UserServiceDeps,
  organizationId: string,
  personId: string,
  actor: UserActor,
): Promise<{ deleted: true }> {
  let role = "";
  try {
    await deps.db.transaction(async (tx) => {
      const target = await lockTarget(tx, organizationId, personId);
      role = primaryRole(target.role);
      if (target.userId === actor.userId) {
        throw forbidden(SELF_DELETE_MESSAGE);
      }
      assertManageable(target, actor);
      await assertKeepsActiveOwner(tx, organizationId, target);
      // `person.user_id` restricts user deletion, so the person goes first; its own restrict FKs
      // (course director, import creator, later modules) are what make a user not "fresh".
      await tx.delete(schema.person).where(eq(schema.person.id, personId));
      // Cascades account, member and sessions.
      await tx.delete(schema.user).where(eq(schema.user.id, target.userId));
      await recordAudit(auditContext(deps, organizationId, actor), {
        action: "user.deleted",
        targetType: "user",
        targetId: target.userId,
        metadata: {
          personId,
          name: `${target.firstName} ${target.lastName}`,
          username: target.username,
          role,
        },
      });
    });
  } catch (error) {
    rethrowDbError(error, "delete", { personRole: role });
  }
  return { deleted: true };
}

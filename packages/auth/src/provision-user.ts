import type { Database } from "@base-template/db";
import {
  account,
  documentType,
  gender,
  member,
  organization,
  PERSON_DOCUMENT_UNIQUE,
  person,
  user,
} from "@base-template/db/schema";
import {
  generateUsername,
  placeholderEmail,
  UsernameGenerationError,
} from "@base-template/sige-core";
import { and, eq, like } from "drizzle-orm";
import { z } from "zod";

import type { AuditEvent, AuditLogger } from "./audit/types";
import { BUILT_IN_ORG_ROLES } from "./permissions/helpers";
import type { BuiltInOrgRole } from "./permissions/helpers";

/**
 * SIGE provisioning service (sige/00 R1.18-R1.21, sige/03 §3.1). The single code path that writes
 * `user`, `account`, `member` and `person` rows (USR-R1): no email is sent, the initial password
 * is the document number, and the placeholder email keeps better-auth satisfied (OD-1).
 *
 * `user`, credential `account`, `member` and `person` are written in ONE Drizzle transaction, so a
 * failure leaves no residue (stronger than the compensation the spec allows). The audit event goes
 * through the `AuditLogger` port after commit; if it fails the rows are compensated (deleted).
 * Caller rules (USR-R3: who may provision `owner`/`admin`) belong to the calling procedure.
 *
 * `provisionUserInTransaction` is the same path inside a caller's transaction (sige/05 STU-R2
 * path A: login + student profile + enrollments commit together). Each attempt runs in a
 * savepoint, so a lost username race retries without aborting the caller's work; the
 * `user.created` event is returned for the caller to record, so a later rollback never leaves an
 * event for a user that does not exist, and no compensation is needed.
 */

/** Built-in org roles minus better-auth's plain `member` (R1.9: exactly one SIGE role per user). */
export const PROVISIONABLE_ROLES = BUILT_IN_ORG_ROLES.filter(
  (role): role is Exclude<BuiltInOrgRole, "member"> => role !== "member",
);
export type ProvisionableRole = (typeof PROVISIONABLE_ROLES)[number];

export const DOCUMENT_TYPES = documentType.enumValues;

export type ProvisionActor = { userId: string; impersonatorUserId?: string } | "system";

export type ProvisionInput = {
  organizationId: string;
  role: ProvisionableRole;
  firstName: string;
  lastName: string;
  documentType: (typeof documentType.enumValues)[number];
  documentNumber: string;
  birthDate?: string;
  gender?: (typeof gender.enumValues)[number];
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  department?: string;
  municipality?: string;
  /** Default true; only the seed overrides it. */
  mustChangePassword?: boolean;
  actor: ProvisionActor;
};

export type Provisioned = {
  userId: string;
  personId: string;
  username: string;
  hasRealEmail: boolean;
};

export type ProvisionErrorCode =
  | "VALIDATION"
  | "ORGANIZATION_NOT_FOUND"
  | "DOCUMENT_TAKEN"
  | "EMAIL_TAKEN"
  | "USERNAME_UNAVAILABLE";

export class ProvisionUserError extends Error {
  constructor(
    readonly code: ProvisionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProvisionUserError";
  }
}

/** The slice of a `createAuth()` instance the service needs: better-auth's password hasher. */
export type ProvisionAuth = {
  $context: Promise<{
    password: { hash: (password: string) => Promise<string> };
  }>;
};

/** Test seam: runs inside the transaction after each insert, so tests can fail any step. */
export type ProvisionFaultInjection = {
  afterInsert?: (step: "user" | "account" | "member" | "person") => void | Promise<void>;
};

export type ProvisionDeps = {
  faultInjection?: ProvisionFaultInjection;
  database: Database;
  auth: ProvisionAuth;
  auditLogger: AuditLogger;
};

/** Rejects impossible dates such as 2020-02-31 that the shape regex lets through. */
function isRealCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const inputSchema = z.object({
  firstName: z.string().trim().min(1, "Los nombres son obligatorios.").max(100),
  lastName: z.string().trim().min(1, "Los apellidos son obligatorios.").max(100),
  documentType: z.enum(DOCUMENT_TYPES, {
    message: "Tipo de documento inválido.",
  }),
  documentNumber: z
    .string()
    .trim()
    .min(5, "El documento debe tener al menos 5 caracteres.")
    .max(20, "El documento no puede superar 20 caracteres.")
    .regex(/^[A-Za-z0-9]+$/, "El documento solo admite letras y números."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Ingresa un correo válido."))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento inválida.")
    .refine(isRealCalendarDate, "Fecha de nacimiento inválida.")
    .refine((value) => value <= todayIso(), "La fecha de nacimiento no puede ser futura.")
    .optional(),
  gender: z.enum(gender.enumValues).optional(),
  phone: optionalText(30),
  address: optionalText(200),
  country: optionalText(100),
  department: optionalText(100),
  municipality: optionalText(100),
});

const MAX_USERNAME_ATTEMPTS = 5;
// Constraint names generated by drizzle-kit for `user.email` / `user.username` (see the migrations).
const USER_EMAIL_UNIQUE = "user_email_key";
const USER_USERNAME_UNIQUE = "user_username_key";

/** Postgres unique-violation constraint name, unwrapping Drizzle's query error `cause`. */
function uniqueViolationConstraint(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const candidate = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (candidate.code === "23505") {
      return candidate.constraint ?? "";
    }
    current = candidate.cause;
  }
  return null;
}

/** A Drizzle transaction handle of the caller (`database.transaction(async (tx) => ...)`). */
export type ProvisionTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Rows committed (standalone) or written in the caller's transaction, plus the pending event. */
type ProvisionOutcome = Provisioned & { auditEvent: AuditEvent };

export async function provisionUser(
  deps: ProvisionDeps,
  input: ProvisionInput,
): Promise<Provisioned> {
  const { auditEvent, ...provisioned } = await provisionRows(deps, deps.database, input);
  // Step 6: audit. A failed write compensates, in reverse order (person restricts user deletion).
  try {
    await deps.auditLogger.record(auditEvent);
  } catch (error) {
    const { userId, personId } = provisioned;
    try {
      await deps.database.transaction(async (tx) => {
        await tx.delete(person).where(eq(person.id, personId));
        await tx.delete(user).where(eq(user.id, userId)); // cascades account and member
      });
    } catch (compensationError) {
      // The rows stay committed: log loudly with the ids to clean up, and still surface the
      // original failure so the caller never sees a success.
      console.error(
        `[provision-user] compensation failed; orphan rows remain for user ${userId} / person ${personId}`,
        compensationError,
      );
    }
    throw error;
  }
  return provisioned;
}

/**
 * Provisions inside the caller's transaction `tx`: nothing commits until the caller does, and
 * the `user.created` event comes back in `auditEvent` for the caller to record (the audit port
 * uses its own connection, so recording it here would outlive a later rollback).
 */
export async function provisionUserInTransaction(
  deps: Pick<ProvisionDeps, "auth" | "faultInjection">,
  tx: ProvisionTransaction,
  input: ProvisionInput,
): Promise<ProvisionOutcome> {
  return provisionRows(deps, tx, input);
}

/** Validation, uniqueness checks and the row inserts; `runner` is the database or a caller tx. */
async function provisionRows(
  deps: Pick<ProvisionDeps, "auth" | "faultInjection">,
  runner: Database | ProvisionTransaction,
  input: ProvisionInput,
): Promise<ProvisionOutcome> {
  const { auth, faultInjection } = deps;
  const database = runner;

  if (!(PROVISIONABLE_ROLES as readonly string[]).includes(input.role)) {
    throw new ProvisionUserError("VALIDATION", "Rol inválido.");
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ProvisionUserError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Datos inválidos.",
    );
  }
  const data = parsed.data;

  const [org] = await database
    .select({ id: organization.id, slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, input.organizationId))
    .limit(1);
  if (!org) {
    throw new ProvisionUserError("ORGANIZATION_NOT_FOUND", "La institución no existe.");
  }

  // Step 1: early uniqueness checks (the DB constraints remain the race-safe backstop).
  const [documentOwner] = await database
    .select({ id: person.id })
    .from(person)
    .where(and(eq(person.organizationId, org.id), eq(person.documentNumber, data.documentNumber)))
    .limit(1);
  if (documentOwner) {
    throw new ProvisionUserError("DOCUMENT_TAKEN", "Ya existe un usuario con este documento.");
  }
  if (data.email) {
    const [emailOwner] = await database
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, data.email))
      .limit(1);
    if (emailOwner) {
      throw new ProvisionUserError("EMAIL_TAKEN", "Ya existe un usuario con este correo.");
    }
  }

  const { hash } = (await auth.$context).password;
  const passwordHash = await hash(data.documentNumber);
  const fullName = `${data.firstName} ${data.lastName}`;

  // Usernames that lost a race; fed back into `generateUsername` so the retry moves on.
  const lostUsernames = new Set<string>();

  for (let attempt = 1; attempt <= MAX_USERNAME_ATTEMPTS; attempt += 1) {
    // Step 2: username, checked globally (usernames are unique across tenants).
    let username: string;
    try {
      const base = generateUsername(data, new Set());
      const rows = await database
        .select({ username: user.username })
        .from(user)
        .where(like(user.username, `${base}%`));
      username = generateUsername(
        data,
        new Set([...rows.flatMap((row) => (row.username ? [row.username] : [])), ...lostUsernames]),
      );
    } catch (error) {
      if (error instanceof UsernameGenerationError) {
        throw new ProvisionUserError("VALIDATION", error.message);
      }
      throw error;
    }

    const hasRealEmail = data.email !== undefined;
    const email = data.email ?? placeholderEmail(username, org.slug);
    const userId = crypto.randomUUID();
    const personId = crypto.randomUUID();

    // Steps 3-5: one transaction for user, credential account, member and person (a savepoint
    // when `runner` is the caller's transaction).
    try {
      await database.transaction(async (tx) => {
        await tx.insert(user).values({
          id: userId,
          name: fullName,
          email,
          emailVerified: true,
          username,
          displayUsername: username,
        });
        await faultInjection?.afterInsert?.("user");
        await tx.insert(account).values({
          id: crypto.randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: passwordHash,
        });
        await faultInjection?.afterInsert?.("account");
        await tx.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: org.id,
          userId,
          role: input.role,
        });
        await faultInjection?.afterInsert?.("member");
        await tx.insert(person).values({
          id: personId,
          organizationId: org.id,
          userId,
          firstName: data.firstName,
          lastName: data.lastName,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          birthDate: data.birthDate,
          gender: data.gender,
          phone: data.phone,
          address: data.address,
          country: data.country,
          department: data.department,
          municipality: data.municipality,
          hasRealEmail,
          mustChangePassword: input.mustChangePassword ?? true,
        });
        await faultInjection?.afterInsert?.("person");
      });
    } catch (error) {
      const constraint = uniqueViolationConstraint(error);
      if (constraint === null) throw error;
      if (constraint === PERSON_DOCUMENT_UNIQUE) {
        throw new ProvisionUserError("DOCUMENT_TAKEN", "Ya existe un usuario con este documento.");
      }
      // The placeholder email derives from the username, so a race for a username can surface as
      // an email violation instead of a username one: both mean this username is gone.
      const placeholderTaken = constraint === USER_EMAIL_UNIQUE && !hasRealEmail;
      if (constraint === USER_USERNAME_UNIQUE || placeholderTaken) {
        lostUsernames.add(username);
        continue;
      }
      if (constraint === USER_EMAIL_UNIQUE) {
        throw new ProvisionUserError("EMAIL_TAKEN", "Ya existe un usuario con este correo.");
      }
      throw error;
    }

    const auditEvent: AuditEvent = {
      scope: "organization",
      organizationId: org.id,
      actorUserId: input.actor === "system" ? userId : input.actor.userId,
      impersonatorUserId: input.actor === "system" ? null : input.actor.impersonatorUserId,
      action: "user.created",
      targetType: "user",
      targetId: userId,
      metadata: { role: input.role, personId, hasRealEmail },
    };
    return { userId, personId, username, hasRealEmail, auditEvent };
  }

  throw new ProvisionUserError("USERNAME_UNAVAILABLE", "No se pudo generar el nombre de usuario.");
}

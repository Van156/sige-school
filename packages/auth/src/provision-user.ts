import type { Database } from "@base-template/db";
import { account, member, organization, person, user } from "@base-template/db/schema";
import {
  generateUsername,
  placeholderEmail,
  UsernameGenerationError,
} from "@base-template/sige-core";
import { and, eq, like } from "drizzle-orm";
import { z } from "zod";

import type { AuditLogger } from "./audit/types";

/**
 * SIGE provisioning service (sige/00 R1.18-R1.21, sige/03 §3.1). The single code path that writes
 * `user`, `account`, `member` and `person` rows (USR-R1): no email is sent, the initial password
 * is the document number, and the placeholder email keeps better-auth satisfied (OD-1).
 *
 * `user`, credential `account`, `member` and `person` are written in ONE Drizzle transaction, so a
 * failure leaves no residue (stronger than the compensation the spec allows). The audit event goes
 * through the `AuditLogger` port after commit; if it fails the rows are compensated (deleted).
 * Caller rules (USR-R3: who may provision `owner`/`admin`) belong to the calling procedure.
 */

export const PROVISIONABLE_ROLES = [
  "owner",
  "admin",
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
] as const;
export type ProvisionableRole = (typeof PROVISIONABLE_ROLES)[number];

export const DOCUMENT_TYPES = ["TI", "CC", "RC", "CE", "Pasaporte"] as const;

export type ProvisionActor = { userId: string; impersonatorUserId?: string } | "system";

export type ProvisionInput = {
  organizationId: string;
  role: ProvisionableRole;
  firstName: string;
  lastName: string;
  documentType: (typeof DOCUMENT_TYPES)[number];
  documentNumber: string;
  birthDate?: string;
  gender?: "M" | "F" | "Otro";
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

export type ProvisionDeps = {
  database: Database;
  auth: ProvisionAuth;
  auditLogger: AuditLogger;
};

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
    .min(5, "El documento debe tener al menos 5 dígitos.")
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
    .refine((value) => value <= todayIso(), "La fecha de nacimiento no puede ser futura.")
    .optional(),
  gender: z.enum(["M", "F", "Otro"]).optional(),
  phone: optionalText(30),
  address: optionalText(200),
  country: optionalText(100),
  department: optionalText(100),
  municipality: optionalText(100),
});

const MAX_USERNAME_ATTEMPTS = 5;

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

export async function provisionUser(
  deps: ProvisionDeps,
  input: ProvisionInput,
): Promise<Provisioned> {
  const { database, auth, auditLogger } = deps;

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
        new Set(rows.flatMap((row) => (row.username ? [row.username] : []))),
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

    // Steps 3-5: one transaction for user, credential account, member and person.
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
        await tx.insert(account).values({
          id: crypto.randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: passwordHash,
        });
        await tx.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: org.id,
          userId,
          role: input.role,
        });
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
      });
    } catch (error) {
      const constraint = uniqueViolationConstraint(error);
      if (constraint === null) throw error;
      if (constraint.includes("username")) continue; // lost a race for the username: pick the next
      if (constraint.includes("documentNumber")) {
        throw new ProvisionUserError("DOCUMENT_TAKEN", "Ya existe un usuario con este documento.");
      }
      if (constraint.includes("email")) {
        throw new ProvisionUserError("EMAIL_TAKEN", "Ya existe un usuario con este correo.");
      }
      throw error;
    }

    // Step 6: audit. A failed write compensates, in reverse order (person restricts user deletion).
    try {
      await auditLogger.record({
        scope: "organization",
        organizationId: org.id,
        actorUserId: input.actor === "system" ? userId : input.actor.userId,
        impersonatorUserId: input.actor === "system" ? null : input.actor.impersonatorUserId,
        action: "user.created",
        targetType: "user",
        targetId: userId,
        metadata: { role: input.role, personId, hasRealEmail },
      });
    } catch (error) {
      await database.transaction(async (tx) => {
        await tx.delete(person).where(eq(person.id, personId));
        await tx.delete(user).where(eq(user.id, userId)); // cascades account and member
      });
      throw error;
    }

    return { userId, personId, username, hasRealEmail };
  }

  throw new ProvisionUserError("USERNAME_UNAVAILABLE", "No se pudo generar el nombre de usuario.");
}

import type { AuditLogger } from "@base-template/auth/audit";
import { provisionUser, ProvisionUserError } from "@base-template/auth/provision-user";
import type { ProvisionInput } from "@base-template/auth/provision-user";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { hashPassword } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";

/**
 * Minimal institution creation (sige/02 §3.1.1, P0 slice of INS-02): one organization plus its
 * rector. The rector is provisioned through `provisionUser` (role `owner`, initial password =
 * document number, forced change armed). `institution_profile` and `seedInstitutionDefaults`
 * belong to module 02 (P1) and are not created here.
 *
 * Better-auth adapters and `provisionUser` do not share one transaction, so failures compensate
 * in reverse order (sige/00 R1.18). See docs/architecture/authorization.md#institution-creation
 */

export type CreateInstitutionInput = {
  name: string;
  rector: Omit<ProvisionInput, "organizationId" | "role" | "actor" | "mustChangePassword">;
  actor: { userId: string; impersonatorUserId?: string };
};

export type CreatedInstitution = {
  institution: { id: string; name: string; slug: string; createdAt: Date };
  rector: { userId: string; personId: string; username: string };
};

export type CreateInstitutionDeps = {
  database: Database;
  auditLogger: AuditLogger;
};

/** `Colegio Ñandú Sur` -> `colegio-nandu-sur`; falls back to `institucion` for names with no letters. */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "institucion";
}

async function uniqueSlug(database: Database, name: string): Promise<string> {
  const base = slugify(name);
  const rows = await database
    .select({ slug: schema.organization.slug })
    .from(schema.organization)
    .where(like(schema.organization.slug, `${base}%`));
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export class InstitutionCreationError extends Error {
  constructor(
    readonly code: "VALIDATION" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "InstitutionCreationError";
  }
}

export async function createInstitution(
  { database, auditLogger }: CreateInstitutionDeps,
  input: CreateInstitutionInput,
): Promise<CreatedInstitution> {
  const organizationId = crypto.randomUUID();
  const slug = await uniqueSlug(database, input.name);
  const [institution] = await database
    .insert(schema.organization)
    .values({ id: organizationId, name: input.name, slug })
    .returning();
  if (!institution) throw new Error("Organization insert returned no row.");

  const deleteOrganization = async () => {
    try {
      // Cascades member and person; the rector's user row is removed by the caller of this helper.
      await database.delete(schema.organization).where(eq(schema.organization.id, organizationId));
    } catch (compensationError) {
      console.error(
        `[create-institution] compensation failed; orphan organization ${organizationId} remains`,
        compensationError,
      );
    }
  };

  let rector: Awaited<ReturnType<typeof provisionUser>>;
  try {
    rector = await provisionUser(
      {
        database,
        // Same hasher better-auth uses for credential accounts (no custom password config).
        auth: { $context: Promise.resolve({ password: { hash: hashPassword } }) },
        auditLogger,
      },
      { ...input.rector, organizationId, role: "owner", actor: input.actor },
    );
  } catch (error) {
    await deleteOrganization();
    if (error instanceof ProvisionUserError) {
      throw new InstitutionCreationError(
        error.code === "VALIDATION" ? "VALIDATION" : "CONFLICT",
        error.message,
      );
    }
    throw error;
  }

  try {
    // sige/00 R1.12: the rector owns exactly this institution.
    await database
      .update(schema.user)
      .set({ maxOrganizations: 1 })
      .where(eq(schema.user.id, rector.userId));
    await auditLogger.record({
      scope: "organization",
      organizationId,
      actorUserId: input.actor.userId,
      impersonatorUserId: input.actor.impersonatorUserId ?? null,
      action: "organization.created",
      targetType: "organization",
      targetId: organizationId,
      metadata: { organizationName: institution.name, slug: institution.slug },
    });
  } catch (error) {
    // Organization delete cascades member and person; person restricts user deletion, so the
    // organization goes first.
    await deleteOrganization();
    try {
      await database.delete(schema.user).where(eq(schema.user.id, rector.userId));
    } catch (compensationError) {
      console.error(
        `[create-institution] compensation failed; orphan rector user ${rector.userId} remains`,
        compensationError,
      );
    }
    throw error;
  }

  return {
    institution: {
      id: institution.id,
      name: institution.name,
      slug: institution.slug,
      createdAt: institution.createdAt,
    },
    rector: { userId: rector.userId, personId: rector.personId, username: rector.username },
  };
}

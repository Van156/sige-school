import type { AuditLogger } from "@base-template/auth/audit";
import { provisionUser, ProvisionUserError } from "@base-template/auth/provision-user";
import type { ProvisionInput } from "@base-template/auth/provision-user";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { hashPassword } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";

/**
 * Institution creation (sige/02 §3.1.1, INS-02): one organization, its rector and its
 * `institution_profile`. The rector is provisioned through `provisionUser` (role `owner`, initial
 * password = document number, forced change armed). `seedInstitutionDefaults` owns rows of later
 * modules and is a no-op until those tables exist.
 *
 * Better-auth adapters and `provisionUser` do not share one transaction, so the steps (organization,
 * rector, profile, audit) cannot be one database transaction; failures compensate in reverse order
 * (sige/00 R1.18). See docs/architecture/authorization.md#institution-creation
 */

/** `institution_profile` fields; all optional, the academic year defaults to the current year. */
export type InstitutionProfileFields = {
  nit?: string;
  phone?: string;
  email?: string;
  address?: string;
  municipality?: string;
  department?: string;
  resolution?: string;
  academicYear?: string;
};

export type CreateInstitutionInput = {
  name: string;
  profile?: InstitutionProfileFields;
  rector: Omit<ProvisionInput, "organizationId" | "role" | "actor">;
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

async function takenSlugs(database: Database, base: string): Promise<Set<string>> {
  const rows = await database
    .select({ slug: schema.organization.slug })
    .from(schema.organization)
    .where(like(schema.organization.slug, `${base}%`));
  return new Set(rows.map((row) => row.slug));
}

function nextFreeSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Postgres unique violation, possibly wrapped by drizzle (`cause`). */
function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Bounded: past a few collisions the candidate gets a random suffix so contention converges. */
const SLUG_ATTEMPTS = 8;
const RANDOM_SUFFIX_FROM_ATTEMPT = 3;

/**
 * Inserts the organization under a free slug. The read-then-insert check races with concurrent
 * creates of the same name, so the unique constraint is the arbiter: a collision recomputes the
 * slug and retries instead of surfacing the raw violation.
 */
async function insertOrganization(database: Database, organizationId: string, name: string) {
  const base = slugify(name);
  for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt += 1) {
    const free = nextFreeSlug(base, await takenSlugs(database, base));
    const slug =
      attempt < RANDOM_SUFFIX_FROM_ATTEMPT
        ? free
        : `${base.slice(0, 55).replace(/-+$/g, "")}-${crypto.randomUUID().slice(0, 4)}`;
    try {
      const [row] = await database
        .insert(schema.organization)
        .values({ id: organizationId, name, slug })
        .returning();
      if (!row) throw new Error("Organization insert returned no row.");
      return row;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new InstitutionCreationError(
    "CONFLICT",
    "No pudimos asignar un identificador único a la institución. Inténtalo de nuevo.",
  );
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

const NIT_TAKEN_MESSAGE = "Ya existe una institución con este NIT.";

export async function createInstitution(
  { database, auditLogger }: CreateInstitutionDeps,
  input: CreateInstitutionInput,
): Promise<CreatedInstitution> {
  // Spec 3.1.1 step 1: reject a taken NIT before any write. The partial unique index stays the
  // arbiter for a concurrent create (see the profile insert below).
  const nit = input.profile?.nit;
  if (nit) {
    const [taken] = await database
      .select({ id: schema.institutionProfile.organizationId })
      .from(schema.institutionProfile)
      .where(eq(schema.institutionProfile.nit, nit))
      .limit(1);
    if (taken) throw new InstitutionCreationError("CONFLICT", NIT_TAKEN_MESSAGE);
  }

  const organizationId = crypto.randomUUID();
  const institution = await insertOrganization(database, organizationId, input.name);

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

  // Everything after the rector: organization delete cascades member, person and profile; person
  // restricts user deletion, so the organization goes first, then the rector's user.
  const compensate = async () => {
    await deleteOrganization();
    try {
      await database.delete(schema.user).where(eq(schema.user.id, rector.userId));
    } catch (compensationError) {
      console.error(
        `[create-institution] compensation failed; orphan rector user ${rector.userId} remains`,
        compensationError,
      );
    }
  };

  try {
    const profile = input.profile ?? {};
    await database.insert(schema.institutionProfile).values({
      organizationId,
      nit: profile.nit ?? null,
      phone: profile.phone ?? null,
      email: profile.email ?? null,
      address: profile.address ?? null,
      municipality: profile.municipality ?? null,
      department: profile.department ?? null,
      resolution: profile.resolution ?? null,
      currentAcademicYear: profile.academicYear ?? String(new Date().getFullYear()),
    });
  } catch (error) {
    await compensate();
    if (isUniqueViolation(error)) {
      throw new InstitutionCreationError("CONFLICT", NIT_TAKEN_MESSAGE);
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
    await compensate();
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

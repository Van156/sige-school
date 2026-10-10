import type { AuditLogger } from "@base-template/auth/audit";
import { provisionUser } from "@base-template/auth/provision-user";
import type { ProvisionInput } from "@base-template/auth/provision-user";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import type { SigeKind } from "@base-template/sige-core";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { createInstitution } from "./create-institution";
import type { GenerateScheduleResult } from "./schedule-generation";
import { DEMO_TEACHERS, NEW_DEMO_TEACHERS, seedSchedule } from "./seed-schedule";
import { DEMO_ACADEMIC_YEAR, DEMO_PROFILE, seedInstitutionStructure } from "./seed-structure";

/**
 * SIGE P0 seed skeleton (sige/00 §9, R4): the root platform admin, the demo institution and one
 * login per SIGE kind. Idempotent: the root is found by email, the institution by slug and every
 * person by document number, so a second run writes nothing. Later phases extend this seed with
 * the academic dataset (R4.2). Users go through `provisionUser` (R4.3), never raw inserts; only
 * the root, a platform account outside any institution, is inserted directly.
 */

export const DEMO_INSTITUTION = { name: "Colegio San José", slug: "colegio-san-jose" } as const;

type DemoPerson = {
  kind: SigeKind;
  firstName: string;
  lastName: string;
  documentNumber: string;
};

/**
 * Demo logins. The username follows R1.19 (initial + last name + last 4 document digits) and the
 * initial password is the document number (OD-2), so every row is predictable and printable.
 */
export const DEMO_PEOPLE: readonly DemoPerson[] = [
  { kind: "owner", firstName: "Carlos", lastName: "Mendoza", documentNumber: "1000000001" },
  { kind: "admin", firstName: "Laura", lastName: "Pardo", documentNumber: "1000000002" },
  { kind: "coordinator", firstName: "Andrés", lastName: "Castillo", documentNumber: "1000000003" },
  { kind: "teacher", firstName: "Marcela", lastName: "Ortiz", documentNumber: "1000000004" },
  { kind: "student", firstName: "Julián", lastName: "López", documentNumber: "1000000005" },
  { kind: "parent", firstName: "Patricia", lastName: "Gómez", documentNumber: "1000000006" },
  { kind: "viewer", firstName: "Diego", lastName: "Rojas", documentNumber: "1000000007" },
];

export type SeedRoot = { email: string; password: string; name: string };

export type SeedLogin = {
  kind: SigeKind;
  fullName: string;
  username: string;
  /** The initial password is the document number (OD-2). */
  password: string;
};

export type SeedResult = {
  institutionId: string;
  logins: SeedLogin[];
  rootCreated: boolean;
  /** The schedule generation outcome; null when the institution already had slots. */
  schedule: GenerateScheduleResult | null;
};

/** Demo root credentials and when they may be used (R1: no default superadmin outside dev/test). */
export const DEMO_ROOT_EMAIL = "root@sige.local";
export const DEMO_ROOT_PASSWORD = "Root-Demo-2026!";

export type ResolvedRoot = { root: SeedRoot; passwordSource: "env" | "demo-default" };

/**
 * Resolves the root account from the environment. The built-in demo password is allowed only when
 * NODE_ENV is development/test or `forceDemo` is set; otherwise SEED_ROOT_PASSWORD is required.
 */
export function resolveSeedRoot(opts: {
  env: Record<string, string | undefined>;
  nodeEnv: string | undefined;
  forceDemo: boolean;
}): ResolvedRoot {
  const { env, nodeEnv, forceDemo } = opts;
  const email = env.SEED_ROOT_EMAIL?.trim() || DEMO_ROOT_EMAIL;
  const name = "Administrador SIGE";
  if (env.SEED_ROOT_PASSWORD) {
    return { root: { email, password: env.SEED_ROOT_PASSWORD, name }, passwordSource: "env" };
  }
  if (forceDemo || nodeEnv === "development" || nodeEnv === "test") {
    return {
      root: { email, password: DEMO_ROOT_PASSWORD, name },
      passwordSource: "demo-default",
    };
  }
  throw new Error(
    "SEED_ROOT_PASSWORD is required outside development/test (pass --force-demo to use the demo password).",
  );
}

async function assertProperRoot(
  database: Database,
  existing: { id: string; role: string | null },
  email: string,
): Promise<void> {
  if (existing.role !== "superadmin") {
    throw new Error(
      `Seed root ${email} already exists but is not a superadmin; resolve it manually (the seed never promotes accounts).`,
    );
  }
  const [credential] = await database
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, existing.id), eq(schema.account.providerId, "credential")))
    .limit(1);
  if (!credential) {
    throw new Error(
      `Seed root ${email} is a superadmin but has no credential account; resolve it manually.`,
    );
  }
}

export async function seedSige(
  deps: { database: Database; auditLogger: AuditLogger },
  { root }: { root: SeedRoot },
): Promise<SeedResult> {
  const { database, auditLogger } = deps;
  const rootEmail = root.email.trim().toLowerCase();

  // 1. Root platform admin (superadmin), found by email.
  const [existingRoot] = await database
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.email, rootEmail))
    .limit(1);
  let rootId = existingRoot?.id;
  if (existingRoot) await assertProperRoot(database, existingRoot, rootEmail);
  const rootCreated = rootId === undefined;
  if (rootId === undefined) {
    rootId = crypto.randomUUID();
    const passwordHash = await hashPassword(root.password);
    await database.transaction(async (tx) => {
      await tx.insert(schema.user).values({
        id: rootId as string,
        name: root.name,
        email: rootEmail,
        emailVerified: true,
        role: "superadmin",
      });
      await tx.insert(schema.account).values({
        id: crypto.randomUUID(),
        accountId: rootId as string,
        providerId: "credential",
        userId: rootId as string,
        password: passwordHash,
      });
    });
  }

  const provisionDeps = {
    database,
    // Same hasher better-auth uses for credential accounts (see createInstitution).
    auth: { $context: Promise.resolve({ password: { hash: hashPassword } }) },
    auditLogger,
  };
  const actor = { userId: rootId };

  // 2. Demo institution and its rector (owner), found by slug.
  const [rector, ...others] = DEMO_PEOPLE;
  if (!rector) throw new Error("DEMO_PEOPLE must start with the rector.");
  let [org] = await database
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, DEMO_INSTITUTION.slug))
    .limit(1);
  if (!org) {
    const created = await createInstitution(
      { database, auditLogger },
      {
        name: DEMO_INSTITUTION.name,
        profile: { ...DEMO_PROFILE, academicYear: DEMO_ACADEMIC_YEAR },
        rector: {
          firstName: rector.firstName,
          lastName: rector.lastName,
          documentType: "CC",
          documentNumber: rector.documentNumber,
          mustChangePassword: false,
        },
        actor,
      },
    );
    org = { id: created.institution.id };
  }
  const organizationId = org.id;

  // 2b. Demo structure (P1): campuses, levels, courses, subjects, periods and criteria.
  await seedInstitutionStructure(database, organizationId);

  // 3. One login per remaining kind, found by document number inside the institution.
  const logins: SeedLogin[] = [];
  const teachers: DemoPerson[] = NEW_DEMO_TEACHERS.map((t) => ({ ...t, kind: "teacher" }));
  for (const demo of [rector, ...others, ...teachers]) {
    let [row] = await database
      .select({ username: schema.user.username })
      .from(schema.person)
      .innerJoin(schema.user, eq(schema.user.id, schema.person.userId))
      .where(
        and(
          eq(schema.person.organizationId, organizationId),
          eq(schema.person.documentNumber, demo.documentNumber),
        ),
      )
      .limit(1);
    if (!row) {
      const provisioned = await provisionUser(provisionDeps, {
        organizationId,
        role: demo.kind as ProvisionInput["role"],
        firstName: demo.firstName,
        lastName: demo.lastName,
        documentType: "CC",
        documentNumber: demo.documentNumber,
        mustChangePassword: false,
        actor: "system",
      });
      row = { username: provisioned.username };
    }
    logins.push({
      kind: demo.kind,
      fullName: `${demo.firstName} ${demo.lastName}`,
      username: row.username ?? "",
      password: demo.documentNumber,
    });
  }

  // 4. Academic offering (P3): classrooms, blocks, 58 offerings with assignments, generated schedule.
  const teacherRows = await database
    .select({ id: schema.person.id, documentNumber: schema.person.documentNumber })
    .from(schema.person)
    .where(eq(schema.person.organizationId, organizationId));
  const personByDocument = new Map(teacherRows.map((row) => [row.documentNumber, row.id]));
  const teacherIds = new Map(
    DEMO_TEACHERS.map((t) => {
      const personId = personByDocument.get(t.documentNumber);
      if (!personId) {
        throw new Error(`Demo teacher ${t.key} has no person with document ${t.documentNumber}`);
      }
      return [t.key, personId] as const;
    }),
  );
  const { generation } = await seedSchedule(database, organizationId, teacherIds);

  return { institutionId: organizationId, logins, rootCreated, schedule: generation };
}

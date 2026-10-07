import type { AuditLogger } from "@base-template/auth/audit";
import { provisionUser } from "@base-template/auth/provision-user";
import type { ProvisionInput } from "@base-template/auth/provision-user";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import type { SigeKind } from "@base-template/sige-core";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { createInstitution } from "./create-institution";

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

export type SeedResult = { institutionId: string; logins: SeedLogin[]; rootCreated: boolean };

export async function seedSige(
  deps: { database: Database; auditLogger: AuditLogger },
  { root }: { root: SeedRoot },
): Promise<SeedResult> {
  const { database, auditLogger } = deps;
  const rootEmail = root.email.trim().toLowerCase();

  // 1. Root platform admin (superadmin), found by email.
  const [existingRoot] = await database
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, rootEmail))
    .limit(1);
  let rootId = existingRoot?.id;
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

  // 3. One login per remaining kind, found by document number inside the institution.
  const logins: SeedLogin[] = [];
  for (const demo of [rector, ...others]) {
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

  return { institutionId: organizationId, logins, rootCreated };
}

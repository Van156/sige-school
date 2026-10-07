import { createAuth } from "@base-template/auth";
import { provisionUser } from "@base-template/auth/provision-user";
import type { ProvisionableRole } from "@base-template/auth/provision-user";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  truncateAllTables,
} from "@base-template/auth/testing";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, describe } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "../../authorization";
import type { Context } from "../../context";
import { createBetterAuthPlatformAdmin } from "../../platform-admin";

/** Every SIGE built-in role a caller can hold inside an institution (sige/00 R1.4). */
export const SIGE_TEST_ROLES = [
  "owner",
  "admin",
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
] as const satisfies readonly ProvisionableRole[];
export type SigeTestRole = (typeof SIGE_TEST_ROLES)[number];

export type TestPerson = {
  role: SigeTestRole;
  userId: string;
  personId: string;
  username: string;
  documentNumber: string;
};

/** One provisioned institution: an organization plus one person per requested role. */
export type TestTenant = {
  orgId: string;
  slug: string;
  people: Partial<Record<SigeTestRole, TestPerson>>;
};

export type SigeTestFixture = {
  db: Database;
  /** Creates an institution and provisions one person per role through `provisionUser`. */
  provisionTenant(
    label: string,
    roles: readonly SigeTestRole[],
    overrides?: { mustChangePassword?: boolean },
  ): Promise<TestTenant>;
  /** Real request context (better-auth session, authorization port) for a provisioned person. */
  contextFor(person: TestPerson, tenant: TestTenant): Promise<Context>;
};

/**
 * Shared Postgres-backed fixture for the SIGE harnesses (sige/00 R1.13, R3.3). Registers a
 * `describe` that skips cleanly when no test database is reachable (fails loudly in CI), truncates
 * all tables once before the suite, and hands `body` a fixture. Use via `await sigeSuite(...)` at
 * module top level.
 */
export async function sigeSuite(
  name: string,
  body: (fixture: SigeTestFixture) => void,
): Promise<void> {
  const url = resolveTestDatabaseUrl();
  const reachable = await requireTestDatabaseOrSkip(url, name);

  describe.skipIf(!reachable)(name, () => {
    let handle: TestDatabaseHandle;
    let auth: ReturnType<typeof createAuth>;
    let helpers: TestHelpers;
    const auditLogger = new RecordingAuditLogger();
    let tenantCounter = 0;

    beforeAll(async () => {
      handle = createTestDatabase(url);
      auth = createAuth(
        {
          BETTER_AUTH_URL: "http://localhost:3000",
          BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
          CORS_ORIGIN: "http://localhost:3001",
          DEFAULT_MAX_ORGS_PER_USER: 3,
        },
        handle.db,
        new RecordingEmailSender(),
        auditLogger,
        { extraPlugins: [testUtils()] },
      );
      helpers = ((await auth.$context) as unknown as { test: TestHelpers }).test;
      await truncateAllTables(handle.db);
    });

    afterAll(async () => {
      await handle.close();
    });

    const fixture: SigeTestFixture = {
      get db() {
        return handle.db;
      },
      async provisionTenant(label, roles, overrides = {}) {
        tenantCounter += 1;
        const slug = `${label.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`;
        const orgId = `org-${slug}`;
        await handle.db.insert(schema.organization).values({ id: orgId, name: label, slug });
        const people: TestTenant["people"] = {};
        for (const [index, role] of roles.entries()) {
          // Digits unique per tenant and role, so no identifier of one tenant appears in another.
          const documentNumber = `${tenantCounter}${String(index + 1).padStart(2, "0")}${String(
            Date.now() % 1_000_000,
          ).padStart(6, "0")}`;
          const result = await provisionUser(
            { database: handle.db, auth, auditLogger },
            {
              organizationId: orgId,
              role,
              firstName: role,
              lastName: label,
              documentType: "CC",
              documentNumber,
              mustChangePassword: overrides.mustChangePassword ?? false,
              actor: "system",
            },
          );
          people[role] = {
            role,
            userId: result.userId,
            personId: result.personId,
            username: result.username,
            documentNumber,
          };
        }
        return { orgId, slug, people };
      },
      async contextFor(person, tenant) {
        const { headers } = await helpers.login({
          userId: person.userId,
          session: { activeOrganizationId: tenant.orgId },
        });
        return {
          db: handle.db,
          session: await auth.api.getSession({ headers }),
          headers,
          authorization: createBetterAuthAuthorization(auth),
          platformAdmin: createBetterAuthPlatformAdmin(auth),
          auditLogger,
          defaultMaxOrganizationsPerUser: 3,
        };
      },
    };

    body(fixture);
  });
}

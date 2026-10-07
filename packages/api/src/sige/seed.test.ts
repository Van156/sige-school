import { RecordingAuditLogger } from "@base-template/auth/testing";
import { resolveTestDatabaseUrl, truncateAllTables } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { DEMO_INSTITUTION, resolveSeedRoot, seedSige } from "./seed";

/** SIGE P0 seed (sige/00 §9, R4): idempotent root + demo institution + one login per kind. */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "seedSige (R4)");

describe.skipIf(!reachable)("seedSige (R4)", () => {
  let handle: TestDatabaseHandle;
  const auditLogger = new RecordingAuditLogger();
  const root = { email: "root@sige.test", password: "Root-Demo-2026!", name: "Root SIGE" };

  beforeAll(async () => {
    handle = createTestDatabase(url);
    await truncateAllTables(handle.db);
  });
  afterAll(async () => {
    await truncateAllTables(handle.db);
    await handle.close();
  });

  async function counts() {
    const [users, persons, orgs, members] = await Promise.all([
      handle.db.select().from(schema.user),
      handle.db.select().from(schema.person),
      handle.db.select().from(schema.organization),
      handle.db.select().from(schema.member),
    ]);
    return [users.length, persons.length, orgs.length, members.length];
  }

  test("creates the root, the demo institution and one login per kind; second run adds nothing", async () => {
    const first = await seedSige({ database: handle.db, auditLogger }, { root });
    expect(first.logins.map((login) => login.kind)).toEqual([
      "owner",
      "admin",
      "coordinator",
      "teacher",
      "student",
      "parent",
      "viewer",
    ]);
    const [rootUser] = await handle.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, root.email));
    expect(rootUser?.role).toBe("superadmin");
    const [org] = await handle.db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.slug, DEMO_INSTITUTION.slug));
    expect(org?.name).toBe(DEMO_INSTITUTION.name);
    const people = await handle.db.select().from(schema.person);
    expect(people.every((p) => p.mustChangePassword === false)).toBe(true);

    const before = await counts();
    const second = await seedSige({ database: handle.db, auditLogger }, { root });
    expect(await counts()).toEqual(before);
    expect(second.logins).toEqual(first.logins);
  });

  test("fails clearly when the root email belongs to a non-superadmin user", async () => {
    await truncateAllTables(handle.db);
    const id = crypto.randomUUID();
    await handle.db.insert(schema.user).values({
      id,
      name: "Impostor",
      email: root.email,
      emailVerified: true,
      role: "user",
    });
    await expect(seedSige({ database: handle.db, auditLogger }, { root })).rejects.toThrow(
      /not a superadmin/i,
    );
    const [row] = await handle.db.select().from(schema.user).where(eq(schema.user.id, id));
    expect(row?.role).toBe("user");
  });

  test("fails clearly when the root superadmin has no credential account", async () => {
    await truncateAllTables(handle.db);
    await handle.db.insert(schema.user).values({
      id: crypto.randomUUID(),
      name: "No credential",
      email: root.email,
      emailVerified: true,
      role: "superadmin",
    });
    await expect(seedSige({ database: handle.db, auditLogger }, { root })).rejects.toThrow(
      /credential account/i,
    );
  });

  test("an existing proper root is a no-op", async () => {
    await truncateAllTables(handle.db);
    await seedSige({ database: handle.db, auditLogger }, { root });
    const before = await counts();
    const again = await seedSige({ database: handle.db, auditLogger }, { root });
    expect(again.rootCreated).toBe(false);
    expect(await counts()).toEqual(before);
  });
});

describe("resolveSeedRoot (R1)", () => {
  test("uses SEED_ROOT_PASSWORD from the env in any environment", () => {
    const r = resolveSeedRoot({
      env: { SEED_ROOT_PASSWORD: "s3cret" },
      nodeEnv: "production",
      forceDemo: false,
    });
    expect(r.passwordSource).toBe("env");
    expect(r.root.password).toBe("s3cret");
  });
  test("allows the demo default only in development/test or with --force-demo", () => {
    for (const nodeEnv of ["development", "test"]) {
      expect(resolveSeedRoot({ env: {}, nodeEnv, forceDemo: false }).passwordSource).toBe(
        "demo-default",
      );
    }
    expect(resolveSeedRoot({ env: {}, nodeEnv: "staging", forceDemo: true }).passwordSource).toBe(
      "demo-default",
    );
  });
  test("refuses the demo default elsewhere", () => {
    expect(() => resolveSeedRoot({ env: {}, nodeEnv: "staging", forceDemo: false })).toThrow(
      /SEED_ROOT_PASSWORD is required/,
    );
    expect(() => resolveSeedRoot({ env: {}, nodeEnv: undefined, forceDemo: false })).toThrow();
  });
});

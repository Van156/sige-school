import { RecordingAuditLogger } from "@base-template/auth/testing";
import { resolveTestDatabaseUrl, truncateAllTables } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { DEMO_INSTITUTION, resolveSeedRoot, seedSige } from "./seed";
import { regenerateSlots } from "./schedule-generation";
import { DEMO_OFFERINGS, NEW_DEMO_TEACHERS } from "./seed-schedule";

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
      ...NEW_DEMO_TEACHERS.map(() => "teacher" as const),
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

  test("seeds teachers, classrooms, blocks, 58 offerings and a conflict-free schedule (P3, D7)", async () => {
    await truncateAllTables(handle.db);
    const started = performance.now();
    const first = await seedSige({ database: handle.db, auditLogger }, { root });
    const elapsedMs = performance.now() - started;
    expect(elapsedMs).toBeLessThan(60_000); // R4.6

    expect(first.logins.filter((login) => login.kind === "teacher")).toHaveLength(12);
    expect(first.schedule?.conflicts).toBe(0);
    expect(first.schedule?.skipped).toEqual([]);
    expect(first.schedule?.courses).toBe(6);

    const [org] = await handle.db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.slug, DEMO_INSTITUTION.slug));
    const orgId = org?.id ?? "";
    const snapshot = async () => {
      const where = <T extends { organizationId: unknown }>(t: T) =>
        eq(t.organizationId as never, orgId);
      const [offerings, assignments, classrooms, blocks, slots] = await Promise.all([
        handle.db.select().from(schema.offering).where(where(schema.offering)),
        handle.db.select().from(schema.teacherAssignment).where(where(schema.teacherAssignment)),
        handle.db.select().from(schema.classroom).where(where(schema.classroom)),
        handle.db.select().from(schema.timeBlock).where(where(schema.timeBlock)),
        handle.db.select().from(schema.scheduleSlot).where(where(schema.scheduleSlot)),
      ]);
      return { offerings, assignments, classrooms, blocks, slots };
    };
    const before = await snapshot();
    expect(DEMO_OFFERINGS).toHaveLength(58);
    expect(before.offerings).toHaveLength(58);
    expect(before.assignments).toHaveLength(58);
    expect(before.assignments.every((a) => a.status === "activo")).toBe(true);
    expect(before.classrooms).toHaveLength(14);
    expect(before.blocks).toHaveLength(15);
    // Every offering has all its weekly hours placed (0 conflicts means none was dropped).
    for (const offering of before.offerings) {
      const placed = before.slots.filter((slot) => slot.offeringId === offering.id).length;
      expect(placed).toBe(offering.hoursPerWeek);
    }
    expect(before.slots.length).toBe(before.offerings.reduce((n, o) => n + o.hoursPerWeek, 0));

    // A second run is idempotent: same counts, slots untouched, no generation.
    const second = await seedSige({ database: handle.db, auditLogger }, { root });
    expect(second.schedule).toBeNull();
    const after = await snapshot();
    expect(after.offerings).toHaveLength(58);
    expect(after.assignments).toHaveLength(58);
    expect(after.classrooms).toHaveLength(14);
    expect(after.blocks).toHaveLength(15);
    expect(after.slots.map((s) => s.id).sort()).toEqual(before.slots.map((s) => s.id).sort());

    // Regenerating gives the same slot set (the solver is deterministic) with no exclusion violation.
    const key = (s: (typeof before.slots)[number]) =>
      [s.courseId, s.offeringId, s.classroomId, s.dayOfWeek, s.startTime, s.endTime].join("|");
    const regenerated = await handle.db.transaction((tx) => regenerateSlots(tx, orgId, {}));
    expect(regenerated.conflicts).toBe(0);
    const again = await snapshot();
    expect(again.slots.map(key).sort()).toEqual(before.slots.map(key).sort());

    // Teacher logins follow R4.3: document as password, must_change_password false.
    const people = await handle.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.organizationId, orgId));
    const teacherLogins = first.logins.filter((login) => login.kind === "teacher");
    expect(teacherLogins.every((login) => /^[a-z]+\d{4}$/.test(login.username))).toBe(true);
    expect(
      people.filter((p) => teacherLogins.some((l) => l.password === p.documentNumber)),
    ).toHaveLength(12);
    expect(people.every((p) => p.mustChangePassword === false)).toBe(true);
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

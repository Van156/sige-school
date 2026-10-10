import { resolveTestDatabaseUrl, truncateAllTables } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createScopePolicy } from "./scope";
import type { CallerKind, ScopePolicy } from "./scope";
import { createSigeScopeResolvers } from "./scope-resolvers";

/** Offering row scope (sige/00 §4.3, D3) against a real Postgres. */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "offering scope (P3)");

describe.skipIf(!reachable)("offering scope", () => {
  let handle: TestDatabaseHandle;
  const orgA = "org-scope-a";
  const orgB = "org-scope-b";

  type World = {
    teacherA: string;
    teacherB: string;
    offerings: Record<"activo" | "temporal" | "inactivo" | "other" | "foreign", string>;
  };
  let world: World;

  beforeAll(() => {
    handle = createTestDatabase(url);
  });
  afterAll(async () => {
    await truncateAllTables(handle.db);
    await handle.close();
  });

  async function seedOrg(organizationId: string, tag: string) {
    const db = handle.db;
    await db.insert(schema.organization).values({ id: organizationId, name: tag, slug: tag });
    const [campus] = await db
      .insert(schema.campus)
      .values({ organizationId, name: `Sede ${tag}` })
      .returning();
    const [course] = await db
      .insert(schema.course)
      .values({
        organizationId,
        campusId: campus!.id,
        name: "6-01",
        academicYear: "2026",
        shift: "Mañana",
      })
      .returning();
    const subjects = await db
      .insert(schema.subject)
      .values(["Mat", "Ing", "Cien", "Art", "Eti"].map((name) => ({ organizationId, name })))
      .returning();
    const people = [];
    for (const index of [0, 1]) {
      const userId = `u-${tag}-${index}`;
      await db.insert(schema.user).values({ id: userId, name: "T", email: `${userId}@x.test` });
      const [person] = await db
        .insert(schema.person)
        .values({
          organizationId,
          userId,
          firstName: "T",
          lastName: `T${index}`,
          documentNumber: `${tag}-${index}`,
        })
        .returning();
      people.push(person!);
    }
    return { courseId: course!.id, subjects, people };
  }

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    const a = await seedOrg(orgA, "a");
    const b = await seedOrg(orgB, "b");
    const teacherA = a.people[0]!.id;
    const teacherB = a.people[1]!.id;
    const make = async (
      organizationId: string,
      courseId: string,
      subjectId: string,
      teacherPersonId: string,
      status?: "activo" | "temporal" | "inactivo",
    ) => {
      const [row] = await handle.db
        .insert(schema.offering)
        .values({ organizationId, courseId, subjectId, teacherPersonId })
        .returning();
      if (status) {
        await handle.db.insert(schema.teacherAssignment).values({
          organizationId,
          offeringId: row!.id,
          teacherPersonId,
          academicYear: "2026",
          assignmentDate: "2026-02-01",
          status,
        });
      }
      return row!.id;
    };
    world = {
      teacherA,
      teacherB,
      offerings: {
        activo: await make(orgA, a.courseId, a.subjects[0]!.id, teacherA, "activo"),
        temporal: await make(orgA, a.courseId, a.subjects[1]!.id, teacherA, "temporal"),
        inactivo: await make(orgA, a.courseId, a.subjects[2]!.id, teacherA, "inactivo"),
        other: await make(orgA, a.courseId, a.subjects[3]!.id, teacherB, "activo"),
        foreign: await make(orgB, b.courseId, b.subjects[0]!.id, b.people[0]!.id, "activo"),
      },
    };
    // An offering of teacher A without any assignment row is not in scope either.
    await make(orgA, a.courseId, a.subjects[4]!.id, teacherA);
  });

  const policyFor = (kind: CallerKind, personId: string): ScopePolicy =>
    createScopePolicy(
      { kind, organizationId: orgA, personId },
      createSigeScopeResolvers(handle.db),
    );

  async function visibleIds(policy: ScopePolicy): Promise<string[]> {
    const rows = await handle.db
      .select({ id: schema.offering.id })
      .from(schema.offering)
      .where(and(eq(schema.offering.organizationId, orgA), policy.offeringWhere()));
    return rows.map((row) => row.id).sort();
  }

  test("teacher A sees own activo and temporal offerings, not inactivo nor teacher B's", async () => {
    const policy = policyFor("teacher", world.teacherA);
    expect(await visibleIds(policy)).toEqual(
      [world.offerings.activo, world.offerings.temporal].sort(),
    );
    await policy.assertOffering(world.offerings.activo);
    await policy.assertOffering(world.offerings.temporal);
    for (const hidden of [
      world.offerings.inactivo,
      world.offerings.other,
      world.offerings.foreign,
    ]) {
      await expect(policy.assertOffering(hidden)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  test("teacher B sees only own offering", async () => {
    const policy = policyFor("teacher", world.teacherB);
    expect(await visibleIds(policy)).toEqual([world.offerings.other]);
    await expect(policy.assertOffering(world.offerings.activo)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("managers see the whole tenant but never another one", async () => {
    const policy = policyFor("coordinator", world.teacherA);
    expect(await visibleIds(policy)).toHaveLength(5);
    await policy.assertOffering(world.offerings.inactivo);
    await expect(policy.assertOffering(world.offerings.foreign)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test.each(["student", "parent"] as const)("%s fails closed until P4", async (kind) => {
    const policy = policyFor(kind, world.teacherA);
    expect(await visibleIds(policy)).toEqual([]);
    await expect(policy.assertOffering(world.offerings.activo)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

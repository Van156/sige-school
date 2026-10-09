import { RecordingAuditLogger } from "@base-template/auth/testing";
import { resolveTestDatabaseUrl, truncateAllTables } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { sumWeights } from "@base-template/sige-core";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedSige } from "./seed";
import { DEMO_ACADEMIC_YEAR, seedInstitutionStructure } from "./seed-structure";

/** P1 seed (sige/00 §9 R4.2): demo institution structure, idempotent. */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "seedInstitutionStructure (R4.2)");

describe.skipIf(!reachable)("seedInstitutionStructure (R4.2)", () => {
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

  async function snapshot(organizationId: string) {
    const where = <T extends { organizationId: unknown }>(t: T) =>
      eq(t.organizationId as never, organizationId);
    const db = handle.db;
    return {
      profile: await db
        .select()
        .from(schema.institutionProfile)
        .where(where(schema.institutionProfile)),
      campuses: await db.select().from(schema.campus).where(where(schema.campus)),
      levels: await db.select().from(schema.gradeLevel).where(where(schema.gradeLevel)),
      courses: await db.select().from(schema.course).where(where(schema.course)),
      subjects: await db.select().from(schema.subject).where(where(schema.subject)),
      periods: await db.select().from(schema.academicPeriod).where(where(schema.academicPeriod)),
      criteria: await db.select().from(schema.gradeCriterion).where(where(schema.gradeCriterion)),
    };
  }

  test("loads the demo structure and a second run changes nothing", async () => {
    const first = await seedSige({ database: handle.db, auditLogger }, { root });
    const orgId = first.institutionId;
    const s = await snapshot(orgId);

    expect(s.profile).toHaveLength(1);
    expect(s.profile[0]?.currentAcademicYear).toBe(DEMO_ACADEMIC_YEAR);

    expect(s.campuses).toHaveLength(3);
    expect(s.campuses.filter((c) => c.active)).toHaveLength(2);
    expect(s.campuses.filter((c) => !c.active)).toHaveLength(1);
    expect(s.campuses.filter((c) => c.isMain)).toHaveLength(1);
    expect(s.campuses.find((c) => c.isMain)?.active).toBe(true);

    expect(s.levels).toHaveLength(5);
    expect(s.courses).toHaveLength(6);
    const levelCampus = new Map(s.levels.map((l) => [l.id, l.campusId]));
    for (const c of s.courses) {
      expect(c.levelId).not.toBeNull();
      expect(levelCampus.get(c.levelId as string)).toBe(c.campusId);
      expect(c.academicYear).toBe(DEMO_ACADEMIC_YEAR);
    }
    expect(s.subjects).toHaveLength(10);

    expect(s.periods).toHaveLength(4);
    expect(s.periods.map((p) => p.orderNum).sort()).toEqual([1, 2, 3, 4]);
    const active = s.periods.filter((p) => p.isActive);
    expect(active).toHaveLength(1);
    expect(active[0]?.shortName).toBe("P4");

    expect(s.criteria.map((c) => Number(c.weight)).sort((a, b) => a - b)).toEqual([20, 20, 30, 30]);
    expect(sumWeights(s.criteria.map((c) => Number(c.weight)))).toBe(100);

    const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
    await seedSige({ database: handle.db, auditLogger }, { root });
    await seedInstitutionStructure(handle.db, orgId);
    const again = await snapshot(orgId);
    expect(ids(again.campuses)).toEqual(ids(s.campuses));
    expect(ids(again.levels)).toEqual(ids(s.levels));
    expect(ids(again.courses)).toEqual(ids(s.courses));
    expect(ids(again.subjects)).toEqual(ids(s.subjects));
    expect(ids(again.periods)).toEqual(ids(s.periods));
    expect(ids(again.criteria)).toEqual(ids(s.criteria));
    expect(again.profile).toHaveLength(1);
  });
});

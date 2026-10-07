import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createTestDatabase, requireTestDatabaseOrSkip, resolveTestDatabaseUrl } from "../testing";
import type { TestDatabaseHandle } from "../testing";
import { organization, user } from "./auth";
import {
  academicPeriod,
  campus,
  CAMPUS_CODE_UNIQUE,
  CAMPUS_MAIN_UNIQUE,
  COURSE_LEVEL_CAMPUS_FK,
  COURSE_UNIQUE,
  course,
  gradeCriterion,
  gradeLevel,
  institutionProfile,
  PERIOD_ACTIVE_UNIQUE,
  PERIOD_ORDER_UNIQUE,
  PERIOD_SHORT_NAME_UNIQUE,
  INSTITUTION_NIT_UNIQUE,
  LEVEL_NAME_UNIQUE,
  subject,
  SUBJECT_CODE_UNIQUE,
} from "./institution";
import { person } from "./person";

/** Constraint-level behavior of sige/02 §2 against a real Postgres. */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "institution schema");

type PgFailure = { code?: string; constraint?: string };

/** Runs `work` and returns the Postgres error (unwrapping Drizzle's `cause`), or `null`. */
async function pgFailure(work: () => Promise<unknown>): Promise<PgFailure | null> {
  try {
    await work();
    return null;
  } catch (error) {
    const wrapped = error as PgFailure & { cause?: PgFailure };
    return wrapped.code ? wrapped : (wrapped.cause ?? wrapped);
  }
}

describe.skipIf(!reachable)("institution schema constraints (sige/02 §2)", () => {
  let handle: TestDatabaseHandle;
  const marker = crypto.randomUUID().slice(0, 8);
  const orgA = `org-a-${marker}`;
  const orgB = `org-b-${marker}`;
  const orgIds = [orgA, orgB];

  const cleanup = async () => {
    for (const id of orgIds) {
      await handle.db.execute(sql`delete from "organization" where id = ${id}`);
    }
    await handle.db.execute(sql`delete from "user" where id like ${`u-${marker}%`}`);
  };

  beforeAll(async () => {
    handle = createTestDatabase(url);
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    await handle.close();
  });
  beforeEach(async () => {
    await cleanup();
    await handle.db.insert(organization).values([
      { id: orgA, name: "Colegio A", slug: `a-${marker}` },
      { id: orgB, name: "Colegio B", slug: `b-${marker}` },
    ]);
  });

  const db = () => handle.db;
  const newCampus = async (
    organizationId: string,
    overrides: Partial<typeof campus.$inferInsert> = {},
  ) => {
    const [row] = await db()
      .insert(campus)
      .values({ organizationId, name: "Sede", ...overrides })
      .returning();
    return row!;
  };
  const newLevel = async (organizationId: string, campusId: string, name = "Primaria") => {
    const [row] = await db()
      .insert(gradeLevel)
      .values({ organizationId, campusId, name })
      .returning();
    return row!;
  };
  const courseValues = (campusId: string, extra: Partial<typeof course.$inferInsert> = {}) => ({
    organizationId: orgA,
    campusId,
    name: "5A",
    academicYear: "2026",
    shift: "Mañana" as const,
    ...extra,
  });
  const periodValues = (extra: Partial<typeof academicPeriod.$inferInsert> = {}) => ({
    organizationId: orgA,
    academicYear: "2026",
    orderNum: 1,
    name: "Primer periodo",
    shortName: "P1",
    startDate: "2026-01-20",
    endDate: "2026-03-31",
    ...extra,
  });

  test("campus defaults: jornada completa, active, not main", async () => {
    const row = await newCampus(orgA);
    expect(row).toMatchObject({ jornada: "completa", active: true, isMain: false });
  });

  test("a second main campus in one institution is rejected; another institution may have one", async () => {
    await newCampus(orgA, { isMain: true, name: "Principal" });
    const failure = await pgFailure(() => newCampus(orgA, { isMain: true, name: "Otra" }));
    expect(failure).toMatchObject({ code: "23505", constraint: CAMPUS_MAIN_UNIQUE });
    await newCampus(orgB, { isMain: true });
  });

  test("campus code is unique per institution, null codes repeat", async () => {
    await newCampus(orgA, { code: "N" });
    await newCampus(orgA, { name: "x" });
    await newCampus(orgA, { name: "y" });
    await newCampus(orgB, { code: "N" });
    const failure = await pgFailure(() => newCampus(orgA, { code: "N", name: "z" }));
    expect(failure).toMatchObject({ code: "23505", constraint: CAMPUS_CODE_UNIQUE });
  });

  test("level name is unique per campus", async () => {
    const c = await newCampus(orgA);
    await newLevel(orgA, c.id);
    const failure = await pgFailure(() => newLevel(orgA, c.id));
    expect(failure).toMatchObject({ code: "23505", constraint: LEVEL_NAME_UNIQUE });
  });

  test("level order_num cannot be negative", async () => {
    const c = await newCampus(orgA);
    const failure = await pgFailure(() =>
      db()
        .insert(gradeLevel)
        .values({ organizationId: orgA, campusId: c.id, name: "x", orderNum: -1 }),
    );
    expect(failure?.code).toBe("23514");
  });

  test("a course cannot use a level of another campus", async () => {
    const c1 = await newCampus(orgA, { name: "S1" });
    const c2 = await newCampus(orgA, { name: "S2" });
    const levelOfC1 = await newLevel(orgA, c1.id);
    const failure = await pgFailure(() =>
      db()
        .insert(course)
        .values(courseValues(c2.id, { levelId: levelOfC1.id })),
    );
    expect(failure).toMatchObject({ code: "23503", constraint: COURSE_LEVEL_CAMPUS_FK });
    await db()
      .insert(course)
      .values(courseValues(c1.id, { levelId: levelOfC1.id }));
    await db()
      .insert(course)
      .values(courseValues(c2.id, { name: "5B" }));
  });

  test("course uniqueness (campus, name, year, shift) and capacity bounds", async () => {
    const c = await newCampus(orgA);
    await db().insert(course).values(courseValues(c.id));
    expect(await pgFailure(() => db().insert(course).values(courseValues(c.id)))).toMatchObject({
      code: "23505",
      constraint: COURSE_UNIQUE,
    });
    await db()
      .insert(course)
      .values(courseValues(c.id, { shift: "Tarde" }));
    for (const maxStudents of [0, 61]) {
      const failure = await pgFailure(() =>
        db()
          .insert(course)
          .values(courseValues(c.id, { name: `c${maxStudents}`, maxStudents })),
      );
      expect(failure?.code).toBe("23514");
    }
    for (const maxStudents of [1, 60]) {
      await db()
        .insert(course)
        .values(courseValues(c.id, { name: `ok${maxStudents}`, maxStudents }));
    }
    const [defaulted] = await db()
      .insert(course)
      .values(courseValues(c.id, { name: "def" }))
      .returning();
    expect(defaulted?.maxStudents).toBe(40);
  });

  test("a director must be a person of the same institution", async () => {
    const userId = `u-${marker}-1`;
    await db()
      .insert(user)
      .values({ id: userId, name: "T", email: `${userId}@x.test` });
    const [other] = await db()
      .insert(person)
      .values({
        organizationId: orgB,
        userId,
        firstName: "T",
        lastName: "T",
        documentNumber: "12345",
      })
      .returning();
    const c = await newCampus(orgA);
    const failure = await pgFailure(() =>
      db()
        .insert(course)
        .values(courseValues(c.id, { directorPersonId: other!.id })),
    );
    expect(failure?.code).toBe("23503");
  });

  test("cross-tenant parents are impossible", async () => {
    const campusB = await newCampus(orgB);
    const levelFailure = await pgFailure(() =>
      db().insert(gradeLevel).values({ organizationId: orgA, campusId: campusB.id, name: "x" }),
    );
    expect(levelFailure?.code).toBe("23503");
    const courseFailure = await pgFailure(() =>
      db().insert(course).values(courseValues(campusB.id)),
    );
    expect(courseFailure?.code).toBe("23503");
  });

  test("a campus with a level cannot be deleted; without dependents it can", async () => {
    const c = await newCampus(orgA);
    const lonely = await newCampus(orgA, { name: "lonely" });
    await newLevel(orgA, c.id);
    const failure = await pgFailure(() => db().execute(sql`delete from campus where id = ${c.id}`));
    // ON DELETE RESTRICT raises restrict_violation (23001), not foreign_key_violation (23503).
    expect(failure?.code).toBe("23001");
    await db().execute(sql`delete from campus where id = ${lonely.id}`);
  });

  test("a level with courses cannot be deleted", async () => {
    const c = await newCampus(orgA);
    const l = await newLevel(orgA, c.id);
    await db()
      .insert(course)
      .values(courseValues(c.id, { levelId: l.id }));
    const failure = await pgFailure(() =>
      db().execute(sql`delete from grade_level where id = ${l.id}`),
    );
    expect(failure?.code).toBe("23001");
  });

  test("period dates: start must be strictly before end", async () => {
    for (const endDate of ["2026-01-20", "2026-01-01"]) {
      const failure = await pgFailure(() =>
        db().insert(academicPeriod).values(periodValues({ endDate })),
      );
      expect(failure?.code).toBe("23514");
    }
    await db().insert(academicPeriod).values(periodValues());
  });

  test("period order is 1..4 and unique per year (D6)", async () => {
    for (const orderNum of [0, 5]) {
      const failure = await pgFailure(() =>
        db()
          .insert(academicPeriod)
          .values(periodValues({ orderNum, shortName: `P${orderNum}` })),
      );
      expect(failure?.code).toBe("23514");
    }
    await db().insert(academicPeriod).values(periodValues());
    const dup = await pgFailure(() =>
      db()
        .insert(academicPeriod)
        .values(periodValues({ shortName: "PX" })),
    );
    expect(dup).toMatchObject({ code: "23505", constraint: PERIOD_ORDER_UNIQUE });
    await db()
      .insert(academicPeriod)
      .values(
        periodValues({ academicYear: "2027", startDate: "2027-01-20", endDate: "2027-03-31" }),
      );
  });

  test("period short name is unique per year", async () => {
    await db().insert(academicPeriod).values(periodValues());
    const failure = await pgFailure(() =>
      db()
        .insert(academicPeriod)
        .values(periodValues({ orderNum: 2 })),
    );
    expect(failure).toMatchObject({ code: "23505", constraint: PERIOD_SHORT_NAME_UNIQUE });
  });

  test("only one active period per institution", async () => {
    await db()
      .insert(academicPeriod)
      .values(periodValues({ isActive: true }));
    const failure = await pgFailure(() =>
      db()
        .insert(academicPeriod)
        .values(periodValues({ orderNum: 2, shortName: "P2", isActive: true })),
    );
    expect(failure).toMatchObject({ code: "23505", constraint: PERIOD_ACTIVE_UNIQUE });
    await db()
      .insert(academicPeriod)
      .values(periodValues({ orderNum: 2, shortName: "P2" }));
    await db()
      .insert(academicPeriod)
      .values({ ...periodValues({ isActive: true }), organizationId: orgB });
  });

  test("criterion weight bounds: 0 and 100.01 rejected, 0.01 and 100 accepted", async () => {
    const insert = (weight: string, orderNum: number) =>
      db()
        .insert(gradeCriterion)
        .values({ organizationId: orgA, name: `c${orderNum}`, weight, orderNum });
    for (const [i, weight] of ["0", "-1", "100.01"].entries()) {
      expect((await pgFailure(() => insert(weight, i + 1)))?.code).toBe("23514");
    }
    await insert("0.01", 1);
    await insert("100", 2);
    expect(
      (
        await pgFailure(() =>
          db()
            .insert(gradeCriterion)
            .values({ organizationId: orgA, name: "o", weight: "10", orderNum: 0 }),
        )
      )?.code,
    ).toBe("23514");
  });

  test("subject code is unique per institution when present", async () => {
    await db()
      .insert(subject)
      .values([
        { organizationId: orgA, name: "Mat", code: "MAT" },
        { organizationId: orgA, name: "Sin 1" },
        { organizationId: orgA, name: "Sin 2" },
        { organizationId: orgB, name: "Mat", code: "MAT" },
      ]);
    const failure = await pgFailure(() =>
      db().insert(subject).values({ organizationId: orgA, name: "Otra", code: "MAT" }),
    );
    expect(failure).toMatchObject({ code: "23505", constraint: SUBJECT_CODE_UNIQUE });
  });

  test("institution profile: unique NIT, year format, defaults, one per organization", async () => {
    const [profile] = await db()
      .insert(institutionProfile)
      .values({ organizationId: orgA, nit: "900123", currentAcademicYear: "2026" })
      .returning();
    expect(profile?.timezone).toBe("America/Bogota");
    const dup = await pgFailure(() =>
      db()
        .insert(institutionProfile)
        .values({ organizationId: orgB, nit: "900123", currentAcademicYear: "2026" }),
    );
    expect(dup).toMatchObject({ code: "23505", constraint: INSTITUTION_NIT_UNIQUE });
    const badYear = await pgFailure(() =>
      db().insert(institutionProfile).values({ organizationId: orgB, currentAcademicYear: "26" }),
    );
    expect(badYear?.code).toBe("23514");
    const [withDefaultYear] = await db()
      .insert(institutionProfile)
      .values({ organizationId: orgB })
      .returning();
    expect(withDefaultYear?.currentAcademicYear).toMatch(/^\d{4}$/);
  });

  test("deleting an institution with no dependents cascades its structure", async () => {
    const c = await newCampus(orgA);
    await db()
      .insert(institutionProfile)
      .values({ organizationId: orgA, currentAcademicYear: "2026" });
    await db().insert(subject).values({ organizationId: orgA, name: "Mat" });
    await db().insert(academicPeriod).values(periodValues());
    await db()
      .insert(gradeCriterion)
      .values({ organizationId: orgA, name: "c", weight: "100", orderNum: 1 });
    await db().execute(sql`delete from "organization" where id = ${orgA}`);
    const rows = await db().execute(sql`select count(*)::int as n from campus where id = ${c.id}`);
    expect(rows.rows[0]).toEqual({ n: 0 });
  });
});

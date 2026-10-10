import { RecordingAuditLogger } from "@base-template/auth/testing";
import { resolveTestDatabaseUrl, truncateAllTables } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import { DEMO_INSTITUTION, DEMO_PEOPLE, seedSige } from "./seed";
import { DEMO_GUARDIANS, DEMO_STUDENTS } from "./seed-students";

/** P4 seed (sige/00 §9 R4.2, D4): 40 active + 1 retirado + 1 graduado students, guardians, enrollments. */

const JULIAN_DOCUMENT = "1000000005";
const PATRICIA_DOCUMENT = "1000000006";

/** Active students per real seed course (prototype groups mapped per D4: 1-01→3-01, 11-01→10-01). */
const ACTIVE_PER_COURSE: Record<string, number> = {
  "6-01": 8,
  "6-02": 7,
  "7-01": 7,
  "10-01": 7,
  "3-01": 6,
  "5-01": 5,
};

describe("demo students and guardians (D4)", () => {
  test("40 active students plus one retirado and one graduado, Julián López among the active", () => {
    const byStatus = (status: string) => DEMO_STUDENTS.filter((s) => s.status === status);
    expect(byStatus("activo")).toHaveLength(40);
    expect(byStatus("retirado").map((s) => s.course)).toEqual(["6-02"]);
    expect(byStatus("graduado").map((s) => s.course)).toEqual(["10-01"]);
    const julian = DEMO_STUDENTS.find((s) => s.documentNumber === JULIAN_DOCUMENT);
    expect(julian).toMatchObject({ firstName: "Julián", lastName: "López", status: "activo" });
    const perCourse: Record<string, number> = {};
    for (const s of byStatus("activo")) perCourse[s.course] = (perCourse[s.course] ?? 0) + 1;
    expect(perCourse).toEqual(ACTIVE_PER_COURSE);
    expect(new Set(DEMO_STUDENTS.map((s) => s.documentNumber)).size).toBe(DEMO_STUDENTS.length);
  });

  test("26 guardians: Patricia Gómez, 3 with two children, 8 students with two guardians", () => {
    expect(DEMO_GUARDIANS).toHaveLength(26);
    const patricia = DEMO_GUARDIANS.find((g) => g.documentNumber === PATRICIA_DOCUMENT);
    expect(patricia).toMatchObject({ firstName: "Patricia", lastName: "Gómez" });
    expect(DEMO_GUARDIANS.filter((g) => g.children.length === 2)).toHaveLength(3);
    const documents = new Set(DEMO_STUDENTS.map((s) => s.documentNumber));
    const guardiansPerStudent = new Map<string, number>();
    for (const guardian of DEMO_GUARDIANS) {
      for (const child of guardian.children) {
        expect(documents.has(child.student)).toBe(true);
        guardiansPerStudent.set(child.student, (guardiansPerStudent.get(child.student) ?? 0) + 1);
      }
    }
    expect([...guardiansPerStudent.values()].filter((n) => n === 2)).toHaveLength(8);
    const inactive = DEMO_STUDENTS.filter((s) => s.status !== "activo").map(
      (s) => s.documentNumber,
    );
    expect(inactive.some((doc) => guardiansPerStudent.has(doc))).toBe(false);
  });
});

const url = resolveTestDatabaseUrl();
// The full demo seed provisions ≈ 85 logins (one password hash each); R4.6 targets < 60 s.
setDefaultTimeout(60_000);
const reachable = await requireTestDatabaseOrSkip(url, "seedSige students (R4.2)");

describe.skipIf(!reachable)("seedSige students, guardians and enrollments (R4.2, D4)", () => {
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

  async function organizationId() {
    const [org] = await handle.db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.slug, DEMO_INSTITUTION.slug));
    return org?.id ?? "";
  }

  async function snapshot() {
    const [users, persons, students, links, enrollments] = await Promise.all([
      handle.db.select({ id: schema.user.id }).from(schema.user),
      handle.db.select({ id: schema.person.id }).from(schema.person),
      handle.db.select({ id: schema.student.id }).from(schema.student),
      handle.db.select({ id: schema.studentGuardian.id }).from(schema.studentGuardian),
      handle.db.select({ id: schema.enrollment.id }).from(schema.enrollment),
    ]);
    const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();
    return {
      users: ids(users),
      persons: ids(persons),
      students: ids(students),
      links: ids(links),
      enrollments: ids(enrollments),
    };
  }

  async function assertDataset(orgId: string) {
    const students = await handle.db
      .select({
        id: schema.student.id,
        status: schema.student.status,
        course: schema.course.name,
        campusId: schema.student.campusId,
        courseCampusId: schema.course.campusId,
        documentNumber: schema.person.documentNumber,
        enrolledYear: schema.student.enrolledYear,
        guardianName: schema.student.guardianName,
      })
      .from(schema.student)
      .innerJoin(schema.person, eq(schema.person.id, schema.student.personId))
      .innerJoin(schema.course, eq(schema.course.id, schema.student.courseId))
      .where(eq(schema.student.organizationId, orgId));
    expect(students).toHaveLength(42);
    expect(students.every((s) => s.campusId === s.courseCampusId)).toBe(true);
    expect(students.every((s) => s.enrolledYear === "2026")).toBe(true);
    const active = students.filter((s) => s.status === "activo");
    expect(active).toHaveLength(40);
    const perCourse: Record<string, number> = {};
    for (const s of active) perCourse[s.course] = (perCourse[s.course] ?? 0) + 1;
    expect(perCourse).toEqual(ACTIVE_PER_COURSE);
    expect(students.filter((s) => s.status === "retirado").map((s) => s.course)).toEqual(["6-02"]);
    expect(students.filter((s) => s.status === "graduado").map((s) => s.course)).toEqual(["10-01"]);
    expect(students.find((s) => s.documentNumber === "1000000235")?.guardianName).toBe(
      "Patricia Gómez",
    );

    // Julián López keeps his P0 person and login; his profile is one of the 40.
    const julian = students.find((s) => s.documentNumber === JULIAN_DOCUMENT);
    expect(julian?.status).toBe("activo");
    const julianPeople = await handle.db
      .select()
      .from(schema.person)
      .where(
        and(
          eq(schema.person.organizationId, orgId),
          eq(schema.person.documentNumber, JULIAN_DOCUMENT),
        ),
      );
    expect(julianPeople).toHaveLength(1);

    // Guardians: 26 parent persons, 29 links; Patricia Gómez is the guardian of Isabella Gómez.
    const links = await handle.db
      .select({
        guardianDocument: schema.person.documentNumber,
        studentId: schema.studentGuardian.studentId,
        relationship: schema.studentGuardian.relationship,
      })
      .from(schema.studentGuardian)
      .innerJoin(schema.person, eq(schema.person.id, schema.studentGuardian.guardianPersonId))
      .where(eq(schema.studentGuardian.organizationId, orgId));
    expect(links).toHaveLength(29);
    expect(new Set(links.map((l) => l.guardianDocument)).size).toBe(26);
    const isabella = students.find((s) => s.documentNumber === "1000000235");
    expect(
      links.filter((l) => l.guardianDocument === PATRICIA_DOCUMENT).map((l) => l.studentId),
    ).toEqual([isabella?.id ?? "missing"]);
    const parentMembers = await handle.db
      .select({ documentNumber: schema.person.documentNumber })
      .from(schema.person)
      .innerJoin(
        schema.member,
        and(
          eq(schema.member.userId, schema.person.userId),
          eq(schema.member.organizationId, orgId),
        ),
      )
      .where(and(eq(schema.person.organizationId, orgId), eq(schema.member.role, "parent")));
    expect(parentMembers.map((p) => p.documentNumber).sort()).toEqual(
      DEMO_GUARDIANS.map((g) => g.documentNumber).sort(),
    );

    // Bulk enrollment (SCH-R5): every active student × every offering of their course, once.
    const offerings = await handle.db
      .select({ id: schema.offering.id, courseId: schema.offering.courseId })
      .from(schema.offering)
      .where(eq(schema.offering.organizationId, orgId));
    const studentCourse = await handle.db
      .select({ id: schema.student.id, courseId: schema.student.courseId })
      .from(schema.student)
      .where(eq(schema.student.organizationId, orgId));
    const courseOf = new Map(studentCourse.map((s) => [s.id, s.courseId]));
    const expected = active.flatMap((s) =>
      offerings.filter((o) => o.courseId === courseOf.get(s.id)).map((o) => `${s.id}|${o.id}|2026`),
    );
    const enrollments = await handle.db
      .select()
      .from(schema.enrollment)
      .where(eq(schema.enrollment.organizationId, orgId));
    expect(
      enrollments.map((e) => `${e.studentId}|${e.offeringId}|${e.academicYear}`).sort(),
    ).toEqual(expected.sort());
    expect(enrollments.every((e) => e.status === "activa")).toBe(true);
  }

  test("seeds the students, guardians and enrollments; a second run creates nothing", async () => {
    const first = await seedSige({ database: handle.db, auditLogger }, { root });
    const orgId = await organizationId();
    await assertDataset(orgId);

    // Seeded logins follow R4.3 (document as password) and are printed with the demo logins.
    const students = first.logins.filter((login) => login.kind === "student");
    const parents = first.logins.filter((login) => login.kind === "parent");
    expect(students).toHaveLength(42);
    expect(parents).toHaveLength(26);
    expect(new Set(first.logins.map((login) => login.username)).size).toBe(first.logins.length);
    expect(students.map((l) => l.password).sort()).toEqual(
      DEMO_STUDENTS.map((s) => s.documentNumber).sort(),
    );

    const before = await snapshot();
    const second = await seedSige({ database: handle.db, auditLogger }, { root });
    expect(await snapshot()).toEqual(before);
    expect(second.logins).toEqual(first.logins);
  });

  test("runs on a P3-seeded database (no students, guardians or enrollments yet)", async () => {
    await truncateAllTables(handle.db);
    await seedSige({ database: handle.db, auditLogger }, { root });
    const orgId = await organizationId();
    // Roll back to the P3 dataset: drop every P4 row and the logins it created.
    const p0Documents = new Set(DEMO_PEOPLE.map((p) => p.documentNumber));
    const p4Documents = [...DEMO_STUDENTS, ...DEMO_GUARDIANS]
      .map((p) => p.documentNumber)
      .filter((doc) => !p0Documents.has(doc));
    const p4People = await handle.db
      .select({ id: schema.person.id, userId: schema.person.userId })
      .from(schema.person)
      .where(
        and(
          eq(schema.person.organizationId, orgId),
          inArray(schema.person.documentNumber, p4Documents),
        ),
      );
    expect(p4People).toHaveLength(p4Documents.length);
    await handle.db.delete(schema.enrollment);
    await handle.db.delete(schema.studentGuardian);
    await handle.db.delete(schema.student);
    await handle.db.delete(schema.person).where(
      inArray(
        schema.person.id,
        p4People.map((p) => p.id),
      ),
    );
    await handle.db.delete(schema.user).where(
      inArray(
        schema.user.id,
        p4People.map((p) => p.userId),
      ),
    );

    await seedSige({ database: handle.db, auditLogger }, { root });
    await assertDataset(orgId);
  });
});

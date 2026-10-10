import { resolveTestDatabaseUrl, truncateAllTables } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { resolveCallerKind } from "./procedure";
import { createScopePolicy } from "./scope";
import type { CallerKind, ScopePolicy } from "./scope";
import { createSigeScopeResolvers } from "./scope-resolvers";

/** Student and portal offering row scope (sige/00 §4.3, sige/05 STU-R1, D2) on a real Postgres. */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "student scope (P4)");

type CourseKey = "activo" | "temporal" | "inactivo" | "directed" | "other" | "foreign";
type StudentKey = CourseKey | "noCourse";

describe.skipIf(!reachable)("student scope", () => {
  let handle: TestDatabaseHandle;
  const orgA = "org-stu-scope-a";
  const orgB = "org-stu-scope-b";

  type World = {
    teacher: string;
    director: string;
    selfStudent: string;
    parent: string;
    courses: Record<CourseKey, string>;
    offerings: Record<CourseKey, string>;
    students: Record<StudentKey, string>;
  };
  let world: World;
  let counter = 0;

  beforeAll(() => {
    handle = createTestDatabase(url);
  });
  afterAll(async () => {
    await truncateAllTables(handle.db);
    await handle.close();
  });

  async function makePerson(organizationId: string): Promise<string> {
    counter += 1;
    const userId = `u-stu-scope-${counter}`;
    await handle.db
      .insert(schema.user)
      .values({ id: userId, name: "P", email: `${userId}@x.test` });
    const [row] = await handle.db
      .insert(schema.person)
      .values({
        organizationId,
        userId,
        firstName: "P",
        lastName: `P${counter}`,
        documentNumber: `doc-${counter}`,
      })
      .returning();
    return row!.id;
  }

  async function makeCourse(organizationId: string, campusId: string, name: string) {
    const [row] = await handle.db
      .insert(schema.course)
      .values({ organizationId, campusId, name, academicYear: "2026", shift: "Mañana" })
      .returning();
    return row!.id;
  }

  async function makeOffering(
    organizationId: string,
    courseId: string,
    teacherPersonId: string,
    status: "activo" | "temporal" | "inactivo",
  ) {
    const [subject] = await handle.db
      .insert(schema.subject)
      .values({ organizationId, name: `S${(counter += 1)}` })
      .returning();
    const [row] = await handle.db
      .insert(schema.offering)
      .values({ organizationId, courseId, subjectId: subject!.id, teacherPersonId })
      .returning();
    await handle.db.insert(schema.teacherAssignment).values({
      organizationId,
      offeringId: row!.id,
      teacherPersonId,
      academicYear: "2026",
      assignmentDate: "2026-02-01",
      status,
    });
    return row!.id;
  }

  async function makeStudent(
    organizationId: string,
    campusId: string,
    courseId: string | null,
    personId?: string,
  ) {
    const [row] = await handle.db
      .insert(schema.student)
      .values({
        organizationId,
        personId: personId ?? (await makePerson(organizationId)),
        campusId,
        courseId,
        enrolledYear: "2026",
      })
      .returning();
    return row!.id;
  }

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    for (const [id, slug] of [
      [orgA, "stu-a"],
      [orgB, "stu-b"],
    ] as const) {
      await handle.db.insert(schema.organization).values({ id, name: slug, slug });
    }
    const [campusA] = await handle.db
      .insert(schema.campus)
      .values({ organizationId: orgA, name: "Sede A" })
      .returning();
    const [campusB] = await handle.db
      .insert(schema.campus)
      .values({ organizationId: orgB, name: "Sede B" })
      .returning();
    const a = campusA!.id;

    const teacher = await makePerson(orgA);
    const director = await makePerson(orgA);
    const otherTeacher = await makePerson(orgA);
    const foreignTeacher = await makePerson(orgB);

    const courses: Record<CourseKey, string> = {
      activo: await makeCourse(orgA, a, "6-01"),
      temporal: await makeCourse(orgA, a, "6-02"),
      inactivo: await makeCourse(orgA, a, "6-03"),
      directed: await makeCourse(orgA, a, "6-04"),
      other: await makeCourse(orgA, a, "6-05"),
      foreign: await makeCourse(orgB, campusB!.id, "6-01"),
    };
    // The director-only teacher has no offering; `teacher` also directs nothing.
    await handle.db
      .update(schema.course)
      .set({ directorPersonId: director })
      .where(eq(schema.course.id, courses.directed));

    const offerings: Record<CourseKey, string> = {
      activo: await makeOffering(orgA, courses.activo, teacher, "activo"),
      temporal: await makeOffering(orgA, courses.temporal, teacher, "temporal"),
      inactivo: await makeOffering(orgA, courses.inactivo, teacher, "inactivo"),
      directed: await makeOffering(orgA, courses.directed, otherTeacher, "activo"),
      other: await makeOffering(orgA, courses.other, otherTeacher, "activo"),
      foreign: await makeOffering(orgB, courses.foreign, foreignTeacher, "activo"),
    };

    const selfStudent = await makePerson(orgA);
    const students: Record<StudentKey, string> = {
      activo: await makeStudent(orgA, a, courses.activo, selfStudent),
      temporal: await makeStudent(orgA, a, courses.temporal),
      inactivo: await makeStudent(orgA, a, courses.inactivo),
      directed: await makeStudent(orgA, a, courses.directed),
      other: await makeStudent(orgA, a, courses.other),
      noCourse: await makeStudent(orgA, a, null),
      foreign: await makeStudent(orgB, campusB!.id, courses.foreign),
    };

    // The parent's children: one in "temporal", one in "other", one without a course.
    const parent = await makePerson(orgA);
    await handle.db.insert(schema.studentGuardian).values(
      [students.temporal, students.other, students.noCourse].map((studentId) => ({
        organizationId: orgA,
        studentId,
        guardianPersonId: parent,
        relationship: "Madre" as const,
      })),
    );

    world = { teacher, director, selfStudent, parent, courses, offerings, students };
  });

  const policyFor = (kind: CallerKind, personId: string): ScopePolicy =>
    createScopePolicy(
      { kind, organizationId: orgA, personId },
      createSigeScopeResolvers(handle.db),
    );

  async function visibleStudents(policy: ScopePolicy): Promise<string[]> {
    const rows = await handle.db
      .select({ id: schema.student.id })
      .from(schema.student)
      .where(and(eq(schema.student.organizationId, orgA), policy.studentWhere()));
    return rows.map((row) => row.id).sort();
  }

  async function visibleOfferings(policy: ScopePolicy): Promise<string[]> {
    const rows = await handle.db
      .select({ id: schema.offering.id })
      .from(schema.offering)
      .where(and(eq(schema.offering.organizationId, orgA), policy.offeringWhere()));
    return rows.map((row) => row.id).sort();
  }

  async function expectStudents(policy: ScopePolicy, visible: StudentKey[]) {
    expect(await visibleStudents(policy)).toEqual(visible.map((key) => world.students[key]).sort());
    const all = Object.keys(world.students) as StudentKey[];
    for (const key of all) {
      const check = policy.assertStudent(world.students[key]);
      if (visible.includes(key)) {
        await check;
      } else {
        await expect(check).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
    }
  }

  /**
   * One `attendance_record`, `observation` and `grade_record` per course key, so the D4 row
   * predicates can be checked over real rows of the P5 tables.
   */
  async function seedAcademicRows(): Promise<Record<string, string>> {
    const [period] = await handle.db
      .insert(schema.academicPeriod)
      .values({
        organizationId: orgA,
        academicYear: "2026",
        orderNum: 1,
        name: "Primer Periodo",
        shortName: "P1",
        startDate: "2026-01-15",
        endDate: "2026-03-20",
      })
      .returning();
    const [criterion] = await handle.db
      .insert(schema.gradeCriterion)
      .values({ organizationId: orgA, name: "Seguimiento", weight: "100.00", orderNum: 1 })
      .returning();
    const ids: Record<string, string> = {};
    for (const key of ["activo", "temporal", "directed", "other"] as const) {
      const studentId = world.students[key];
      const offeringId = world.offerings[key];
      const [attendance] = await handle.db
        .insert(schema.attendanceRecord)
        .values({
          organizationId: orgA,
          studentId,
          offeringId,
          date: "2026-02-02",
          status: "presente",
          recordedBy: world.teacher,
        })
        .returning();
      ids[`attendance:${key}`] = attendance!.id;
      const [grade] = await handle.db
        .insert(schema.gradeRecord)
        .values({
          organizationId: orgA,
          studentId,
          offeringId,
          periodId: period!.id,
          criterionId: criterion!.id,
          score: "4.00",
          createdBy: world.teacher,
          updatedBy: world.teacher,
        })
        .returning();
      ids[`grade:${key}`] = grade!.id;
    }
    for (const key of ["activo", "temporal", "directed", "other", "noCourse"] as const) {
      const [row] = await handle.db
        .insert(schema.observation)
        .values({
          organizationId: orgA,
          studentId: world.students[key],
          authorPersonId: world.teacher,
          type: "seguimiento",
          description: "Nota de seguimiento.",
          observedAt: new Date("2026-02-02T13:00:00Z"),
        })
        .returning();
      ids[`observation:${key}`] = row!.id;
    }
    return ids;
  }

  /** Ids of `table` visible through `where`, the predicate the policy produced for that table. */
  const visibleRows = async (
    table: typeof schema.attendanceRecord | typeof schema.observation | typeof schema.gradeRecord,
    where: SQL | undefined,
  ) => {
    const rows = await handle.db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.organizationId, orgA), where));
    return rows.map((row) => row.id).sort();
  };

  test("offeringRowWhere filters attendance rows by the caller's offerings (ATT-R5, D4)", async () => {
    const ids = await seedAcademicRows();
    const rowsFor = (policy: ScopePolicy) =>
      visibleRows(
        schema.attendanceRecord,
        policy.offeringRowWhere(schema.attendanceRecord.offeringId),
      );
    // A teacher tallies only their own offerings' rows, so two teachers see different totals.
    expect(await rowsFor(policyFor("teacher", world.teacher))).toEqual(
      [ids["attendance:activo"]!, ids["attendance:temporal"]!].sort(),
    );
    // Directing a course is student scope, not offering scope (STU-R1): no attendance rows.
    expect(await rowsFor(policyFor("teacher", world.director))).toEqual([]);
    expect(await rowsFor(policyFor("coordinator", world.teacher))).toHaveLength(4);
    expect(await rowsFor(policyFor("student", world.selfStudent))).toEqual([
      ids["attendance:activo"]!,
    ]);
    expect(await rowsFor(policyFor("parent", world.parent))).toEqual(
      [ids["attendance:temporal"]!, ids["attendance:other"]!].sort(),
    );
    // `studentSummary` and `history` must agree: one predicate, used by both (ATT-R5).
    const policy = policyFor("teacher", world.teacher);
    const kpis = await handle.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.attendanceRecord)
      .where(
        and(
          eq(schema.attendanceRecord.organizationId, orgA),
          policy.offeringRowWhere(schema.attendanceRecord.offeringId),
        ),
      );
    expect(kpis[0]?.total).toBe((await rowsFor(policy)).length);
  });

  test("an inactivo assignment drops the offering's attendance rows (ATT-R5)", async () => {
    const ids = await seedAcademicRows();
    await handle.db
      .update(schema.teacherAssignment)
      .set({ status: "inactivo" })
      .where(eq(schema.teacherAssignment.offeringId, world.offerings.temporal));
    const policy = policyFor("teacher", world.teacher);
    expect(
      await visibleRows(
        schema.attendanceRecord,
        policy.offeringRowWhere(schema.attendanceRecord.offeringId),
      ),
    ).toEqual([ids["attendance:activo"]!]);
  });

  test("studentRowWhere filters grades and observations by student scope (GRD-08, OBS, D4)", async () => {
    const ids = await seedAcademicRows();
    const observationsFor = (policy: ScopePolicy) =>
      visibleRows(schema.observation, policy.studentRowWhere(schema.observation.studentId));
    expect(await observationsFor(policyFor("teacher", world.teacher))).toEqual(
      [ids["observation:activo"]!, ids["observation:temporal"]!].sort(),
    );
    // The director sees their course's students even without an offering there (OD-21).
    expect(await observationsFor(policyFor("teacher", world.director))).toEqual([
      ids["observation:directed"]!,
    ]);
    expect(await observationsFor(policyFor("coordinator", world.teacher))).toHaveLength(5);
    expect(await observationsFor(policyFor("student", world.selfStudent))).toEqual([
      ids["observation:activo"]!,
    ]);
    // A child without a course still has observations the parent may read (student scope, not
    // offering scope).
    expect(await observationsFor(policyFor("parent", world.parent))).toEqual(
      [
        ids["observation:temporal"]!,
        ids["observation:other"]!,
        ids["observation:noCourse"]!,
      ].sort(),
    );
    const gradePolicy = policyFor("teacher", world.teacher);
    expect(
      await visibleRows(
        schema.gradeRecord,
        gradePolicy.studentRowWhere(schema.gradeRecord.studentId),
      ),
    ).toEqual([ids["grade:activo"]!, ids["grade:temporal"]!].sort());
  });

  test("teacher: students of courses with an activo/temporal offering (D2)", async () => {
    await expectStudents(policyFor("teacher", world.teacher), ["activo", "temporal"]);
  });

  test("director-only teacher: students of the directed course", async () => {
    const policy = policyFor("teacher", world.director);
    await expectStudents(policy, ["directed"]);
    // Directing a course does not add its offerings to the teacher's offering scope.
    expect(await visibleOfferings(policy)).toEqual([]);
  });

  test("deactivating the assignment removes the course's students (STU-R1)", async () => {
    await handle.db
      .update(schema.teacherAssignment)
      .set({ status: "inactivo" })
      .where(eq(schema.teacherAssignment.offeringId, world.offerings.temporal));
    await expectStudents(policyFor("teacher", world.teacher), ["activo"]);
  });

  test("student: own row and own course offerings", async () => {
    const policy = policyFor("student", world.selfStudent);
    await expectStudents(policy, ["activo"]);
    expect(await visibleOfferings(policy)).toEqual([world.offerings.activo]);
    await policy.assertOffering(world.offerings.activo);
    await expect(policy.assertOffering(world.offerings.temporal)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("parent: linked children and their courses' offerings", async () => {
    const policy = policyFor("parent", world.parent);
    await expectStudents(policy, ["temporal", "other", "noCourse"]);
    expect(await visibleOfferings(policy)).toEqual(
      [world.offerings.temporal, world.offerings.other].sort(),
    );
    await expect(policy.assertOffering(world.offerings.foreign)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("a person with no guardian links or profile sees nothing", async () => {
    for (const kind of ["student", "parent"] as const) {
      const policy = policyFor(kind, world.teacher);
      expect(await visibleStudents(policy)).toEqual([]);
      expect(await visibleOfferings(policy)).toEqual([]);
    }
  });

  test("multi-role members get the most restrictive scope", async () => {
    // teacher + parent resolves to parent: the teacher's courses do not leak in.
    const asParent = policyFor(resolveCallerKind("teacher,parent"), world.parent);
    await expectStudents(asParent, ["temporal", "other", "noCourse"]);
    // admin + teacher resolves to teacher: the admin role never lifts the row scope.
    const asTeacher = policyFor(resolveCallerKind("admin,teacher"), world.teacher);
    await expectStudents(asTeacher, ["activo", "temporal"]);
  });

  test("managers see every student of the tenant but never another one", async () => {
    const policy = policyFor("coordinator", world.teacher);
    await expectStudents(policy, [
      "activo",
      "temporal",
      "inactivo",
      "directed",
      "other",
      "noCourse",
    ]);
  });
});

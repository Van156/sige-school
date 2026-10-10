import { resolveTestDatabaseUrl, truncateAllTables } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { and, eq } from "drizzle-orm";
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

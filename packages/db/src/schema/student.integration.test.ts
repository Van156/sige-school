import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { ENROLLMENT_STATUSES } from "@base-template/sige-core/enrollment";
import { GUARDIAN_RELATIONSHIPS, STUDENT_STATUSES } from "@base-template/sige-core/student";

import { createTestDatabase, requireTestDatabaseOrSkip, resolveTestDatabaseUrl } from "../testing";
import type { TestDatabaseHandle } from "../testing";
import { organization, user } from "./auth";
import { COURSE_CAMPUS_ID_UNIQUE, campus, course, subject } from "./institution";
import { person } from "./person";
import {
  ENROLLMENT_FINAL_SCORE_CHECK,
  ENROLLMENT_OFFERING_FK,
  ENROLLMENT_STATUS_NOTE_CHECK,
  ENROLLMENT_STUDENT_FK,
  ENROLLMENT_UNIQUE,
  ENROLLMENT_YEAR_CHECK,
  enrollment,
  enrollmentStatus,
  offering,
} from "./scheduling";
import {
  GUARDIAN_LINK_UNIQUE,
  GUARDIAN_PERSON_FK,
  GUARDIAN_STUDENT_FK,
  STUDENT_CAMPUS_FK,
  STUDENT_COURSE_CAMPUS_FK,
  STUDENT_ENROLLED_YEAR_CHECK,
  STUDENT_PERSON_FK,
  STUDENT_PERSON_UNIQUE,
  STUDENT_STRATUM_CHECK,
  guardianRelationship,
  student,
  studentGuardian,
  studentStatus,
} from "./student";

/** Constraint-level behavior of sige/05 §2 and the sige/04 `enrollment` table against Postgres. */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "student schema");

type PgFailure = { code?: string; constraint?: string };

async function pgFailure(work: () => Promise<unknown>): Promise<PgFailure | null> {
  try {
    await work();
    return null;
  } catch (error) {
    const wrapped = error as PgFailure & { cause?: PgFailure };
    return wrapped.code ? wrapped : (wrapped.cause ?? wrapped);
  }
}

describe("student and enrollment enums", () => {
  test("share the sige-core vocabulary", () => {
    expect(studentStatus.enumValues).toEqual([...STUDENT_STATUSES]);
    expect(guardianRelationship.enumValues).toEqual([...GUARDIAN_RELATIONSHIPS]);
    expect(enrollmentStatus.enumValues).toEqual([...ENROLLMENT_STATUSES]);
  });
});

describe.skipIf(!reachable)("student, guardian and enrollment constraints", () => {
  let handle: TestDatabaseHandle;
  const marker = crypto.randomUUID().slice(0, 8);
  const orgA = `org-sa-${marker}`;
  const orgB = `org-sb-${marker}`;

  type Seed = {
    campusId: string;
    otherCampusId: string;
    courseId: string;
    otherCampusCourseId: string;
    offeringId: string;
    personIds: string[];
  };
  let a: Seed;
  let b: Seed;

  const db = () => handle.db;

  const cleanup = async () => {
    for (const id of [orgA, orgB]) {
      await handle.db.execute(sql`delete from "organization" where id = ${id}`);
    }
    await handle.db.execute(sql`delete from "user" where id like ${`u-${marker}%`}`);
  };

  async function seedOrg(organizationId: string, tag: string): Promise<Seed> {
    const camps = await db()
      .insert(campus)
      .values([
        { organizationId, name: `Sede ${tag} 1` },
        { organizationId, name: `Sede ${tag} 2` },
      ])
      .returning();
    const courses = await db()
      .insert(course)
      .values(
        camps.map((camp) => ({
          organizationId,
          campusId: camp.id,
          name: "6-01",
          academicYear: "2026",
          shift: "Mañana" as const,
        })),
      )
      .returning();
    const [subj] = await db()
      .insert(subject)
      .values({ organizationId, name: "Matemáticas" })
      .returning();
    const [off] = await db()
      .insert(offering)
      .values({ organizationId, courseId: courses[0]!.id, subjectId: subj!.id })
      .returning();
    const personIds: string[] = [];
    for (const index of [0, 1, 2]) {
      const userId = `u-${marker}-${tag}-${index}`;
      await db()
        .insert(user)
        .values({ id: userId, name: "P", email: `${userId}@x.test` });
      const [row] = await db()
        .insert(person)
        .values({
          organizationId,
          userId,
          firstName: "P",
          lastName: `P${index}`,
          documentNumber: `${marker}-${tag}-${index}`,
        })
        .returning();
      personIds.push(row!.id);
    }
    return {
      campusId: camps[0]!.id,
      otherCampusId: camps[1]!.id,
      courseId: courses[0]!.id,
      otherCampusCourseId: courses[1]!.id,
      offeringId: off!.id,
      personIds,
    };
  }

  const studentValues = (extra: Partial<typeof student.$inferInsert> = {}) => ({
    organizationId: orgA,
    personId: a.personIds[0]!,
    campusId: a.campusId,
    courseId: a.courseId,
    enrolledYear: "2026",
    ...extra,
  });

  async function insertStudent(extra: Partial<typeof student.$inferInsert> = {}) {
    const [row] = await db().insert(student).values(studentValues(extra)).returning();
    return row!;
  }

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
    await db()
      .insert(organization)
      .values([
        { id: orgA, name: "Colegio SA", slug: `sa-${marker}` },
        { id: orgB, name: "Colegio SB", slug: `sb-${marker}` },
      ]);
    a = await seedOrg(orgA, "a");
    b = await seedOrg(orgB, "b");
  });

  /* ------------------------------ course ------------------------------ */
  test("course exposes the (organization, campus, id) key the student FK targets", async () => {
    const rows = await db().execute<{ conname: string }>(
      sql`select conname from pg_constraint where conname = ${COURSE_CAMPUS_ID_UNIQUE} and contype = 'u'`,
    );
    expect(rows.rows.map((row) => row.conname)).toEqual([COURSE_CAMPUS_ID_UNIQUE]);
  });

  /* ------------------------------ student ------------------------------ */
  describe("student", () => {
    test("defaults: activo, optional fields null, timestamps", async () => {
      const row = await insertStudent({ courseId: null });
      expect(row).toMatchObject({
        status: "activo",
        courseId: null,
        stratum: null,
        neighborhood: null,
        guardianName: null,
      });
      expect(row.createdAt).toBeInstanceOf(Date);
    });

    test("one profile per person", async () => {
      await insertStudent();
      expect(
        await pgFailure(() =>
          db()
            .insert(student)
            .values(studentValues({ courseId: null })),
        ),
      ).toMatchObject({ code: "23505", constraint: STUDENT_PERSON_UNIQUE });
    });

    test("the course must belong to the student's campus", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(student)
            .values(studentValues({ courseId: a.otherCampusCourseId })),
        ),
      ).toMatchObject({ code: "23503", constraint: STUDENT_COURSE_CAMPUS_FK });
      const row = await insertStudent();
      expect(
        await pgFailure(() =>
          db()
            .update(student)
            .set({ campusId: a.otherCampusId })
            .where(sql`${student.id} = ${row.id}`),
        ),
      ).toMatchObject({ code: "23503", constraint: STUDENT_COURSE_CAMPUS_FK });
      // Moving campus together with a course of the new campus (or none) is fine.
      await db()
        .update(student)
        .set({ campusId: a.otherCampusId, courseId: a.otherCampusCourseId })
        .where(sql`${student.id} = ${row.id}`);
    });

    test("tenant FKs reject another institution's person, campus and course", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(student)
            .values(studentValues({ personId: b.personIds[0]! })),
        ),
      ).toMatchObject({ code: "23503", constraint: STUDENT_PERSON_FK });
      expect(
        await pgFailure(() =>
          db()
            .insert(student)
            .values(studentValues({ campusId: b.campusId, courseId: null })),
        ),
      ).toMatchObject({ code: "23503", constraint: STUDENT_CAMPUS_FK });
      expect(
        await pgFailure(() =>
          db()
            .insert(student)
            .values(studentValues({ courseId: b.courseId })),
        ),
      ).toMatchObject({ code: "23503", constraint: STUDENT_COURSE_CAMPUS_FK });
    });

    test("stratum must be 1..6", async () => {
      for (const stratum of [0, 7]) {
        expect(
          await pgFailure(() => db().insert(student).values(studentValues({ stratum }))),
        ).toMatchObject({ code: "23514", constraint: STUDENT_STRATUM_CHECK });
      }
      const row = await insertStudent({ stratum: 1 });
      await db()
        .update(student)
        .set({ stratum: 6 })
        .where(sql`${student.id} = ${row.id}`);
    });

    test("enrolled_year is a four-digit year", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(student)
            .values(studentValues({ enrolledYear: "26" })),
        ),
      ).toMatchObject({ code: "23514", constraint: STUDENT_ENROLLED_YEAR_CHECK });
    });

    test("a person, campus or course with a student cannot be deleted (restrict)", async () => {
      await insertStudent();
      expect(
        await pgFailure(() =>
          db()
            .delete(person)
            .where(sql`${person.id} = ${a.personIds[0]!}`),
        ),
      ).toMatchObject({ code: "23001", constraint: STUDENT_PERSON_FK });
      // The course's offering would also block it; drop it to isolate the student FK.
      await db()
        .delete(offering)
        .where(sql`${offering.id} = ${a.offeringId}`);
      expect(
        await pgFailure(() =>
          db()
            .delete(course)
            .where(sql`${course.id} = ${a.courseId}`),
        ),
      ).toMatchObject({ code: "23001", constraint: STUDENT_COURSE_CAMPUS_FK });
    });

    test("a campus whose only reference is a student is restricted by the student FK", async () => {
      await insertStudent({ campusId: a.otherCampusId, courseId: null });
      await db()
        .delete(course)
        .where(sql`${course.id} = ${a.otherCampusCourseId}`);
      expect(
        await pgFailure(() =>
          db()
            .delete(campus)
            .where(sql`${campus.id} = ${a.otherCampusId}`),
        ),
      ).toMatchObject({ code: "23001", constraint: STUDENT_CAMPUS_FK });
    });
  });

  /* ------------------------------ student_guardian ------------------------------ */
  describe("student_guardian", () => {
    const linkValues = (
      studentId: string,
      extra: Partial<typeof studentGuardian.$inferInsert> = {},
    ) => ({
      organizationId: orgA,
      studentId,
      guardianPersonId: a.personIds[1]!,
      relationship: "Madre" as const,
      ...extra,
    });

    test("a guardian is linked to a student once", async () => {
      const row = await insertStudent();
      const [link] = await db().insert(studentGuardian).values(linkValues(row.id)).returning();
      expect(link).toMatchObject({ relationship: "Madre" });
      expect(link?.createdAt).toBeInstanceOf(Date);
      expect(
        await pgFailure(() =>
          db()
            .insert(studentGuardian)
            .values(linkValues(row.id, { relationship: "Padre" })),
        ),
      ).toMatchObject({ code: "23505", constraint: GUARDIAN_LINK_UNIQUE });
    });

    test("tenant FKs reject another institution's student and guardian", async () => {
      const row = await insertStudent();
      expect(
        await pgFailure(() =>
          db()
            .insert(studentGuardian)
            .values(linkValues(row.id, { guardianPersonId: b.personIds[1]! })),
        ),
      ).toMatchObject({ code: "23503", constraint: GUARDIAN_PERSON_FK });
      expect(
        await pgFailure(() =>
          db()
            .insert(studentGuardian)
            .values(
              linkValues(row.id, { organizationId: orgB, guardianPersonId: b.personIds[1]! }),
            ),
        ),
      ).toMatchObject({ code: "23503", constraint: GUARDIAN_STUDENT_FK });
    });

    test("deleting the student cascades its links; the guardian person is restricted", async () => {
      const row = await insertStudent();
      await db().insert(studentGuardian).values(linkValues(row.id));
      expect(
        await pgFailure(() =>
          db()
            .delete(person)
            .where(sql`${person.id} = ${a.personIds[1]!}`),
        ),
      ).toMatchObject({ code: "23001", constraint: GUARDIAN_PERSON_FK });
      await db()
        .delete(student)
        .where(sql`${student.id} = ${row.id}`);
      const remaining = await db()
        .select()
        .from(studentGuardian)
        .where(sql`${studentGuardian.studentId} = ${row.id}`);
      expect(remaining).toEqual([]);
    });
  });

  /* ------------------------------ enrollment ------------------------------ */
  describe("enrollment", () => {
    let studentId: string;
    beforeEach(async () => {
      studentId = (await insertStudent()).id;
    });

    const values = (extra: Partial<typeof enrollment.$inferInsert> = {}) => ({
      organizationId: orgA,
      studentId,
      offeringId: a.offeringId,
      academicYear: "2026",
      ...extra,
    });

    test("defaults: activa, today, no score or note", async () => {
      const [row] = await db().insert(enrollment).values(values()).returning();
      expect(row).toMatchObject({ status: "activa", finalScore: null, statusNote: null });
      expect(row?.enrollmentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("(student, offering, academic_year) is unique", async () => {
      await db().insert(enrollment).values(values());
      expect(await pgFailure(() => db().insert(enrollment).values(values()))).toMatchObject({
        code: "23505",
        constraint: ENROLLMENT_UNIQUE,
      });
      await db()
        .insert(enrollment)
        .values(values({ academicYear: "2027" }));
    });

    test("final_score must be 1..5 with two decimals", async () => {
      for (const finalScore of ["0.99", "5.01"]) {
        expect(
          await pgFailure(() => db().insert(enrollment).values(values({ finalScore }))),
        ).toMatchObject({ code: "23514", constraint: ENROLLMENT_FINAL_SCORE_CHECK });
      }
      const [row] = await db()
        .insert(enrollment)
        .values(values({ finalScore: "4.5" }))
        .returning();
      expect(row?.finalScore).toBe("4.50");
      await db()
        .update(enrollment)
        .set({ finalScore: "1" })
        .where(sql`${enrollment.id} = ${row!.id}`);
      await db()
        .update(enrollment)
        .set({ finalScore: "5" })
        .where(sql`${enrollment.id} = ${row!.id}`);
    });

    test("status_note is at most 500 characters", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(enrollment)
            .values(values({ statusNote: "x".repeat(501) })),
        ),
      ).toMatchObject({ code: "23514", constraint: ENROLLMENT_STATUS_NOTE_CHECK });
      await db()
        .insert(enrollment)
        .values(values({ statusNote: "x".repeat(500) }));
    });

    test("academic_year is a four-digit year", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(enrollment)
            .values(values({ academicYear: "2026-1" })),
        ),
      ).toMatchObject({ code: "23514", constraint: ENROLLMENT_YEAR_CHECK });
    });

    test("tenant FKs reject another institution's student and offering", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(enrollment)
            .values(values({ offeringId: b.offeringId })),
        ),
      ).toMatchObject({ code: "23503", constraint: ENROLLMENT_OFFERING_FK });
      expect(
        await pgFailure(() =>
          db()
            .insert(enrollment)
            .values(values({ organizationId: orgB, offeringId: b.offeringId })),
        ),
      ).toMatchObject({ code: "23503", constraint: ENROLLMENT_STUDENT_FK });
    });

    test("an offering or a student with enrollments cannot be deleted (restrict)", async () => {
      await db().insert(enrollment).values(values());
      expect(
        await pgFailure(() =>
          db()
            .delete(offering)
            .where(sql`${offering.id} = ${a.offeringId}`),
        ),
      ).toMatchObject({ code: "23001", constraint: ENROLLMENT_OFFERING_FK });
      expect(
        await pgFailure(() =>
          db()
            .delete(student)
            .where(sql`${student.id} = ${studentId}`),
        ),
      ).toMatchObject({ code: "23001", constraint: ENROLLMENT_STUDENT_FK });
    });

    test("deleting the organization removes students, links and enrollments", async () => {
      await db().insert(enrollment).values(values());
      await db().insert(studentGuardian).values({
        organizationId: orgA,
        studentId,
        guardianPersonId: a.personIds[1]!,
        relationship: "Padre",
      });
      await db().execute(sql`delete from "organization" where id = ${orgA}`);
      const left = await db().execute<{ count: string }>(
        sql`select count(*)::text as count from "student" where organization_id = ${orgA}`,
      );
      expect(left.rows[0]?.count).toBe("0");
    });
  });
});

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { ATTENDANCE_STATUSES } from "@base-template/sige-core/attendance";
import { FINAL_STATUSES } from "@base-template/sige-core/grading";
import {
  OBSERVATION_TYPE_CODES,
  requiresNotification,
} from "@base-template/sige-core/observations";
import { SIGE_RULES } from "@base-template/sige-core/rules";

import { createTestDatabase, requireTestDatabaseOrSkip, resolveTestDatabaseUrl } from "../testing";
import type { TestDatabaseHandle } from "../testing";
import {
  ATTENDANCE_RECORD_OBSERVATION_CHECK,
  ATTENDANCE_RECORD_OFFERING_FK,
  ATTENDANCE_RECORD_RECORDED_BY_FK,
  ATTENDANCE_RECORD_STUDENT_FK,
  ATTENDANCE_RECORD_UNIQUE,
  ATTENDANCE_RECORD_WEEKDAY_CHECK,
  FINAL_GRADE_OFFERING_FK,
  FINAL_GRADE_PERIOD_FK,
  FINAL_GRADE_SCORE_CHECK,
  FINAL_GRADE_STUDENT_FK,
  FINAL_GRADE_UNIQUE,
  GRADE_RECORD_CREATED_BY_FK,
  GRADE_RECORD_CRITERION_FK,
  GRADE_RECORD_OBSERVATION_CHECK,
  GRADE_RECORD_OFFERING_FK,
  GRADE_RECORD_PERIOD_FK,
  GRADE_RECORD_SCORE_CHECK,
  GRADE_RECORD_STUDENT_FK,
  GRADE_RECORD_UNIQUE,
  GRADE_RECORD_UPDATED_BY_FK,
  OBSERVATION_AUTHOR_FK,
  OBSERVATION_COMMITMENTS_CHECK,
  OBSERVATION_DESCRIPTION_CHECK,
  OBSERVATION_NOTIFIED_BY_FK,
  OBSERVATION_NOTIFIED_CHECK,
  OBSERVATION_PENDING_INDEX,
  OBSERVATION_STUDENT_FK,
  PERIOD_LOCK_LOCKED_BY_FK,
  PERIOD_LOCK_OFFERING_FK,
  PERIOD_LOCK_PERIOD_FK,
  PERIOD_LOCK_UNIQUE,
  attendanceRecord,
  attendanceStatus,
  finalGrade,
  finalGradeStatus,
  gradeRecord,
  observation,
  observationType,
  periodLock,
} from "./academic";
import { organization, user } from "./auth";
import { academicPeriod, campus, course, gradeCriterion, subject } from "./institution";
import { person } from "./person";
import { offering } from "./scheduling";
import { student } from "./student";

/** Constraint-level behavior of sige/06 §2, sige/07 §2 and sige/08 §2 against a real Postgres. */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "academic schema");

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

/** Calendar days of one week in 2026, so the isodow check is exercised on fixed weekdays. */
const MONDAY = "2026-03-02";
const SATURDAY = "2026-03-07";
const SUNDAY = "2026-03-08";
const NEXT_MONDAY = "2026-03-09";

describe("academic enums", () => {
  test("share the sige-core vocabulary", () => {
    expect(attendanceStatus.enumValues).toEqual([...ATTENDANCE_STATUSES]);
    expect(observationType.enumValues).toEqual([...OBSERVATION_TYPE_CODES]);
    expect(finalGradeStatus.enumValues).toEqual([...FINAL_STATUSES]);
  });

  test("final_grade_status carries `no evaluado` for the read models (06 §2)", () => {
    expect(finalGradeStatus.enumValues).toContain("no evaluado");
  });
});

describe.skipIf(!reachable)("grade, lock, final, attendance and observation constraints", () => {
  let handle: TestDatabaseHandle;
  const marker = crypto.randomUUID().slice(0, 8);
  const orgA = `org-aa-${marker}`;
  const orgB = `org-ab-${marker}`;

  type Seed = {
    offeringId: string;
    otherOfferingId: string;
    periodId: string;
    otherPeriodId: string;
    criterionId: string;
    otherCriterionId: string;
    /** 0, 1: the students' own persons; 2, 3: staff (teacher, coordinator). */
    personIds: string[];
    studentIds: string[];
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
    const [camp] = await db()
      .insert(campus)
      .values({ organizationId, name: `Sede ${tag}` })
      .returning();
    const [grp] = await db()
      .insert(course)
      .values({
        organizationId,
        campusId: camp!.id,
        name: "6-01",
        academicYear: "2026",
        shift: "Mañana",
      })
      .returning();
    const subjects = await db()
      .insert(subject)
      .values([
        { organizationId, name: "Matemáticas" },
        { organizationId, name: "Lengua" },
      ])
      .returning();
    const offerings = await db()
      .insert(offering)
      .values(subjects.map((subj) => ({ organizationId, courseId: grp!.id, subjectId: subj.id })))
      .returning();
    const periods = await db()
      .insert(academicPeriod)
      .values([
        {
          organizationId,
          academicYear: "2026",
          orderNum: 1,
          name: "Primer Periodo",
          shortName: "P1",
          startDate: "2026-01-20",
          endDate: "2026-03-27",
        },
        {
          organizationId,
          academicYear: "2026",
          orderNum: 2,
          name: "Segundo Periodo",
          shortName: "P2",
          startDate: "2026-04-06",
          endDate: "2026-06-12",
        },
      ])
      .returning();
    const criteria = await db()
      .insert(gradeCriterion)
      .values([
        { organizationId, name: "Cognitivo", weight: "40.00", orderNum: 1 },
        { organizationId, name: "Procedimental", weight: "60.00", orderNum: 2 },
      ])
      .returning();
    const personIds: string[] = [];
    for (const index of [0, 1, 2, 3]) {
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
    const students = await db()
      .insert(student)
      .values(
        [0, 1].map((index) => ({
          organizationId,
          personId: personIds[index]!,
          campusId: camp!.id,
          courseId: grp!.id,
          enrolledYear: "2026",
        })),
      )
      .returning();
    return {
      offeringId: offerings[0]!.id,
      otherOfferingId: offerings[1]!.id,
      periodId: periods[0]!.id,
      otherPeriodId: periods[1]!.id,
      criterionId: criteria[0]!.id,
      otherCriterionId: criteria[1]!.id,
      personIds,
      studentIds: students.map((row) => row.id),
    };
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
        { id: orgA, name: "Colegio AA", slug: `aa-${marker}` },
        { id: orgB, name: "Colegio AB", slug: `ab-${marker}` },
      ]);
    a = await seedOrg(orgA, "a");
    b = await seedOrg(orgB, "b");
  });

  /* ------------------------------ grade_record ------------------------------ */
  describe("grade_record", () => {
    const values = (extra: Partial<typeof gradeRecord.$inferInsert> = {}) => ({
      organizationId: orgA,
      studentId: a.studentIds[0]!,
      offeringId: a.offeringId,
      periodId: a.periodId,
      criterionId: a.criterionId,
      score: "4.5",
      createdBy: a.personIds[2]!,
      updatedBy: a.personIds[3]!,
      ...extra,
    });

    test("defaults: two-decimal score, no observation, timestamps", async () => {
      const [row] = await db().insert(gradeRecord).values(values()).returning();
      expect(row).toMatchObject({ score: "4.50", observation: null });
      expect(row?.createdAt).toBeInstanceOf(Date);
      expect(row?.updatedAt).toBeInstanceOf(Date);
    });

    test("(student, offering, period, criterion) is unique", async () => {
      await db().insert(gradeRecord).values(values());
      expect(await pgFailure(() => db().insert(gradeRecord).values(values()))).toMatchObject({
        code: "23505",
        constraint: GRADE_RECORD_UNIQUE,
      });
      // The same cell in another criterion, period or offering is a different record.
      await db()
        .insert(gradeRecord)
        .values(values({ criterionId: a.otherCriterionId }));
      await db()
        .insert(gradeRecord)
        .values(values({ periodId: a.otherPeriodId }));
      await db()
        .insert(gradeRecord)
        .values(values({ offeringId: a.otherOfferingId }));
    });

    test("score must be 1.00..5.00", async () => {
      for (const score of ["0.99", "5.01"]) {
        expect(
          await pgFailure(() => db().insert(gradeRecord).values(values({ score }))),
        ).toMatchObject({ code: "23514", constraint: GRADE_RECORD_SCORE_CHECK });
      }
      const [low] = await db()
        .insert(gradeRecord)
        .values(values({ score: "1.00" }))
        .returning();
      expect(low?.score).toBe("1.00");
      const [high] = await db()
        .insert(gradeRecord)
        .values(values({ score: "5.00", criterionId: a.otherCriterionId }))
        .returning();
      expect(high?.score).toBe("5.00");
    });

    test(`observation is at most ${SIGE_RULES.GRADE_OBSERVATION_MAX} characters`, async () => {
      const max = SIGE_RULES.GRADE_OBSERVATION_MAX;
      expect(
        await pgFailure(() =>
          db()
            .insert(gradeRecord)
            .values(values({ observation: "x".repeat(max + 1) })),
        ),
      ).toMatchObject({ code: "23514", constraint: GRADE_RECORD_OBSERVATION_CHECK });
      await db()
        .insert(gradeRecord)
        .values(values({ observation: "x".repeat(max) }));
    });

    test("tenant FKs reject another institution's parents", async () => {
      const cases: [Partial<typeof gradeRecord.$inferInsert>, string][] = [
        [{ studentId: b.studentIds[0]! }, GRADE_RECORD_STUDENT_FK],
        [{ offeringId: b.offeringId }, GRADE_RECORD_OFFERING_FK],
        [{ periodId: b.periodId }, GRADE_RECORD_PERIOD_FK],
        [{ criterionId: b.criterionId }, GRADE_RECORD_CRITERION_FK],
        [{ createdBy: b.personIds[2]! }, GRADE_RECORD_CREATED_BY_FK],
        [{ updatedBy: b.personIds[3]! }, GRADE_RECORD_UPDATED_BY_FK],
      ];
      for (const [extra, constraint] of cases) {
        expect(await pgFailure(() => db().insert(gradeRecord).values(values(extra)))).toMatchObject(
          {
            code: "23503",
            constraint,
          },
        );
      }
    });

    test("a student, offering, period, criterion or author with grades cannot be deleted", async () => {
      await db().insert(gradeRecord).values(values());
      const deletions: [() => Promise<unknown>, string][] = [
        [
          () =>
            db()
              .delete(student)
              .where(sql`${student.id} = ${a.studentIds[0]!}`),
          GRADE_RECORD_STUDENT_FK,
        ],
        [
          () =>
            db()
              .delete(offering)
              .where(sql`${offering.id} = ${a.offeringId}`),
          GRADE_RECORD_OFFERING_FK,
        ],
        [
          () =>
            db()
              .delete(academicPeriod)
              .where(sql`${academicPeriod.id} = ${a.periodId}`),
          GRADE_RECORD_PERIOD_FK,
        ],
        [
          () =>
            db()
              .delete(gradeCriterion)
              .where(sql`${gradeCriterion.id} = ${a.criterionId}`),
          GRADE_RECORD_CRITERION_FK,
        ],
        [
          () =>
            db()
              .delete(person)
              .where(sql`${person.id} = ${a.personIds[2]!}`),
          GRADE_RECORD_CREATED_BY_FK,
        ],
        [
          () =>
            db()
              .delete(person)
              .where(sql`${person.id} = ${a.personIds[3]!}`),
          GRADE_RECORD_UPDATED_BY_FK,
        ],
      ];
      for (const [work, constraint] of deletions) {
        expect(await pgFailure(work)).toMatchObject({ code: "23001", constraint });
      }
    });
  });

  /* ------------------------------ period_lock ------------------------------ */
  describe("period_lock", () => {
    const values = (extra: Partial<typeof periodLock.$inferInsert> = {}) => ({
      organizationId: orgA,
      offeringId: a.offeringId,
      periodId: a.periodId,
      locked: false,
      ...extra,
    });

    test("an unlocked row carries no locker", async () => {
      const [row] = await db().insert(periodLock).values(values()).returning();
      expect(row).toMatchObject({ locked: false, lockedBy: null, lockedAt: null });
    });

    // 06 §2 writes `locked bool not null` with no default, unlike `observation.notified`, so a
    // writer that forgets the state is refused instead of quietly leaving the period open.
    test("`locked` has no default to fall back on", async () => {
      const failure = await pgFailure(() =>
        db().execute(
          // `id` is a client-side default, so a raw insert has to carry one of its own.
          sql`insert into "period_lock" ("id", "organization_id", "offering_id", "period_id")
              values (${crypto.randomUUID()}, ${orgA}, ${a.offeringId}, ${a.periodId})`,
        ),
      );
      expect(failure).toMatchObject({ code: "23502", column: "locked" });
    });

    test("(offering, period) is unique", async () => {
      await db()
        .insert(periodLock)
        .values(values({ locked: true }));
      expect(
        await pgFailure(() =>
          db()
            .insert(periodLock)
            .values(values({ locked: false })),
        ),
      ).toMatchObject({ code: "23505", constraint: PERIOD_LOCK_UNIQUE });
      await db()
        .insert(periodLock)
        .values(values({ periodId: a.otherPeriodId }));
      await db()
        .insert(periodLock)
        .values(values({ offeringId: a.otherOfferingId }));
    });

    test("tenant FKs reject another institution's offering, period and locker", async () => {
      const cases: [Partial<typeof periodLock.$inferInsert>, string][] = [
        [{ offeringId: b.offeringId }, PERIOD_LOCK_OFFERING_FK],
        [{ periodId: b.periodId }, PERIOD_LOCK_PERIOD_FK],
        [{ lockedBy: b.personIds[2]! }, PERIOD_LOCK_LOCKED_BY_FK],
      ];
      for (const [extra, constraint] of cases) {
        expect(await pgFailure(() => db().insert(periodLock).values(values(extra)))).toMatchObject({
          code: "23503",
          constraint,
        });
      }
    });

    test("deleting the offering cascades the lock; the period and the locker restrict", async () => {
      await db()
        .insert(periodLock)
        .values(values({ locked: true, lockedBy: a.personIds[2]!, lockedAt: new Date() }));
      expect(
        await pgFailure(() =>
          db()
            .delete(academicPeriod)
            .where(sql`${academicPeriod.id} = ${a.periodId}`),
        ),
      ).toMatchObject({ code: "23001", constraint: PERIOD_LOCK_PERIOD_FK });
      expect(
        await pgFailure(() =>
          db()
            .delete(person)
            .where(sql`${person.id} = ${a.personIds[2]!}`),
        ),
      ).toMatchObject({ code: "23001", constraint: PERIOD_LOCK_LOCKED_BY_FK });
      await db()
        .delete(offering)
        .where(sql`${offering.id} = ${a.offeringId}`);
      const left = await db()
        .select()
        .from(periodLock)
        .where(sql`${periodLock.offeringId} = ${a.offeringId}`);
      expect(left).toEqual([]);
    });
  });

  /* ------------------------------ final_grade ------------------------------ */
  describe("final_grade", () => {
    const values = (extra: Partial<typeof finalGrade.$inferInsert> = {}) => ({
      organizationId: orgA,
      studentId: a.studentIds[0]!,
      offeringId: a.offeringId,
      periodId: a.periodId,
      finalScore: "3.8",
      status: "ganada" as const,
      ...extra,
    });

    test("defaults: calculated_at now, no observation", async () => {
      const [row] = await db().insert(finalGrade).values(values()).returning();
      expect(row).toMatchObject({ finalScore: "3.80", status: "ganada", observation: null });
      expect(row?.calculatedAt).toBeInstanceOf(Date);
    });

    test("(student, offering, period) is unique", async () => {
      await db().insert(finalGrade).values(values());
      expect(await pgFailure(() => db().insert(finalGrade).values(values()))).toMatchObject({
        code: "23505",
        constraint: FINAL_GRADE_UNIQUE,
      });
      await db()
        .insert(finalGrade)
        .values(values({ periodId: a.otherPeriodId }));
      await db()
        .insert(finalGrade)
        .values(values({ studentId: a.studentIds[1]! }));
    });

    test("final_score must be 1.00..5.00", async () => {
      for (const finalScore of ["0.99", "5.01"]) {
        expect(
          await pgFailure(() => db().insert(finalGrade).values(values({ finalScore }))),
        ).toMatchObject({ code: "23514", constraint: FINAL_GRADE_SCORE_CHECK });
      }
      const [low] = await db()
        .insert(finalGrade)
        .values(values({ finalScore: "1.00", status: "perdida" }))
        .returning();
      expect(low?.finalScore).toBe("1.00");
      const [high] = await db()
        .insert(finalGrade)
        .values(values({ finalScore: "5.00", periodId: a.otherPeriodId }))
        .returning();
      expect(high?.finalScore).toBe("5.00");
    });

    test("tenant FKs reject another institution's student, offering and period", async () => {
      const cases: [Partial<typeof finalGrade.$inferInsert>, string][] = [
        [{ studentId: b.studentIds[0]! }, FINAL_GRADE_STUDENT_FK],
        [{ offeringId: b.offeringId }, FINAL_GRADE_OFFERING_FK],
        [{ periodId: b.periodId }, FINAL_GRADE_PERIOD_FK],
      ];
      for (const [extra, constraint] of cases) {
        expect(await pgFailure(() => db().insert(finalGrade).values(values(extra)))).toMatchObject({
          code: "23503",
          constraint,
        });
      }
    });

    test("the cache never outlives its student, offering or period (restrict)", async () => {
      await db().insert(finalGrade).values(values());
      const deletions: [() => Promise<unknown>, string][] = [
        [
          () =>
            db()
              .delete(student)
              .where(sql`${student.id} = ${a.studentIds[0]!}`),
          FINAL_GRADE_STUDENT_FK,
        ],
        [
          () =>
            db()
              .delete(offering)
              .where(sql`${offering.id} = ${a.offeringId}`),
          FINAL_GRADE_OFFERING_FK,
        ],
        [
          () =>
            db()
              .delete(academicPeriod)
              .where(sql`${academicPeriod.id} = ${a.periodId}`),
          FINAL_GRADE_PERIOD_FK,
        ],
      ];
      for (const [work, constraint] of deletions) {
        expect(await pgFailure(work)).toMatchObject({ code: "23001", constraint });
      }
    });
  });

  /* ------------------------------ attendance_record ------------------------------ */
  describe("attendance_record", () => {
    const values = (extra: Partial<typeof attendanceRecord.$inferInsert> = {}) => ({
      organizationId: orgA,
      studentId: a.studentIds[0]!,
      offeringId: a.offeringId,
      date: MONDAY,
      status: "presente" as const,
      recordedBy: a.personIds[2]!,
      ...extra,
    });

    test("defaults: plain calendar date, no observation, timestamps", async () => {
      const [row] = await db().insert(attendanceRecord).values(values()).returning();
      expect(row).toMatchObject({ date: MONDAY, status: "presente", observation: null });
      expect(row?.createdAt).toBeInstanceOf(Date);
    });

    test("(student, offering, date) is unique — save is an upsert on that key", async () => {
      await db().insert(attendanceRecord).values(values());
      expect(
        await pgFailure(() =>
          db()
            .insert(attendanceRecord)
            .values(values({ status: "ausente" })),
        ),
      ).toMatchObject({ code: "23505", constraint: ATTENDANCE_RECORD_UNIQUE });
      await db()
        .insert(attendanceRecord)
        .values(values({ date: NEXT_MONDAY }));
      await db()
        .insert(attendanceRecord)
        .values(values({ offeringId: a.otherOfferingId }));
    });

    test("Sunday is refused; Monday and Saturday are accepted whatever the shift", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(attendanceRecord)
            .values(values({ date: SUNDAY })),
        ),
      ).toMatchObject({ code: "23514", constraint: ATTENDANCE_RECORD_WEEKDAY_CHECK });
      // The database knows nothing about shifts: ATT-R3 keeps Saturday to `Sabatina` courses in
      // the service, and this course is `Mañana`.
      const [saturday] = await db()
        .insert(attendanceRecord)
        .values(values({ date: SATURDAY }))
        .returning();
      expect(saturday?.date).toBe(SATURDAY);
      const [monday] = await db().insert(attendanceRecord).values(values()).returning();
      expect(monday?.date).toBe(MONDAY);
    });

    test(`observation is at most ${SIGE_RULES.ATTENDANCE_OBSERVATION_MAX} characters`, async () => {
      const max = SIGE_RULES.ATTENDANCE_OBSERVATION_MAX;
      expect(
        await pgFailure(() =>
          db()
            .insert(attendanceRecord)
            .values(values({ observation: "x".repeat(max + 1) })),
        ),
      ).toMatchObject({ code: "23514", constraint: ATTENDANCE_RECORD_OBSERVATION_CHECK });
      await db()
        .insert(attendanceRecord)
        .values(values({ observation: "x".repeat(max) }));
    });

    test("tenant FKs reject another institution's student, offering and editor", async () => {
      const cases: [Partial<typeof attendanceRecord.$inferInsert>, string][] = [
        [{ studentId: b.studentIds[0]! }, ATTENDANCE_RECORD_STUDENT_FK],
        [{ offeringId: b.offeringId }, ATTENDANCE_RECORD_OFFERING_FK],
        [{ recordedBy: b.personIds[2]! }, ATTENDANCE_RECORD_RECORDED_BY_FK],
      ];
      for (const [extra, constraint] of cases) {
        expect(
          await pgFailure(() => db().insert(attendanceRecord).values(values(extra))),
        ).toMatchObject({ code: "23503", constraint });
      }
    });

    test("a student, offering or editor with attendance cannot be deleted (restrict)", async () => {
      await db().insert(attendanceRecord).values(values());
      const deletions: [() => Promise<unknown>, string][] = [
        [
          () =>
            db()
              .delete(student)
              .where(sql`${student.id} = ${a.studentIds[0]!}`),
          ATTENDANCE_RECORD_STUDENT_FK,
        ],
        [
          () =>
            db()
              .delete(offering)
              .where(sql`${offering.id} = ${a.offeringId}`),
          ATTENDANCE_RECORD_OFFERING_FK,
        ],
        [
          () =>
            db()
              .delete(person)
              .where(sql`${person.id} = ${a.personIds[2]!}`),
          ATTENDANCE_RECORD_RECORDED_BY_FK,
        ],
      ];
      for (const [work, constraint] of deletions) {
        expect(await pgFailure(work)).toMatchObject({ code: "23001", constraint });
      }
    });
  });

  /* ------------------------------ observation ------------------------------ */
  describe("observation", () => {
    const observedAt = new Date("2026-03-02T14:00:00.000Z");
    const values = (extra: Partial<typeof observation.$inferInsert> = {}) => ({
      organizationId: orgA,
      studentId: a.studentIds[0]!,
      authorPersonId: a.personIds[2]!,
      type: "positiva" as const,
      description: "Excelente participación en clase.",
      observedAt,
      ...extra,
    });

    test("defaults: not notified, no category or commitments", async () => {
      const [row] = await db().insert(observation).values(values()).returning();
      expect(row).toMatchObject({
        notified: false,
        notifiedAt: null,
        notifiedBy: null,
        category: null,
        commitments: null,
      });
      expect(row?.createdAt).toBeInstanceOf(Date);
    });

    test("category is free text validated against sige-core by the service", async () => {
      const [row] = await db()
        .insert(observation)
        .values(values({ category: "Convivencia" }))
        .returning();
      expect(row?.category).toBe("Convivencia");
    });

    test("requires_notification is computed from the type for all four types", async () => {
      for (const type of OBSERVATION_TYPE_CODES) {
        const [row] = await db().insert(observation).values(values({ type })).returning();
        expect(row?.requiresNotification).toBe(requiresNotification(type));
      }
    });

    test("requires_notification follows a type change and cannot be written directly", async () => {
      const [row] = await db().insert(observation).values(values()).returning();
      expect(row?.requiresNotification).toBe(false);
      await db()
        .update(observation)
        .set({ type: "convivencia" })
        .where(sql`${observation.id} = ${row!.id}`);
      const [updated] = await db()
        .select()
        .from(observation)
        .where(sql`${observation.id} = ${row!.id}`);
      expect(updated?.requiresNotification).toBe(true);
      // A generated column refuses an explicit value (428C9), so no writer can lie about it.
      expect(
        await pgFailure(() =>
          db().execute(
            sql`insert into "observation" (organization_id, student_id, author_person_id, type, description, observed_at, requires_notification)
                values (${orgA}, ${a.studentIds[0]!}, ${a.personIds[2]!}, 'positiva', 'x', ${observedAt.toISOString()}, true)`,
          ),
        ),
      ).toMatchObject({ code: "428C9" });
      expect(
        await pgFailure(() =>
          db().execute(
            sql`update "observation" set requires_notification = false where id = ${row!.id}`,
          ),
        ),
      ).toMatchObject({ code: "428C9" });
    });

    test("notified and notified_at agree in both directions", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(observation)
            .values(values({ notified: true })),
        ),
      ).toMatchObject({ code: "23514", constraint: OBSERVATION_NOTIFIED_CHECK });
      expect(
        await pgFailure(() =>
          db()
            .insert(observation)
            .values(values({ notifiedAt: new Date() })),
        ),
      ).toMatchObject({ code: "23514", constraint: OBSERVATION_NOTIFIED_CHECK });
      const [row] = await db()
        .insert(observation)
        .values(
          values({
            type: "negativa",
            notified: true,
            notifiedAt: new Date(),
            notifiedBy: a.personIds[3]!,
          }),
        )
        .returning();
      expect(row?.requiresNotification).toBe(true);
      expect(
        await pgFailure(() =>
          db()
            .update(observation)
            .set({ notified: false })
            .where(sql`${observation.id} = ${row!.id}`),
        ),
      ).toMatchObject({ code: "23514", constraint: OBSERVATION_NOTIFIED_CHECK });
      await db()
        .update(observation)
        .set({ notified: false, notifiedAt: null })
        .where(sql`${observation.id} = ${row!.id}`);
    });

    test("the OBS-R8 pending filter has its partial index", async () => {
      const rows = await db().execute<{ indexdef: string }>(
        sql`select indexdef from pg_indexes where tablename = 'observation' and indexname = ${OBSERVATION_PENDING_INDEX}`,
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]?.indexdef).toContain("WHERE (requires_notification AND (NOT notified))");
      expect(rows.rows[0]?.indexdef).toContain("observed_at DESC");
    });

    test("description and commitments have their length bounds", async () => {
      expect(
        await pgFailure(() =>
          db()
            .insert(observation)
            .values(
              values({
                description: "x".repeat(SIGE_RULES.OBSERVATION_DESCRIPTION_MAX + 1),
              }),
            ),
        ),
      ).toMatchObject({ code: "23514", constraint: OBSERVATION_DESCRIPTION_CHECK });
      expect(
        await pgFailure(() =>
          db()
            .insert(observation)
            .values(
              values({
                commitments: "x".repeat(SIGE_RULES.OBSERVATION_COMMITMENTS_MAX + 1),
              }),
            ),
        ),
      ).toMatchObject({ code: "23514", constraint: OBSERVATION_COMMITMENTS_CHECK });
      await db()
        .insert(observation)
        .values(
          values({
            description: "x".repeat(SIGE_RULES.OBSERVATION_DESCRIPTION_MAX),
            commitments: "x".repeat(SIGE_RULES.OBSERVATION_COMMITMENTS_MAX),
          }),
        );
    });

    test("tenant FKs reject another institution's student, author and notifier", async () => {
      const cases: [Partial<typeof observation.$inferInsert>, string][] = [
        [{ studentId: b.studentIds[0]! }, OBSERVATION_STUDENT_FK],
        [{ authorPersonId: b.personIds[2]! }, OBSERVATION_AUTHOR_FK],
        [
          { notified: true, notifiedAt: new Date(), notifiedBy: b.personIds[3]! },
          OBSERVATION_NOTIFIED_BY_FK,
        ],
      ];
      for (const [extra, constraint] of cases) {
        expect(await pgFailure(() => db().insert(observation).values(values(extra)))).toMatchObject(
          {
            code: "23503",
            constraint,
          },
        );
      }
    });

    test("a student, author or notifier with observations cannot be deleted (restrict)", async () => {
      await db()
        .insert(observation)
        .values(
          values({
            type: "negativa",
            notified: true,
            notifiedAt: new Date(),
            notifiedBy: a.personIds[3]!,
          }),
        );
      const deletions: [() => Promise<unknown>, string][] = [
        [
          () =>
            db()
              .delete(student)
              .where(sql`${student.id} = ${a.studentIds[0]!}`),
          OBSERVATION_STUDENT_FK,
        ],
        [
          () =>
            db()
              .delete(person)
              .where(sql`${person.id} = ${a.personIds[2]!}`),
          OBSERVATION_AUTHOR_FK,
        ],
        [
          () =>
            db()
              .delete(person)
              .where(sql`${person.id} = ${a.personIds[3]!}`),
          OBSERVATION_NOTIFIED_BY_FK,
        ],
      ];
      for (const [work, constraint] of deletions) {
        expect(await pgFailure(work)).toMatchObject({ code: "23001", constraint });
      }
    });
  });

  /* ------------------------------ tenant isolation ------------------------------ */
  describe("tenant isolation", () => {
    async function seedBoth() {
      for (const [organizationId, seed] of [
        [orgA, a],
        [orgB, b],
      ] as const) {
        await db().insert(gradeRecord).values({
          organizationId,
          studentId: seed.studentIds[0]!,
          offeringId: seed.offeringId,
          periodId: seed.periodId,
          criterionId: seed.criterionId,
          score: "4.00",
          createdBy: seed.personIds[2]!,
          updatedBy: seed.personIds[2]!,
        });
        await db().insert(periodLock).values({
          organizationId,
          offeringId: seed.offeringId,
          periodId: seed.periodId,
          locked: true,
          lockedBy: seed.personIds[2]!,
          lockedAt: new Date(),
        });
        await db().insert(finalGrade).values({
          organizationId,
          studentId: seed.studentIds[0]!,
          offeringId: seed.offeringId,
          periodId: seed.periodId,
          finalScore: "4.00",
          status: "ganada",
        });
        await db().insert(attendanceRecord).values({
          organizationId,
          studentId: seed.studentIds[0]!,
          offeringId: seed.offeringId,
          date: MONDAY,
          status: "presente",
          recordedBy: seed.personIds[2]!,
        });
        await db()
          .insert(observation)
          .values({
            organizationId,
            studentId: seed.studentIds[0]!,
            authorPersonId: seed.personIds[2]!,
            type: "negativa",
            description: "Llegó tarde tres veces.",
            observedAt: new Date("2026-03-02T14:00:00.000Z"),
          });
      }
    }

    const tables = [
      "grade_record",
      "period_lock",
      "final_grade",
      "attendance_record",
      "observation",
    ] as const;

    async function countsFor(organizationId: string) {
      const counts: Record<string, string | undefined> = {};
      for (const table of tables) {
        const rows = await db().execute<{ count: string }>(
          sql`select count(*)::text as count from ${sql.identifier(table)} where organization_id = ${organizationId}`,
        );
        counts[table] = rows.rows[0]?.count;
      }
      return counts;
    }

    test("each institution keeps its own rows", async () => {
      await seedBoth();
      for (const organizationId of [orgA, orgB]) {
        expect(await countsFor(organizationId)).toEqual({
          grade_record: "1",
          period_lock: "1",
          final_grade: "1",
          attendance_record: "1",
          observation: "1",
        });
      }
    });

    test("deleting one institution removes only its academic rows", async () => {
      await seedBoth();
      await db().execute(sql`delete from "organization" where id = ${orgA}`);
      expect(await countsFor(orgA)).toEqual({
        grade_record: "0",
        period_lock: "0",
        final_grade: "0",
        attendance_record: "0",
        observation: "0",
      });
      expect(await countsFor(orgB)).toEqual({
        grade_record: "1",
        period_lock: "1",
        final_grade: "1",
        attendance_record: "1",
        observation: "1",
      });
    });
  });
});

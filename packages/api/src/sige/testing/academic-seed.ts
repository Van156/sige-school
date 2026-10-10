import * as schema from "@base-template/db/schema";

import type { SigeTestFixture, TestTenant } from "./fixture";

/**
 * Row seeders for the daily-operations tables (sige/06 §2, sige/07 §2, sige/08 §2), shared by the
 * suites that only need a dependent row to exist: the T4 delete pre-checks and row predicates and,
 * later, the `grade.*`, `attendance.*` and `observation.*` read tests. Writes go straight to the
 * database on purpose — the services under test are the ones being exercised, not the seed.
 */

/** Distinct `academic_year` per seeded period: `(organization, year, orderNum)` is unique. */
let periodCounter = 0;

export const seedAcademicPeriod = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  values: Partial<typeof schema.academicPeriod.$inferInsert> = {},
) => {
  periodCounter += 1;
  const year = String(2100 + (periodCounter % 800));
  const tag = crypto.randomUUID().slice(0, 8);
  const [row] = await fx.db
    .insert(schema.academicPeriod)
    .values({
      organizationId: tenant.orgId,
      academicYear: year,
      orderNum: 1,
      name: `Periodo ${tag}`,
      shortName: tag.slice(0, 6),
      startDate: `${year}-01-15`,
      endDate: `${year}-03-20`,
      ...values,
    })
    .returning();
  return row!;
};

export const seedCriterion = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  values: Partial<typeof schema.gradeCriterion.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.gradeCriterion)
    .values({
      organizationId: tenant.orgId,
      name: `Criterio ${crypto.randomUUID().slice(0, 8)}`,
      weight: "100.00",
      orderNum: 1,
      ...values,
    })
    .returning();
  return row!;
};

/** One sheet cell (GRD-R1). `createdBy`/`updatedBy` are the author's `person` id (D9). */
export const seedGradeRecord = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  row: {
    studentId: string;
    offeringId: string;
    periodId: string;
    criterionId: string;
    authorPersonId: string;
    score?: string;
  },
) => {
  const [created] = await fx.db
    .insert(schema.gradeRecord)
    .values({
      organizationId: tenant.orgId,
      studentId: row.studentId,
      offeringId: row.offeringId,
      periodId: row.periodId,
      criterionId: row.criterionId,
      score: row.score ?? "4.00",
      createdBy: row.authorPersonId,
      updatedBy: row.authorPersonId,
    })
    .returning();
  return created!;
};

/** The derived period final (R2.12); seeded directly when a test only needs the FK to exist. */
export const seedFinalGrade = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  row: { studentId: string; offeringId: string; periodId: string; finalScore?: string },
) => {
  const [created] = await fx.db
    .insert(schema.finalGrade)
    .values({
      organizationId: tenant.orgId,
      studentId: row.studentId,
      offeringId: row.offeringId,
      periodId: row.periodId,
      finalScore: row.finalScore ?? "4.00",
      status: "ganada",
    })
    .returning();
  return created!;
};

/** GRD-R6 lock state. `locked` is explicit: the column has no default (T3). */
export const seedPeriodLock = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  row: { offeringId: string; periodId: string; locked?: boolean; lockedBy?: string | null },
) => {
  const [created] = await fx.db
    .insert(schema.periodLock)
    .values({
      organizationId: tenant.orgId,
      offeringId: row.offeringId,
      periodId: row.periodId,
      locked: row.locked ?? true,
      lockedBy: row.lockedBy ?? null,
      lockedAt: row.lockedBy ? new Date() : null,
    })
    .returning();
  return created!;
};

/** One roll entry (ATT-R1). `date` must be Monday..Saturday — the DB check rejects Sunday. */
export const seedAttendanceRecord = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  row: {
    studentId: string;
    offeringId: string;
    recordedBy: string;
    date?: string;
    status?: "presente" | "ausente" | "justificado" | "excusado";
  },
) => {
  const [created] = await fx.db
    .insert(schema.attendanceRecord)
    .values({
      organizationId: tenant.orgId,
      studentId: row.studentId,
      offeringId: row.offeringId,
      date: row.date ?? "2026-02-02",
      status: row.status ?? "presente",
      recordedBy: row.recordedBy,
    })
    .returning();
  return created!;
};

/** A behavioural note (OBS-R1); `requires_notification` is generated, never passed. */
export const seedObservation = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  row: {
    studentId: string;
    authorPersonId: string;
    type?: "positiva" | "negativa" | "seguimiento" | "convivencia";
    observedAt?: Date;
    description?: string;
  },
) => {
  const [created] = await fx.db
    .insert(schema.observation)
    .values({
      organizationId: tenant.orgId,
      studentId: row.studentId,
      authorPersonId: row.authorPersonId,
      type: row.type ?? "seguimiento",
      description: row.description ?? "Observación de prueba.",
      observedAt: row.observedAt ?? new Date("2026-02-02T13:00:00Z"),
    })
    .returning();
  return created!;
};

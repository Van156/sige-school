import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { sql } from "drizzle-orm";
import type { Column, SQL, Table } from "drizzle-orm";

/**
 * Delete pre-checks against the daily-operations tables (sige/02 §4.2, sige/04 §4.2, sige/05
 * STU-R7, foundation §6.4). The `restrict` FKs are the arbiter — `pg-errors.ts` maps each of them
 * to the same Spanish message — but three things still need the check:
 *
 * - the spec lists dependents in a fixed order (an offering reports enrollments, then slots, then
 *   academic records), which the FK Postgres happens to report first does not respect;
 * - `student.delete` and `user.delete` share one mapper call with `personRole` set, which words a
 *   blocked delete as USR-R7; only this check produces the STU-R7 copy;
 * - an institution has no blocking FK at all (its tables cascade from `organization`).
 *
 * Every probe runs in the caller's transaction, after the row lock the caller already holds, so a
 * concurrent writer either waits for that lock or is caught by the FK.
 */

/** Anything that can run raw SQL: the `Database` itself or a transaction/savepoint handle. */
type Executor = Pick<Database, "execute">;

/** True when at least one probe matches. One statement, one round trip, no rows read. */
async function anyExists(executor: Executor, probes: SQL[]): Promise<boolean> {
  const result = await executor.execute(sql`select 1 where ${sql.join(probes, sql` or `)}`);
  return result.rows.length > 0;
}

/** `exists (select 1 from <table> where <tenant column> = org and <key column> = id)`. */
const probe = (
  table: Table,
  keyColumn: Column,
  tenantColumn: Column,
  organizationId: string,
  id: string,
) =>
  sql`exists (select 1 from ${table} where ${tenantColumn} = ${organizationId} and ${keyColumn} = ${id})`;

/**
 * sige/04 §4.2 third `offering.delete` rule (P3 D2): grades, finals or attendance. `period_lock`
 * is deliberately absent — it cascades with the offering (R2.6), so a lock alone is no dependent.
 */
export function offeringHasAcademicRecords(
  executor: Executor,
  organizationId: string,
  offeringId: string,
): Promise<boolean> {
  const { gradeRecord, finalGrade, attendanceRecord } = schema;
  return anyExists(executor, [
    probe(
      gradeRecord,
      gradeRecord.offeringId,
      gradeRecord.organizationId,
      organizationId,
      offeringId,
    ),
    probe(finalGrade, finalGrade.offeringId, finalGrade.organizationId, organizationId, offeringId),
    probe(
      attendanceRecord,
      attendanceRecord.offeringId,
      attendanceRecord.organizationId,
      organizationId,
      offeringId,
    ),
  ]);
}

/**
 * sige/02 §4.2: a period with `grade_record`, `final_grade` or `period_lock` rows is refused
 * ("El periodo tiene notas registradas."). `report_card` joins the list in P6.
 */
export function periodHasGrades(
  executor: Executor,
  organizationId: string,
  periodId: string,
): Promise<boolean> {
  const { gradeRecord, finalGrade, periodLock } = schema;
  return anyExists(executor, [
    probe(gradeRecord, gradeRecord.periodId, gradeRecord.organizationId, organizationId, periodId),
    probe(finalGrade, finalGrade.periodId, finalGrade.organizationId, organizationId, periodId),
    probe(periodLock, periodLock.periodId, periodLock.organizationId, organizationId, periodId),
  ]);
}

/** sige/02 §4.2: "El criterio tiene notas registradas." Only `grade_record` cites a criterion. */
export function criterionHasGrades(
  executor: Executor,
  organizationId: string,
  criterionId: string,
): Promise<boolean> {
  const { gradeRecord } = schema;
  return anyExists(executor, [
    probe(
      gradeRecord,
      gradeRecord.criterionId,
      gradeRecord.organizationId,
      organizationId,
      criterionId,
    ),
  ]);
}

/**
 * sige/05 STU-R7: "the check covers every referencing table" — enrollments plus the P5 academic
 * rows. Report cards, alerts and achievements join the list in P6/P7.
 */
export function studentHasRecords(
  executor: Executor,
  organizationId: string,
  studentId: string,
): Promise<boolean> {
  const { enrollment, gradeRecord, finalGrade, attendanceRecord, observation } = schema;
  return anyExists(executor, [
    probe(enrollment, enrollment.studentId, enrollment.organizationId, organizationId, studentId),
    probe(
      gradeRecord,
      gradeRecord.studentId,
      gradeRecord.organizationId,
      organizationId,
      studentId,
    ),
    probe(finalGrade, finalGrade.studentId, finalGrade.organizationId, organizationId, studentId),
    probe(
      attendanceRecord,
      attendanceRecord.studentId,
      attendanceRecord.organizationId,
      organizationId,
      studentId,
    ),
    probe(
      observation,
      observation.studentId,
      observation.organizationId,
      organizationId,
      studentId,
    ),
  ]);
}

/**
 * sige/02 §4.2 / foundation §6.4: "La institución tiene estudiantes o notas registradas." A grade
 * record always belongs to a student, so the students probe already answers today's data; the
 * grades probe is kept because the spec lists both, and it is the only guard left should a student
 * row ever become removable while its grades stay.
 */
export function institutionHasAcademicRecords(
  executor: Executor,
  organizationId: string,
): Promise<boolean> {
  const { student, gradeRecord } = schema;
  return anyExists(executor, [
    sql`exists (select 1 from ${student} where ${student.organizationId} = ${organizationId})`,
    sql`exists (select 1 from ${gradeRecord} where ${gradeRecord.organizationId} = ${organizationId})`,
  ]);
}

import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { ATTENDANCE_STATUSES, ISO_WEEKDAY } from "@base-template/sige-core/attendance";
import { FINAL_STATUSES } from "@base-template/sige-core/grading";
import {
  OBSERVATION_TYPE_CODES,
  requiresNotification,
} from "@base-template/sige-core/observations";
import { SIGE_RULES } from "@base-template/sige-core/rules";

import { organization } from "./auth";
import { academicPeriod, gradeCriterion } from "./institution";
import { person } from "./person";
import { offering } from "./scheduling";
import { student } from "./student";

/**
 * Daily academic operations: grade entry, period locks and finals (sige/06 §2), attendance
 * (sige/07 §2) and observations (sige/08 §2). Enum values and every numeric limit come from
 * sige-core, so the database, the services, the web sheet and the seed cannot diverge (D12).
 */

/**
 * `no evaluado` is part of the enum for the read models only: a stored `final_grade` row exists
 * exactly when the student has a record, so it is always `ganada` or `perdida` (06 §2).
 */
export const finalGradeStatus = pgEnum("final_grade_status", FINAL_STATUSES);
export const attendanceStatus = pgEnum("attendance_status", ATTENDANCE_STATUSES);
export const observationType = pgEnum("observation_type", OBSERVATION_TYPE_CODES);

/**
 * Exact constraint names, matched by the service mappers (sige/06 §4, sige/07 §4, sige/08 §4) to
 * turn a Postgres error into the spec message without a racy pre-check. D9: every person FK
 * (`created_by`, `updated_by`, `locked_by`, `recorded_by`, `author_person_id`, `notified_by`) maps
 * to the USR-R7 fallback, so the five tables share one mapping entry per kind.
 */
export const GRADE_RECORD_UNIQUE = "grade_record_studentId_offeringId_periodId_criterionId_unique";
export const GRADE_RECORD_STUDENT_FK = "grade_record_student_fk";
export const GRADE_RECORD_OFFERING_FK = "grade_record_offering_fk";
export const GRADE_RECORD_PERIOD_FK = "grade_record_period_fk";
export const GRADE_RECORD_CRITERION_FK = "grade_record_criterion_fk";
export const GRADE_RECORD_CREATED_BY_FK = "grade_record_created_by_fk";
export const GRADE_RECORD_UPDATED_BY_FK = "grade_record_updated_by_fk";
export const GRADE_RECORD_SCORE_CHECK = "grade_record_score_check";
export const GRADE_RECORD_OBSERVATION_CHECK = "grade_record_observation_check";
export const PERIOD_LOCK_UNIQUE = "period_lock_offeringId_periodId_unique";
export const PERIOD_LOCK_OFFERING_FK = "period_lock_offering_fk";
export const PERIOD_LOCK_PERIOD_FK = "period_lock_period_fk";
export const PERIOD_LOCK_LOCKED_BY_FK = "period_lock_locked_by_fk";
export const FINAL_GRADE_UNIQUE = "final_grade_studentId_offeringId_periodId_unique";
export const FINAL_GRADE_STUDENT_FK = "final_grade_student_fk";
export const FINAL_GRADE_OFFERING_FK = "final_grade_offering_fk";
export const FINAL_GRADE_PERIOD_FK = "final_grade_period_fk";
export const FINAL_GRADE_SCORE_CHECK = "final_grade_final_score_check";
export const ATTENDANCE_RECORD_UNIQUE = "attendance_record_studentId_offeringId_date_unique";
export const ATTENDANCE_RECORD_STUDENT_FK = "attendance_record_student_fk";
export const ATTENDANCE_RECORD_OFFERING_FK = "attendance_record_offering_fk";
export const ATTENDANCE_RECORD_RECORDED_BY_FK = "attendance_record_recorded_by_fk";
export const ATTENDANCE_RECORD_WEEKDAY_CHECK = "attendance_record_weekday_check";
export const ATTENDANCE_RECORD_OBSERVATION_CHECK = "attendance_record_observation_check";
export const OBSERVATION_STUDENT_FK = "observation_student_fk";
export const OBSERVATION_AUTHOR_FK = "observation_author_fk";
export const OBSERVATION_NOTIFIED_BY_FK = "observation_notified_by_fk";
export const OBSERVATION_NOTIFIED_CHECK = "observation_notified_check";
export const OBSERVATION_DESCRIPTION_CHECK = "observation_description_check";
export const OBSERVATION_COMMITMENTS_CHECK = "observation_commitments_check";

/** Partial index behind the OBS-R8 "Pendientes" filter; asserted by the constraint suite. */
export const OBSERVATION_PENDING_INDEX = "observation_organizationId_pendingNotification_idx";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => sql`now()`)
    .notNull();

/**
 * Inlines a sige-core limit as a SQL literal. A plain `sql` interpolation binds the number as a
 * parameter, and `$1` is illegal in a CHECK, in a generated expression and in an index predicate.
 */
const lit = (value: number) => sql.raw(String(value));

/** `1 and 5` from `SIGE_RULES`, for the two `numeric(3,2)` score checks (OD-9: the scale is fixed). */
const scoreBounds = sql`${lit(SIGE_RULES.SCORE_MIN)} and ${lit(SIGE_RULES.SCORE_MAX)}`;

/**
 * The types that require notification, derived from sige-core's `requiresNotification` instead of
 * retyped here, so the stored column and the predicate can never disagree (OBS-R8).
 */
const notifyingTypes = sql.raw(
  OBSERVATION_TYPE_CODES.filter(requiresNotification)
    .map((code) => `'${code}'`)
    .join(", "),
);

/**
 * One score per student × offering × period × criterion (GRD-R1). Every FK restricts: a period, a
 * criterion, an offering or a student with grades cannot disappear under the sheet, and the
 * services turn the violation into the 02/04/05 "tiene notas registradas" messages (R2.6).
 * There is no per-row `locked` flag — `period_lock` owns that state (foundation §5.2).
 */
export const gradeRecord = pgTable(
  "grade_record",
  {
    id: id(),
    organizationId: organizationId(),
    studentId: text("student_id").notNull(),
    offeringId: text("offering_id").notNull(),
    periodId: text("period_id").notNull(),
    criterionId: text("criterion_id").notNull(),
    score: numeric("score", { precision: 3, scale: 2 }).notNull(),
    observation: text("observation"),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: GRADE_RECORD_STUDENT_FK,
      columns: [table.organizationId, table.studentId],
      foreignColumns: [student.organizationId, student.id],
    }).onDelete("restrict"),
    foreignKey({
      name: GRADE_RECORD_OFFERING_FK,
      columns: [table.organizationId, table.offeringId],
      foreignColumns: [offering.organizationId, offering.id],
    }).onDelete("restrict"),
    foreignKey({
      name: GRADE_RECORD_PERIOD_FK,
      columns: [table.organizationId, table.periodId],
      foreignColumns: [academicPeriod.organizationId, academicPeriod.id],
    }).onDelete("restrict"),
    foreignKey({
      name: GRADE_RECORD_CRITERION_FK,
      columns: [table.organizationId, table.criterionId],
      foreignColumns: [gradeCriterion.organizationId, gradeCriterion.id],
    }).onDelete("restrict"),
    foreignKey({
      name: GRADE_RECORD_CREATED_BY_FK,
      columns: [table.organizationId, table.createdBy],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    foreignKey({
      name: GRADE_RECORD_UPDATED_BY_FK,
      columns: [table.organizationId, table.updatedBy],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    unique("grade_record_organizationId_id_unique").on(table.organizationId, table.id),
    // The tenant is already pinned by the composite FKs, so the key stays as sige/06 §2 writes it.
    unique(GRADE_RECORD_UNIQUE).on(
      table.studentId,
      table.offeringId,
      table.periodId,
      table.criterionId,
    ),
    index("grade_record_organizationId_offeringId_periodId_idx").on(
      table.organizationId,
      table.offeringId,
      table.periodId,
    ),
    index("grade_record_organizationId_studentId_periodId_idx").on(
      table.organizationId,
      table.studentId,
      table.periodId,
    ),
    index("grade_record_organizationId_criterionId_idx").on(
      table.organizationId,
      table.criterionId,
    ),
    check(GRADE_RECORD_SCORE_CHECK, sql`${table.score} between ${scoreBounds}`),
    // sige/06 §2 types the column `text`, so the bound is a named CHECK: a varchar overflow would
    // raise 22001 with no constraint name and GRD-R2 could not be mapped back to its message.
    check(
      GRADE_RECORD_OBSERVATION_CHECK,
      sql`char_length(${table.observation}) <= ${lit(SIGE_RULES.GRADE_OBSERVATION_MAX)}`,
    ),
  ],
);

/**
 * Lock state of one offering × period (GRD-R6, R2.11). A missing row means open, so the table only
 * ever holds combinations somebody locked at least once; `locked_by` and `locked_at` describe that
 * last lock and stay null until then. `locked` carries no default, unlike `observation.notified`
 * which 08 §2 does default: every writer states the state it means, so an upsert that forgets it
 * cannot quietly leave a period open. The offering FK cascades because the row is a pure child
 * (R2.6) — `offering.delete` is still refused while grades exist, so the cascade only serves
 * institution deletion. The period restricts: a locked period is never erased silently.
 */
export const periodLock = pgTable(
  "period_lock",
  {
    id: id(),
    organizationId: organizationId(),
    offeringId: text("offering_id").notNull(),
    periodId: text("period_id").notNull(),
    locked: boolean("locked").notNull(),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: PERIOD_LOCK_OFFERING_FK,
      columns: [table.organizationId, table.offeringId],
      foreignColumns: [offering.organizationId, offering.id],
    }).onDelete("cascade"),
    foreignKey({
      name: PERIOD_LOCK_PERIOD_FK,
      columns: [table.organizationId, table.periodId],
      foreignColumns: [academicPeriod.organizationId, academicPeriod.id],
    }).onDelete("restrict"),
    foreignKey({
      name: PERIOD_LOCK_LOCKED_BY_FK,
      columns: [table.organizationId, table.lockedBy],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    unique("period_lock_organizationId_id_unique").on(table.organizationId, table.id),
    unique(PERIOD_LOCK_UNIQUE).on(table.offeringId, table.periodId),
    index("period_lock_organizationId_periodId_idx").on(table.organizationId, table.periodId),
  ],
);

/**
 * Derived cache of the period final (R2.12): a row exists exactly when the student has at least
 * one `grade_record` for the offering × period, it is rewritten in the same transaction as any
 * record or criterion change and deleted with the last record. The annual DEF is never stored.
 * The FKs restrict like `grade_record`'s: the cache can never outlive what it summarises.
 */
export const finalGrade = pgTable(
  "final_grade",
  {
    id: id(),
    organizationId: organizationId(),
    studentId: text("student_id").notNull(),
    offeringId: text("offering_id").notNull(),
    periodId: text("period_id").notNull(),
    finalScore: numeric("final_score", { precision: 3, scale: 2 }).notNull(),
    status: finalGradeStatus("status").notNull(),
    // sige/06 §2 gives this one no length: it carries the teacher's period remark, not a cell note.
    observation: text("observation"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: FINAL_GRADE_STUDENT_FK,
      columns: [table.organizationId, table.studentId],
      foreignColumns: [student.organizationId, student.id],
    }).onDelete("restrict"),
    foreignKey({
      name: FINAL_GRADE_OFFERING_FK,
      columns: [table.organizationId, table.offeringId],
      foreignColumns: [offering.organizationId, offering.id],
    }).onDelete("restrict"),
    foreignKey({
      name: FINAL_GRADE_PERIOD_FK,
      columns: [table.organizationId, table.periodId],
      foreignColumns: [academicPeriod.organizationId, academicPeriod.id],
    }).onDelete("restrict"),
    unique("final_grade_organizationId_id_unique").on(table.organizationId, table.id),
    unique(FINAL_GRADE_UNIQUE).on(table.studentId, table.offeringId, table.periodId),
    index("final_grade_organizationId_offeringId_periodId_idx").on(
      table.organizationId,
      table.offeringId,
      table.periodId,
    ),
    index("final_grade_organizationId_studentId_idx").on(table.organizationId, table.studentId),
    check(FINAL_GRADE_SCORE_CHECK, sql`${table.finalScore} between ${scoreBounds}`),
  ],
);

/**
 * One roll entry per student × offering × calendar day; `attendance.save` is an upsert on that key
 * (ATT-R1). `date` is a plain `date`: "today", the weekday and the future check are resolved in
 * `America/Bogota` by the server (R3.13), never by the column's time zone. The CHECK only rules
 * out Sunday — whether Saturday is a class day depends on the course shift (`Sabatina`), which the
 * database does not know, so ATT-R3 stays a service rule. The FKs restrict (STU-R7, SCH-R6).
 */
export const attendanceRecord = pgTable(
  "attendance_record",
  {
    id: id(),
    organizationId: organizationId(),
    studentId: text("student_id").notNull(),
    offeringId: text("offering_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    status: attendanceStatus("status").notNull(),
    observation: text("observation"),
    /** The last editor, not the first (ATT-R1 rewrites the row on every save). */
    recordedBy: text("recorded_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: ATTENDANCE_RECORD_STUDENT_FK,
      columns: [table.organizationId, table.studentId],
      foreignColumns: [student.organizationId, student.id],
    }).onDelete("restrict"),
    foreignKey({
      name: ATTENDANCE_RECORD_OFFERING_FK,
      columns: [table.organizationId, table.offeringId],
      foreignColumns: [offering.organizationId, offering.id],
    }).onDelete("restrict"),
    foreignKey({
      name: ATTENDANCE_RECORD_RECORDED_BY_FK,
      columns: [table.organizationId, table.recordedBy],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    unique("attendance_record_organizationId_id_unique").on(table.organizationId, table.id),
    unique(ATTENDANCE_RECORD_UNIQUE).on(table.studentId, table.offeringId, table.date),
    index("attendance_record_organizationId_offeringId_date_idx").on(
      table.organizationId,
      table.offeringId,
      table.date,
    ),
    index("attendance_record_organizationId_studentId_date_idx").on(
      table.organizationId,
      table.studentId,
      table.date.desc(),
    ),
    check(
      ATTENDANCE_RECORD_WEEKDAY_CHECK,
      sql`extract(isodow from ${table.date}) between ${lit(ISO_WEEKDAY.monday)} and ${lit(ISO_WEEKDAY.saturday)}`,
    ),
    check(
      ATTENDANCE_RECORD_OBSERVATION_CHECK,
      sql`char_length(${table.observation}) <= ${lit(SIGE_RULES.ATTENDANCE_OBSERVATION_MAX)}`,
    ),
  ],
);

/**
 * A behavioural note on a student (OBS-R1). `requires_notification` is stored generated so the
 * OBS-R8 "Pendientes" filter and its partial index live in SQL and cannot drift from the type
 * (foundation §5.2 calls the flag derived). The CHECK ties `notified` to `notified_at` in both
 * directions, so "notified without a date" is impossible. The FKs restrict: a student with
 * observations is never deleted (08 §6.4) and neither is their author (D9, USR-R7).
 */
export const observation = pgTable(
  "observation",
  {
    id: id(),
    organizationId: organizationId(),
    studentId: text("student_id").notNull(),
    authorPersonId: text("author_person_id").notNull(),
    type: observationType("type").notNull(),
    // One of the seven values of 08 §3, validated against sige-core by the service: the spec types
    // the column `text` on purpose, so adding a category needs no migration.
    category: text("category"),
    description: text("description").notNull(),
    commitments: text("commitments"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    notified: boolean("notified").default(false).notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    notifiedBy: text("notified_by"),
    requiresNotification: boolean("requires_notification")
      .notNull()
      .generatedAlwaysAs((): SQL => sql`"type" in (${notifyingTypes})`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: OBSERVATION_STUDENT_FK,
      columns: [table.organizationId, table.studentId],
      foreignColumns: [student.organizationId, student.id],
    }).onDelete("restrict"),
    foreignKey({
      name: OBSERVATION_AUTHOR_FK,
      columns: [table.organizationId, table.authorPersonId],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    foreignKey({
      name: OBSERVATION_NOTIFIED_BY_FK,
      columns: [table.organizationId, table.notifiedBy],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    unique("observation_organizationId_id_unique").on(table.organizationId, table.id),
    index("observation_organizationId_studentId_observedAt_idx").on(
      table.organizationId,
      table.studentId,
      table.observedAt.desc(),
    ),
    index("observation_organizationId_observedAt_idx").on(
      table.organizationId,
      table.observedAt.desc(),
    ),
    index("observation_organizationId_authorPersonId_idx").on(
      table.organizationId,
      table.authorPersonId,
    ),
    index(OBSERVATION_PENDING_INDEX)
      .on(table.organizationId, table.observedAt.desc())
      .where(sql`${table.requiresNotification} and not ${table.notified}`),
    check(OBSERVATION_NOTIFIED_CHECK, sql`${table.notified} = (${table.notifiedAt} is not null)`),
    check(
      OBSERVATION_DESCRIPTION_CHECK,
      sql`char_length(${table.description}) <= ${lit(SIGE_RULES.OBSERVATION_DESCRIPTION_MAX)}`,
    ),
    check(
      OBSERVATION_COMMITMENTS_CHECK,
      sql`char_length(${table.commitments}) <= ${lit(SIGE_RULES.OBSERVATION_COMMITMENTS_MAX)}`,
    ),
  ],
);

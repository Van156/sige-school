import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { GUARDIAN_RELATIONSHIPS, STUDENT_STATUSES } from "@base-template/sige-core/student";

import { organization } from "./auth";
import { campus, course } from "./institution";
import { person } from "./person";

/** Student academic profile and guardian links (sige/05 §2). Enum values come from sige-core. */

export const studentStatus = pgEnum("student_status", STUDENT_STATUSES);
export const guardianRelationship = pgEnum("guardian_relationship", GUARDIAN_RELATIONSHIPS);

/**
 * Exact constraint names, matched by the service mappers (sige/05 §4, STU-R6, STU-R7) to turn a
 * Postgres error into the spec message without a racy pre-check.
 */
export const STUDENT_PERSON_UNIQUE = "student_personId_unique";
export const STUDENT_PERSON_FK = "student_person_fk";
export const STUDENT_CAMPUS_FK = "student_campus_fk";
export const STUDENT_COURSE_CAMPUS_FK = "student_course_campus_fk";
export const STUDENT_STRATUM_CHECK = "student_stratum_check";
export const STUDENT_ENROLLED_YEAR_CHECK = "student_enrolled_year_check";
export const GUARDIAN_LINK_UNIQUE = "student_guardian_guardianPersonId_studentId_unique";
export const GUARDIAN_STUDENT_FK = "student_guardian_student_fk";
export const GUARDIAN_PERSON_FK = "student_guardian_guardian_fk";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

/**
 * One academic profile per `student`-role person (the role is a service check, R2.16). Every FK
 * restricts: a person, campus or course in use cannot disappear under a profile (STU-R7, INS-R6).
 */
export const student = pgTable(
  "student",
  {
    id: id(),
    organizationId: organizationId(),
    personId: text("person_id").notNull(),
    campusId: text("campus_id").notNull(),
    courseId: text("course_id"),
    neighborhood: varchar("neighborhood", { length: 100 }),
    stratum: smallint("stratum"),
    bloodType: varchar("blood_type", { length: 5 }),
    eps: varchar("eps", { length: 100 }),
    guardianName: varchar("guardian_name", { length: 150 }),
    guardianPhone: varchar("guardian_phone", { length: 30 }),
    guardianEmail: varchar("guardian_email", { length: 100 }),
    enrolledYear: text("enrolled_year").notNull(),
    status: studentStatus("status").default("activo").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: STUDENT_PERSON_FK,
      columns: [table.organizationId, table.personId],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    foreignKey({
      name: STUDENT_CAMPUS_FK,
      columns: [table.organizationId, table.campusId],
      foreignColumns: [campus.organizationId, campus.id],
    }).onDelete("restrict"),
    // MATCH SIMPLE: skipped while course_id is null; otherwise the course shares the campus (G-STU-2).
    foreignKey({
      name: STUDENT_COURSE_CAMPUS_FK,
      columns: [table.organizationId, table.campusId, table.courseId],
      foreignColumns: [course.organizationId, course.campusId, course.id],
    }).onDelete("restrict"),
    unique("student_organizationId_id_unique").on(table.organizationId, table.id),
    unique(STUDENT_PERSON_UNIQUE).on(table.personId),
    index("student_organizationId_status_idx").on(table.organizationId, table.status),
    index("student_organizationId_courseId_idx").on(table.organizationId, table.courseId),
    index("student_organizationId_campusId_idx").on(table.organizationId, table.campusId),
    check(STUDENT_STRATUM_CHECK, sql`${table.stratum} between 1 and 6`),
    check(STUDENT_ENROLLED_YEAR_CHECK, sql`${table.enrolledYear} ~ '^[0-9]{4}$'`),
  ],
);

/** Guardian (a `parent`-role person, service check) of a student; many-to-many. */
export const studentGuardian = pgTable(
  "student_guardian",
  {
    id: id(),
    organizationId: organizationId(),
    studentId: text("student_id").notNull(),
    guardianPersonId: text("guardian_person_id").notNull(),
    relationship: guardianRelationship("relationship").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: GUARDIAN_STUDENT_FK,
      columns: [table.organizationId, table.studentId],
      foreignColumns: [student.organizationId, student.id],
    }).onDelete("cascade"),
    foreignKey({
      name: GUARDIAN_PERSON_FK,
      columns: [table.organizationId, table.guardianPersonId],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    unique(GUARDIAN_LINK_UNIQUE).on(table.guardianPersonId, table.studentId),
    index("student_guardian_organizationId_studentId_idx").on(
      table.organizationId,
      table.studentId,
    ),
    index("student_guardian_organizationId_guardianPersonId_idx").on(
      table.organizationId,
      table.guardianPersonId,
    ),
  ],
);

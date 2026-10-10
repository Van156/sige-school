import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  boolean,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { campus, course, subject } from "./institution";
import { person } from "./person";

/** Academic offering and schedule (sige/04 §2): offering, assignment, classroom, block, slot. */

export const teacherAssignmentStatus = pgEnum("teacher_assignment_status", [
  "activo",
  "inactivo",
  "temporal",
]);
export const classroomType = pgEnum("classroom_type", [
  "aula",
  "laboratorio",
  "auditorio",
  "cancha",
]);
/** `Sabatina` is excluded on purpose (OQ-SCH-3): Saturday courses are reported as skipped. */
export const timeBlockShift = pgEnum("time_block_shift", ["Mañana", "Tarde", "Nocturna", "Única"]);

/**
 * Exact constraint names, matched by the service mappers (sige/04 §4.1, §4.2, SCH-R9) to turn a
 * Postgres error into the spec message without a racy pre-check.
 */
export const OFFERING_UNIQUE = "offering_organizationId_subjectId_courseId_unique";
export const OFFERING_SUBJECT_FK = "offering_subject_fk";
export const OFFERING_COURSE_FK = "offering_course_fk";
export const OFFERING_TEACHER_FK = "offering_teacher_fk";
export const ASSIGNMENT_OFFERING_UNIQUE = "teacher_assignment_offeringId_unique";
export const ASSIGNMENT_OFFERING_FK = "teacher_assignment_offering_fk";
export const CLASSROOM_CODE_UNIQUE = "classroom_organizationId_campusId_code_unique";
export const CLASSROOM_CAMPUS_FK = "classroom_campus_fk";
export const TIME_BLOCK_UNIQUE = "time_block_organizationId_campusId_name_year_shift_unique";
export const TIME_BLOCK_CAMPUS_FK = "time_block_campus_fk";
export const SLOT_OFFERING_COURSE_FK = "schedule_slot_offering_course_fk";
export const SLOT_CLASSROOM_FK = "schedule_slot_classroom_fk";
export const SLOT_OFFERING_TEACHER_FK = "schedule_slot_offering_teacher_fk";
/** Trigger-raised (23514) when a slot's teacher is null but its offering has one (see migration). */
export const SLOT_TEACHER_SYNC_CHECK = "schedule_slot_teacher_sync_check";
/** GiST exclusion constraints (D1); created by hand in the migration, Drizzle cannot declare them. */
export const SLOT_CLASSROOM_EXCLUDE = "schedule_slot_classroom_overlap_excl";
export const SLOT_TEACHER_EXCLUDE = "schedule_slot_teacher_overlap_excl";
export const SLOT_COURSE_EXCLUDE = "schedule_slot_course_overlap_excl";

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

/** Central join "subject taught in a course by (at most) one teacher" (SCH-R2, OD-23). */
export const offering = pgTable(
  "offering",
  {
    id: id(),
    organizationId: organizationId(),
    subjectId: text("subject_id").notNull(),
    courseId: text("course_id").notNull(),
    teacherPersonId: text("teacher_person_id"),
    hoursPerWeek: integer("hours_per_week").default(4).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: OFFERING_SUBJECT_FK,
      columns: [table.organizationId, table.subjectId],
      foreignColumns: [subject.organizationId, subject.id],
    }).onDelete("restrict"),
    foreignKey({
      name: OFFERING_COURSE_FK,
      columns: [table.organizationId, table.courseId],
      foreignColumns: [course.organizationId, course.id],
    }).onDelete("restrict"),
    foreignKey({
      name: OFFERING_TEACHER_FK,
      columns: [table.organizationId, table.teacherPersonId],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    unique("offering_organizationId_id_unique").on(table.organizationId, table.id),
    // Target of the slot -> offering composite FK: a slot shares its offering's course.
    unique("offering_organizationId_id_courseId_unique").on(
      table.organizationId,
      table.id,
      table.courseId,
    ),
    // Target of the slot / assignment -> offering composite FKs: they carry the offering's teacher.
    unique("offering_organizationId_id_teacherPersonId_unique").on(
      table.organizationId,
      table.id,
      table.teacherPersonId,
    ),
    unique(OFFERING_UNIQUE).on(table.organizationId, table.subjectId, table.courseId),
    index("offering_organizationId_courseId_idx").on(table.organizationId, table.courseId),
    index("offering_organizationId_teacherPersonId_idx").on(
      table.organizationId,
      table.teacherPersonId,
    ),
    check("offering_hours_check", sql`${table.hoursPerWeek} between 1 and 20`),
  ],
);

/** Lifecycle of the teacher on an offering; exists only while the offering has (or had) one. */
export const teacherAssignment = pgTable(
  "teacher_assignment",
  {
    id: id(),
    organizationId: organizationId(),
    offeringId: text("offering_id").notNull(),
    teacherPersonId: text("teacher_person_id").notNull(),
    academicYear: text("academic_year").notNull(),
    assignmentDate: date("assignment_date", { mode: "string" }).notNull(),
    status: teacherAssignmentStatus("status").default("activo").notNull(),
    notes: varchar("notes", { length: 500 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // The offering is the single source of truth for the teacher (SCH-R3): the assignment carries
    // the offering's own teacher, so the two can never diverge. The tenant FK to `person` is
    // implied (offering -> person) and therefore not repeated.
    foreignKey({
      name: ASSIGNMENT_OFFERING_FK,
      columns: [table.organizationId, table.offeringId, table.teacherPersonId],
      foreignColumns: [offering.organizationId, offering.id, offering.teacherPersonId],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    unique("teacher_assignment_organizationId_id_unique").on(table.organizationId, table.id),
    unique(ASSIGNMENT_OFFERING_UNIQUE).on(table.offeringId),
    index("teacher_assignment_organizationId_teacherPersonId_status_idx").on(
      table.organizationId,
      table.teacherPersonId,
      table.status,
    ),
    check("teacher_assignment_year_check", sql`${table.academicYear} ~ '^[0-9]{4}$'`),
  ],
);

export const classroom = pgTable(
  "classroom",
  {
    id: id(),
    organizationId: organizationId(),
    campusId: text("campus_id").notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    capacity: integer("capacity").default(40).notNull(),
    floor: integer("floor").default(1).notNull(),
    building: varchar("building", { length: 50 }),
    classroomType: classroomType("classroom_type").default("aula").notNull(),
    resources: jsonb("resources").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: CLASSROOM_CAMPUS_FK,
      columns: [table.organizationId, table.campusId],
      foreignColumns: [campus.organizationId, campus.id],
    }).onDelete("restrict"),
    unique("classroom_organizationId_id_unique").on(table.organizationId, table.id),
    uniqueIndex(CLASSROOM_CODE_UNIQUE).on(
      table.organizationId,
      table.campusId,
      sql`lower(${table.code})`,
    ),
    index("classroom_organizationId_campusId_idx").on(table.organizationId, table.campusId),
    check("classroom_capacity_check", sql`${table.capacity} between 10 and 100`),
    check("classroom_floor_check", sql`${table.floor} >= 1`),
    check(
      "classroom_resources_check",
      sql`${table.resources} is null or jsonb_typeof(${table.resources}) = 'object'`,
    ),
  ],
);

export const timeBlock = pgTable(
  "time_block",
  {
    id: id(),
    organizationId: organizationId(),
    campusId: text("campus_id").notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isBreak: boolean("is_break").default(false).notNull(),
    orderNum: integer("order_num").notNull(),
    shift: timeBlockShift("shift").notNull(),
    academicYear: text("academic_year").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: TIME_BLOCK_CAMPUS_FK,
      columns: [table.organizationId, table.campusId],
      foreignColumns: [campus.organizationId, campus.id],
    }).onDelete("restrict"),
    unique("time_block_organizationId_id_unique").on(table.organizationId, table.id),
    // sige/04 §4.1: names are unique per campus, shift and year, case-insensitively.
    uniqueIndex(TIME_BLOCK_UNIQUE).on(
      table.organizationId,
      table.campusId,
      sql`lower(${table.name})`,
      table.academicYear,
      table.shift,
    ),
    index("time_block_organizationId_campusId_year_shift_orderNum_idx").on(
      table.organizationId,
      table.campusId,
      table.academicYear,
      table.shift,
      table.orderNum,
    ),
    check("time_block_times_check", sql`${table.startTime} < ${table.endTime}`),
    check("time_block_order_check", sql`${table.orderNum} >= 1`),
    check("time_block_year_check", sql`${table.academicYear} ~ '^[0-9]{4}$'`),
  ],
);

/**
 * One weekly class. D1: `course_id` and `teacher_person_id` are denormalised from the offering so
 * three GiST exclusion constraints (see the migration) can reject overlapping `[start, end)` on the
 * same day and year for the classroom, the teacher (when set) and the course. The unique key
 * `(classroom_id, day, start, year)` of the spec is subsumed by the classroom exclusion: a CHECK
 * keeps every range non-empty, so two slots with the same start always overlap.
 */
export const scheduleSlot = pgTable(
  "schedule_slot",
  {
    id: id(),
    organizationId: organizationId(),
    offeringId: text("offering_id").notNull(),
    courseId: text("course_id").notNull(),
    teacherPersonId: text("teacher_person_id"),
    classroomId: text("classroom_id").notNull(),
    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    academicYear: text("academic_year").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // Pure child of the offering, and it must carry the offering's own course.
    foreignKey({
      name: SLOT_OFFERING_COURSE_FK,
      columns: [table.organizationId, table.offeringId, table.courseId],
      foreignColumns: [offering.organizationId, offering.id, offering.courseId],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      name: SLOT_CLASSROOM_FK,
      columns: [table.organizationId, table.classroomId],
      foreignColumns: [classroom.organizationId, classroom.id],
    }).onDelete("restrict"),
    // The slot's teacher follows the offering's (SCH-R3). MATCH SIMPLE skips this FK when the slot
    // teacher is null, so the null case is closed by a trigger in the migration. The tenant FKs to
    // `course` and `person` are implied through the offering and not repeated.
    foreignKey({
      name: SLOT_OFFERING_TEACHER_FK,
      columns: [table.organizationId, table.offeringId, table.teacherPersonId],
      foreignColumns: [offering.organizationId, offering.id, offering.teacherPersonId],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    unique("schedule_slot_organizationId_id_unique").on(table.organizationId, table.id),
    index("schedule_slot_organizationId_offeringId_idx").on(table.organizationId, table.offeringId),
    index("schedule_slot_organizationId_classroomId_dayOfWeek_idx").on(
      table.organizationId,
      table.classroomId,
      table.dayOfWeek,
    ),
    check("schedule_slot_day_check", sql`${table.dayOfWeek} between 0 and 4`),
    check("schedule_slot_times_check", sql`${table.startTime} < ${table.endTime}`),
    check("schedule_slot_year_check", sql`${table.academicYear} ~ '^[0-9]{4}$'`),
  ],
);

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { person } from "./person";

/** Institution structure (sige/02 §2): profile, campuses, levels, courses, subjects, periods, criteria. */

export const jornada = pgEnum("jornada", ["manana", "tarde", "completa"]);
export const courseShift = pgEnum("course_shift", [
  "Mañana",
  "Tarde",
  "Nocturna",
  "Única",
  "Sabatina",
]);

/**
 * Exact constraint names, matched by the service FK/unique-violation mapper (sige/02 §4.2) to turn
 * a Postgres error into the spec message without a racy pre-check.
 */
export const INSTITUTION_NIT_UNIQUE = "institution_profile_nit_unique";
export const CAMPUS_MAIN_UNIQUE = "campus_organizationId_main_unique";
export const CAMPUS_CODE_UNIQUE = "campus_organizationId_code_unique";
export const LEVEL_NAME_UNIQUE = "grade_level_organizationId_campusId_name_unique";
export const COURSE_UNIQUE = "course_organizationId_campusId_name_year_shift_unique";
export const LEVEL_CAMPUS_FK = "grade_level_campus_fk";
export const COURSE_CAMPUS_FK = "course_campus_fk";
export const COURSE_DIRECTOR_FK = "course_director_fk";
export const COURSE_LEVEL_CAMPUS_FK = "course_level_campus_fk";
export const SUBJECT_CODE_UNIQUE = "subject_organizationId_code_unique";
export const PERIOD_ACTIVE_UNIQUE = "academic_period_organizationId_active_unique";
export const PERIOD_SHORT_NAME_UNIQUE = "academic_period_organizationId_year_shortName_unique";
export const PERIOD_ORDER_UNIQUE = "academic_period_organizationId_year_orderNum_unique";

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

/** One-to-one extension of `organization` (name, slug and logo live there). */
export const institutionProfile = pgTable(
  "institution_profile",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    nit: varchar("nit", { length: 20 }),
    address: varchar("address", { length: 200 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 100 }),
    municipality: varchar("municipality", { length: 100 }),
    department: varchar("department", { length: 100 }),
    resolution: varchar("resolution", { length: 100 }),
    currentAcademicYear: text("current_academic_year")
      .notNull()
      .default(sql`(extract(year from now()))::text`),
    timezone: text("timezone").notNull().default("America/Bogota"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex(INSTITUTION_NIT_UNIQUE)
      .on(table.nit)
      .where(sql`${table.nit} is not null`),
    check("institution_profile_year_check", sql`${table.currentAcademicYear} ~ '^[0-9]{4}$'`),
  ],
);

export const campus = pgTable(
  "campus",
  {
    id: id(),
    organizationId: organizationId(),
    name: varchar("name", { length: 150 }).notNull(),
    code: varchar("code", { length: 20 }),
    address: varchar("address", { length: 200 }),
    jornada: jornada("jornada").default("completa").notNull(),
    isMain: boolean("is_main").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // R2.3: target of the composite tenant-safe FKs of dependent tables.
    unique("campus_organizationId_id_unique").on(table.organizationId, table.id),
    uniqueIndex(CAMPUS_CODE_UNIQUE)
      .on(table.organizationId, table.code)
      .where(sql`${table.code} is not null`),
    uniqueIndex(CAMPUS_MAIN_UNIQUE)
      .on(table.organizationId)
      .where(sql`${table.isMain}`),
    index("campus_organizationId_name_idx").on(table.organizationId, table.name),
  ],
);

export const gradeLevel = pgTable(
  "grade_level",
  {
    id: id(),
    organizationId: organizationId(),
    campusId: text("campus_id").notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    orderNum: integer("order_num").default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: LEVEL_CAMPUS_FK,
      columns: [table.organizationId, table.campusId],
      foreignColumns: [campus.organizationId, campus.id],
    }).onDelete("restrict"),
    unique("grade_level_organizationId_id_unique").on(table.organizationId, table.id),
    // Target of the course -> level composite FK: a level shares its course's campus.
    unique("grade_level_organizationId_campusId_id_unique").on(
      table.organizationId,
      table.campusId,
      table.id,
    ),
    unique(LEVEL_NAME_UNIQUE).on(table.organizationId, table.campusId, table.name),
    index("grade_level_organizationId_campusId_orderNum_idx").on(
      table.organizationId,
      table.campusId,
      table.orderNum,
    ),
    check("grade_level_order_check", sql`${table.orderNum} >= 0`),
  ],
);

export const course = pgTable(
  "course",
  {
    id: id(),
    organizationId: organizationId(),
    campusId: text("campus_id").notNull(),
    levelId: text("level_id"),
    directorPersonId: text("director_person_id"),
    name: varchar("name", { length: 50 }).notNull(),
    academicYear: text("academic_year").notNull(),
    shift: courseShift("shift").notNull(),
    maxStudents: integer("max_students").default(40).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: COURSE_CAMPUS_FK,
      columns: [table.organizationId, table.campusId],
      foreignColumns: [campus.organizationId, campus.id],
    }).onDelete("restrict"),
    // MATCH SIMPLE: skipped while level_id is null; otherwise the level must share the campus.
    foreignKey({
      name: COURSE_LEVEL_CAMPUS_FK,
      columns: [table.organizationId, table.campusId, table.levelId],
      foreignColumns: [gradeLevel.organizationId, gradeLevel.campusId, gradeLevel.id],
    }).onDelete("restrict"),
    foreignKey({
      name: COURSE_DIRECTOR_FK,
      columns: [table.organizationId, table.directorPersonId],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    unique("course_organizationId_id_unique").on(table.organizationId, table.id),
    unique(COURSE_UNIQUE).on(
      table.organizationId,
      table.campusId,
      table.name,
      table.academicYear,
      table.shift,
    ),
    index("course_organizationId_year_campusId_idx").on(
      table.organizationId,
      table.academicYear,
      table.campusId,
    ),
    check("course_max_students_check", sql`${table.maxStudents} between 1 and 60`),
    check("course_year_check", sql`${table.academicYear} ~ '^[0-9]{4}$'`),
  ],
);

export const subject = pgTable(
  "subject",
  {
    id: id(),
    organizationId: organizationId(),
    name: varchar("name", { length: 100 }).notNull(),
    code: varchar("code", { length: 20 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("subject_organizationId_id_unique").on(table.organizationId, table.id),
    uniqueIndex(SUBJECT_CODE_UNIQUE)
      .on(table.organizationId, table.code)
      .where(sql`${table.code} is not null`),
    index("subject_organizationId_name_idx").on(table.organizationId, table.name),
  ],
);

export const academicPeriod = pgTable(
  "academic_period",
  {
    id: id(),
    organizationId: organizationId(),
    academicYear: text("academic_year").notNull(),
    orderNum: integer("order_num").notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    shortName: varchar("short_name", { length: 10 }).notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("academic_period_organizationId_id_unique").on(table.organizationId, table.id),
    unique(PERIOD_SHORT_NAME_UNIQUE).on(table.organizationId, table.academicYear, table.shortName),
    // D6: the spec has no rule for repeated order numbers; 1..4 per year implies uniqueness.
    unique(PERIOD_ORDER_UNIQUE).on(table.organizationId, table.academicYear, table.orderNum),
    uniqueIndex(PERIOD_ACTIVE_UNIQUE)
      .on(table.organizationId)
      .where(sql`${table.isActive}`),
    check("academic_period_order_check", sql`${table.orderNum} between 1 and 4`),
    check("academic_period_dates_check", sql`${table.startDate} < ${table.endDate}`),
    check("academic_period_year_check", sql`${table.academicYear} ~ '^[0-9]{4}$'`),
  ],
);

export const gradeCriterion = pgTable(
  "grade_criterion",
  {
    id: id(),
    organizationId: organizationId(),
    name: varchar("name", { length: 100 }).notNull(),
    weight: numeric("weight", { precision: 5, scale: 2 }).notNull(),
    description: varchar("description", { length: 300 }),
    orderNum: integer("order_num").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("grade_criterion_organizationId_id_unique").on(table.organizationId, table.id),
    index("grade_criterion_organizationId_orderNum_idx").on(table.organizationId, table.orderNum),
    // Σ weights = 100 is validated by the service, never enforced here (foundation §5.5).
    check("grade_criterion_weight_check", sql`${table.weight} > 0 and ${table.weight} <= 100`),
    check("grade_criterion_order_check", sql`${table.orderNum} >= 1`),
  ],
);

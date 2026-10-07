import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

/** Identity document types (sige/00 §5.2). Values are domain vocabulary shown in the UI. */
export const documentType = pgEnum("document_type", ["TI", "CC", "RC", "CE", "Pasaporte"]);
export const gender = pgEnum("gender", ["M", "F", "Otro"]);

/** Exact constraint name, matched by `provisionUser` to map a race to `DOCUMENT_TAKEN`. */
export const PERSON_DOCUMENT_UNIQUE = "person_organizationId_documentNumber_unique";

/**
 * SIGE profile of a better-auth user inside one institution (sige/00 §5.2, sige/01 §2.1).
 * The role lives in `member.role`; `user.name` mirrors "first last". `user_id` restricts deletion:
 * a person is deactivated, never orphaned (R2.6). Rows are only written by `provisionUser`.
 */
export const person = pgTable(
  "person",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    documentType: documentType("document_type").default("CC").notNull(),
    documentNumber: text("document_number").notNull(),
    birthDate: date("birth_date", { mode: "string" }),
    gender: gender("gender"),
    phone: text("phone"),
    address: text("address"),
    country: text("country").default("Colombia"),
    department: text("department"),
    municipality: text("municipality"),
    hasRealEmail: boolean("has_real_email").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    mustChangePassword: boolean("must_change_password").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    // R2.3: target of the composite tenant-safe FKs of later tables.
    unique("person_organizationId_id_unique").on(table.organizationId, table.id),
    uniqueIndex("person_userId_unique").on(table.userId),
    uniqueIndex(PERSON_DOCUMENT_UNIQUE).on(table.organizationId, table.documentNumber),
    index("person_organizationId_names_idx").on(
      table.organizationId,
      table.lastName,
      table.firstName,
    ),
    index("person_organizationId_isActive_idx").on(table.organizationId, table.isActive),
  ],
);

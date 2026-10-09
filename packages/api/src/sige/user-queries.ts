import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Row and detail projections of a person with its login and role (sige/03 `UserRow`,
 * `UserDetail`), shared by the `user.*` read procedures and the write services that return the
 * affected row.
 */

/** First role name of a (possibly comma-separated) `member.role`. */
export const primaryRole = (role: string) => role.split(",")[0]?.trim() ?? role;

export const rowColumns = {
  personId: schema.person.id,
  userId: schema.person.userId,
  username: schema.user.username,
  email: schema.user.email,
  hasRealEmail: schema.person.hasRealEmail,
  firstName: schema.person.firstName,
  lastName: schema.person.lastName,
  role: schema.member.role,
  isActive: schema.person.isActive,
  mustChangePassword: schema.person.mustChangePassword,
  lastLoginAt: schema.person.lastLoginAt,
  createdAt: schema.person.createdAt,
};

export const detailColumns = {
  ...rowColumns,
  documentType: schema.person.documentType,
  documentNumber: schema.person.documentNumber,
  birthDate: schema.person.birthDate,
  gender: schema.person.gender,
  phone: schema.person.phone,
  address: schema.person.address,
  country: schema.person.country,
  department: schema.person.department,
  municipality: schema.person.municipality,
};

type RowRecord = {
  personId: string;
  userId: string;
  username: string | null;
  email: string;
  hasRealEmail: boolean;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export function toUserRow(row: RowRecord, isSelf: boolean) {
  return {
    personId: row.personId,
    userId: row.userId,
    username: row.username ?? "",
    // Placeholder addresses (`...@sin-correo.<slug>.invalid`) are internal (OD-1).
    email: row.hasRealEmail ? row.email : null,
    firstName: row.firstName,
    lastName: row.lastName,
    name: `${row.firstName} ${row.lastName}`,
    role: primaryRole(row.role),
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    isSelf,
  };
}

/** Join conditions that attach the login (`user`) and role (`member`) to each person. */
export const onLogin = eq(schema.user.id, schema.person.userId);
export const onMember = and(
  eq(schema.member.organizationId, schema.person.organizationId),
  eq(schema.member.userId, schema.person.userId),
);

export async function loadUserDetail(
  db: Database,
  organizationId: string,
  personId: string,
  selfPersonId: string | null,
) {
  const [row] = await db
    .select(detailColumns)
    .from(schema.person)
    .innerJoin(schema.user, onLogin)
    .innerJoin(schema.member, onMember)
    .where(and(eq(schema.person.organizationId, organizationId), eq(schema.person.id, personId)))
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    ...toUserRow(row, row.personId === selfPersonId),
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    birthDate: row.birthDate,
    gender: row.gender,
    phone: row.phone,
    address: row.address,
    country: row.country,
    department: row.department,
    municipality: row.municipality,
    hasRealEmail: row.hasRealEmail,
    // No student profile exists until module 05 (D4).
    studentId: null as string | null,
  };
}

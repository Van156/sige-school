import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { generateUsername, UsernameGenerationError } from "@base-template/sige-core";
import { escapeLikePattern } from "@base-template/db/lib/list-values";
import { and, count, eq, like, sql } from "drizzle-orm";

import { buildUserListQuery, hasAnyRoleToken, hasRoleToken } from "../lib/user-list-config";
import type { ListInput } from "../lib/list-input";

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

/** The person's academic profile (`student.id`, sige/05), null when none ("Ver Perfil Académico"). */
const academicProfileId = sql<
  string | null
>`(select ${schema.student.id} from ${schema.student} where ${schema.student.organizationId} = ${schema.person.organizationId} and ${schema.student.personId} = ${schema.person.id})`;

export async function loadUserDetail(
  db: Database,
  organizationId: string,
  personId: string,
  selfPersonId: string | null,
) {
  const [row] = await db
    .select({ ...detailColumns, studentId: academicProfileId })
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
    studentId: row.studentId,
  };
}

/** Server-list mode (R3.8) over one institution's users: `{ rows, total }`; `total` ignores paging. */
export async function listUserRows(
  db: Database,
  organizationId: string,
  input: ListInput<string, string>,
  selfPersonId: string | null,
) {
  const query = buildUserListQuery(input as never);
  const scope = and(eq(schema.person.organizationId, organizationId), query.where);
  const [rows, [totalRow]] = await Promise.all([
    db
      .select(rowColumns)
      .from(schema.person)
      .innerJoin(schema.user, onLogin)
      .innerJoin(schema.member, onMember)
      .where(scope)
      .orderBy(...query.orderBy)
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: count() })
      .from(schema.person)
      .innerJoin(schema.user, onLogin)
      .innerJoin(schema.member, onMember)
      .where(scope),
  ]);
  return {
    rows: rows.map((row) => toUserRow(row, row.personId === selfPersonId)),
    total: totalRow?.total ?? 0,
  };
}

/** Role tallies of one institution; `admins` counts `owner` and `admin` members. */
export async function institutionRoleCounts(db: Database, organizationId: string) {
  const [row] = await db
    .select({
      admins: sql<number>`count(*) filter (where ${hasAnyRoleToken("admin")})`.mapWith(Number),
      coordinators: sql<number>`count(*) filter (where ${hasRoleToken("coordinator")})`.mapWith(
        Number,
      ),
      teachers: sql<number>`count(*) filter (where ${hasRoleToken("teacher")})`.mapWith(Number),
      students: sql<number>`count(*) filter (where ${hasRoleToken("student")})`.mapWith(Number),
    })
    .from(schema.person)
    .innerJoin(schema.user, onLogin)
    .innerJoin(schema.member, onMember)
    .where(eq(schema.person.organizationId, organizationId));
  return {
    admins: row?.admins ?? 0,
    coordinators: row?.coordinators ?? 0,
    teachers: row?.teachers ?? 0,
    students: row?.students ?? 0,
  };
}

/**
 * Live username preview (USR-R2); `null` while any part is empty. Usernames are unique across
 * tenants, so the check is global; `organizationId` only scopes the "document taken" answer
 * (absent = never taken). Writes nothing.
 */
export async function previewUsernameFor(
  db: Database,
  organizationId: string | undefined,
  input: { firstName: string; lastName: string; documentNumber: string },
) {
  if (!input.firstName || !input.lastName || !input.documentNumber) {
    return { username: null, documentTaken: false };
  }
  let base: string;
  try {
    base = generateUsername(input, new Set());
  } catch (error) {
    if (error instanceof UsernameGenerationError) {
      return { username: null, documentTaken: false };
    }
    throw error;
  }
  const [taken, [document]] = await Promise.all([
    db
      .select({ username: schema.user.username })
      .from(schema.user)
      .where(like(schema.user.username, `${escapeLikePattern(base)}%`)),
    organizationId === undefined
      ? Promise.resolve([] as { id: string }[])
      : db
          .select({ id: schema.person.id })
          .from(schema.person)
          .where(
            and(
              eq(schema.person.organizationId, organizationId),
              eq(schema.person.documentNumber, input.documentNumber),
            ),
          )
          .limit(1),
  ]);
  const username = generateUsername(
    input,
    new Set(taken.flatMap((row) => (row.username ? [row.username] : []))),
  );
  return { username, documentTaken: document !== undefined };
}

import type { Database } from "@base-template/db";
import { buildListQuery, buildListWhere } from "@base-template/db/lib/list-query";
import type { ListColumns } from "@base-template/db/lib/list-query";
import { escapeLikePattern } from "@base-template/db/lib/list-values";
import * as schema from "@base-template/db/schema";
import { and, asc, count, eq, ilike, notExists, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

import { hasRoleToken } from "../lib/user-list-config";
import type { ListInput } from "../lib/list-input";
import { onLogin, onMember } from "./user-queries";

/**
 * Read projections of module 05 (sige/05 §3.1 `StudentRow`, `StudentDetail`, `GuardianLink`,
 * the picker and the incomplete-profiles list). Every query starts from the caller's tenant and
 * ANDs the caller's `ScopePolicy.studentWhere()` (STU-R1) where students are read.
 */

type Reader = Pick<Database, "select">;

const fullName = sql<string>`${schema.person.firstName} || ' ' || ${schema.person.lastName}`;
const sortName = sql`${schema.person.lastName} || ' ' || ${schema.person.firstName}`;

const sameOrg = (column: AnyColumn) => eq(column, schema.student.organizationId);
/** Join conditions: student -> person, campus, (optional) course. */
const ON = {
  person: and(sameOrg(schema.person.organizationId), eq(schema.person.id, schema.student.personId)),
  campus: and(sameOrg(schema.campus.organizationId), eq(schema.campus.id, schema.student.campusId)),
  course: and(sameOrg(schema.course.organizationId), eq(schema.course.id, schema.student.courseId)),
};

export const studentRowColumns = {
  id: schema.student.id,
  personId: schema.student.personId,
  name: fullName,
  documentType: schema.person.documentType,
  documentNumber: schema.person.documentNumber,
  courseId: schema.student.courseId,
  courseName: schema.course.name,
  campusId: schema.student.campusId,
  campusName: schema.campus.name,
  status: schema.student.status,
  guardianName: schema.student.guardianName,
};

const detailColumns = {
  ...studentRowColumns,
  username: schema.user.username,
  email: schema.user.email,
  hasRealEmail: schema.person.hasRealEmail,
  phone: schema.person.phone,
  birthDate: schema.person.birthDate,
  gender: schema.person.gender,
  address: schema.person.address,
  neighborhood: schema.student.neighborhood,
  stratum: schema.student.stratum,
  bloodType: schema.student.bloodType,
  eps: schema.student.eps,
  guardianPhone: schema.student.guardianPhone,
  guardianEmail: schema.student.guardianEmail,
  enrolledYear: schema.student.enrolledYear,
};

const studentsFrom = <T extends Record<string, unknown>>(db: Reader, columns: T) =>
  db
    .select(columns as never)
    .from(schema.student)
    .innerJoin(schema.person, ON.person)
    .innerJoin(schema.campus, ON.campus)
    .leftJoin(schema.course, ON.course)
    .$dynamic();

const inTenant = (organizationId: string, scope: SQL | undefined) =>
  and(eq(schema.student.organizationId, organizationId), scope);

/** Sort ids to columns; the only way a client sort id reaches SQL. */
const SORT_COLUMNS = {
  name: sortName as unknown as AnyColumn,
  document: schema.person.documentNumber,
  course: schema.course.name,
  campus: schema.campus.name,
  status: schema.student.status,
} as const satisfies ListColumns;

/** The `name` text filter: student name, document or "Acudiente Principal" name. */
const studentSearch = sql`${schema.person.firstName} || ' ' || ${schema.person.lastName} || ' ' || ${schema.person.documentNumber} || ' ' || coalesce(${schema.student.guardianName}, '')`;

const FILTER_COLUMNS = {
  name: studentSearch as unknown as AnyColumn,
  campusId: schema.student.campusId,
  courseId: schema.student.courseId,
  status: schema.student.status,
} as const satisfies ListColumns;

export type StudentRow = {
  id: string;
  personId: string;
  name: string;
  documentType: string;
  documentNumber: string;
  courseId: string | null;
  courseName: string | null;
  campusId: string;
  campusName: string;
  status: "activo" | "retirado" | "graduado";
  guardianName: string | null;
};

export async function listStudentRows(
  db: Reader,
  organizationId: string,
  input: ListInput<string, string>,
  scope: SQL | undefined,
): Promise<{ rows: StudentRow[]; total: number }> {
  const sorted = buildListQuery({
    columns: SORT_COLUMNS,
    input: { ...input, filters: [] },
    tieBreakers: [schema.student.id],
  });
  const filtered = buildListWhere({
    columns: FILTER_COLUMNS,
    filters: input.filters,
    joinOperator: input.joinOperator,
  });
  const where = and(inTenant(organizationId, scope), filtered);
  const [rows, [totalRow]] = await Promise.all([
    studentsFrom(db, studentRowColumns)
      .where(where)
      .orderBy(...sorted.orderBy)
      .limit(sorted.limit)
      .offset(sorted.offset),
    studentsFrom(db, { total: count() }).where(where),
  ]);
  return {
    rows: rows as unknown as StudentRow[],
    total: (totalRow as { total: number } | undefined)?.total ?? 0,
  };
}

export type GuardianLink = {
  guardianPersonId: string;
  name: string;
  username: string;
  relationship: string;
  email: string | null;
  phone: string | null;
};

async function guardianLinks(
  db: Reader,
  organizationId: string,
  studentId: string,
): Promise<GuardianLink[]> {
  const rows = await db
    .select({
      guardianPersonId: schema.studentGuardian.guardianPersonId,
      name: fullName,
      username: schema.user.username,
      relationship: schema.studentGuardian.relationship,
      email: schema.user.email,
      hasRealEmail: schema.person.hasRealEmail,
      phone: schema.person.phone,
    })
    .from(schema.studentGuardian)
    .innerJoin(
      schema.person,
      and(
        eq(schema.person.organizationId, schema.studentGuardian.organizationId),
        eq(schema.person.id, schema.studentGuardian.guardianPersonId),
      ),
    )
    .innerJoin(schema.user, onLogin)
    .where(
      and(
        eq(schema.studentGuardian.organizationId, organizationId),
        eq(schema.studentGuardian.studentId, studentId),
      ),
    )
    .orderBy(asc(schema.person.lastName), asc(schema.person.firstName), asc(schema.person.id));
  return rows.map(({ hasRealEmail, ...row }) => ({
    ...row,
    username: row.username ?? "",
    // Placeholder addresses are internal (OD-1).
    email: hasRealEmail ? row.email : null,
  }));
}

export type StudentDetail = StudentRow & {
  username: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: "M" | "F" | "Otro" | null;
  address: string | null;
  neighborhood: string | null;
  stratum: number | null;
  bloodType: string | null;
  eps: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  enrolledYear: string;
  guardians: GuardianLink[];
};

/** `StudentDetail` of one student in the tenant and `scope`; `null` when invisible. */
export async function loadStudentDetail(
  db: Reader,
  organizationId: string,
  studentId: string,
  scope?: SQL,
): Promise<StudentDetail | null> {
  const [row] = (await studentsFrom(db, detailColumns)
    .innerJoin(schema.user, onLogin)
    .where(and(inTenant(organizationId, scope), eq(schema.student.id, studentId)))
    .limit(1)) as unknown as (Omit<StudentDetail, "guardians" | "username"> & {
    username: string | null;
    email: string;
    hasRealEmail: boolean;
  })[];
  if (!row) return null;
  const { hasRealEmail, ...detail } = row;
  return {
    ...detail,
    username: row.username ?? "",
    email: hasRealEmail ? row.email : null,
    guardians: await guardianLinks(db, organizationId, studentId),
  };
}

/** `student.pick` (R1.16): active students in scope, optionally of one course, by name/document. */
export async function pickStudents(
  db: Reader,
  organizationId: string,
  input: { courseId?: string; search?: string; limit: number },
  scope: SQL | undefined,
) {
  const pattern = input.search ? `%${escapeLikePattern(input.search)}%` : undefined;
  return db
    .select({
      id: schema.student.id,
      name: fullName,
      document: schema.person.documentNumber,
      courseId: schema.student.courseId,
      courseName: schema.course.name,
      status: schema.student.status,
    })
    .from(schema.student)
    .innerJoin(schema.person, ON.person)
    .leftJoin(schema.course, ON.course)
    .where(
      and(
        inTenant(organizationId, scope),
        eq(schema.student.status, "activo"),
        input.courseId ? eq(schema.student.courseId, input.courseId) : undefined,
        pattern
          ? or(ilike(fullName, pattern), ilike(schema.person.documentNumber, pattern))
          : undefined,
      ),
    )
    .orderBy(asc(schema.person.lastName), asc(schema.person.firstName), asc(schema.student.id))
    .limit(input.limit);
}

const INCOMPLETE_SORT_COLUMNS = {
  name: sortName as unknown as AnyColumn,
  createdAt: schema.person.createdAt,
} as const satisfies ListColumns;

const INCOMPLETE_FILTER_COLUMNS = {
  name: sql`${schema.person.firstName} || ' ' || ${schema.person.lastName} || ' ' || ${schema.person.documentNumber}` as unknown as AnyColumn,
} as const satisfies ListColumns;

/** "Perfiles Académicos Incompletos": persons with member role `student` and no profile. */
export async function listIncompleteStudents(
  db: Reader,
  organizationId: string,
  input: ListInput<string, string>,
) {
  const sorted = buildListQuery({
    columns: INCOMPLETE_SORT_COLUMNS,
    input: { ...input, filters: [] },
    tieBreakers: [schema.person.id],
  });
  const filtered = buildListWhere({
    columns: INCOMPLETE_FILTER_COLUMNS,
    filters: input.filters,
    joinOperator: input.joinOperator,
  });
  const where = and(
    eq(schema.person.organizationId, organizationId),
    hasRoleToken("student"),
    notExists(
      db
        .select({ one: sql`1` })
        .from(schema.student)
        .where(
          and(
            eq(schema.student.organizationId, schema.person.organizationId),
            eq(schema.student.personId, schema.person.id),
          ),
        ),
    ),
    filtered,
  );
  const base = <T extends Record<string, unknown>>(columns: T) =>
    db
      .select(columns as never)
      .from(schema.person)
      .innerJoin(schema.user, onLogin)
      .innerJoin(schema.member, onMember)
      .where(where)
      .$dynamic();
  const [rows, [totalRow]] = await Promise.all([
    base({
      personId: schema.person.id,
      firstName: schema.person.firstName,
      lastName: schema.person.lastName,
      documentType: schema.person.documentType,
      documentNumber: schema.person.documentNumber,
      username: schema.user.username,
      email: schema.user.email,
      hasRealEmail: schema.person.hasRealEmail,
    })
      .orderBy(...sorted.orderBy)
      .limit(sorted.limit)
      .offset(sorted.offset),
    base({ total: count() }),
  ]);
  type Row = {
    personId: string;
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    username: string | null;
    email: string;
    hasRealEmail: boolean;
  };
  return {
    rows: (rows as unknown as Row[]).map((row) => ({
      personId: row.personId,
      name: `${row.firstName} ${row.lastName}`,
      documentType: row.documentType,
      documentNumber: row.documentNumber,
      username: row.username ?? "",
      email: row.hasRealEmail ? row.email : null,
    })),
    total: (totalRow as { total: number } | undefined)?.total ?? 0,
  };
}

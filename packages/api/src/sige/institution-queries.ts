import type { Database } from "@base-template/db";
import { buildListQuery } from "@base-template/db/lib/list-query";
import type { ListColumns } from "@base-template/db/lib/list-query";
import * as schema from "@base-template/db/schema";
import { count, eq, inArray, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

import type { ListInput } from "../lib/list-input";
import { rectorsFor } from "./list-institutions";
import type { InstitutionListItem } from "./list-institutions";

/**
 * Read side of the platform institution procedures (sige/02 §3.1, INS-01/02/03). Everything here
 * is cross-tenant by design (the caller is a platform operator), so each query is scoped by the
 * explicit institution id or is a deliberate all-institutions aggregate.
 */

type Reader = Pick<Database, "select">;

/** Roles that count as institution administrators ("Total Admins" KPI). */
const ADMIN_ROLES = ["owner", "admin"];

const campusCount = sql<number>`(select count(*)::int from ${schema.campus} where ${schema.campus.organizationId} = ${schema.organization.id})`;
/** Active students of the institution (`status = activo`, as the course counts; D3). */
const studentCount = sql<number>`(select count(*)::int from ${schema.student} where ${schema.student.organizationId} = ${schema.organization.id} and ${schema.student.status} = 'activo')`;
const adminCount = sql<number>`(select count(*)::int from ${schema.member} where ${schema.member.organizationId} = ${schema.organization.id} and ${schema.member.role} in ${ADMIN_ROLES})`;

const rowColumns = {
  id: schema.organization.id,
  name: schema.organization.name,
  slug: schema.organization.slug,
  logo: schema.organization.logo,
  createdAt: schema.organization.createdAt,
  email: schema.institutionProfile.email,
  nit: schema.institutionProfile.nit,
  municipality: schema.institutionProfile.municipality,
  department: schema.institutionProfile.department,
  academicYear: schema.institutionProfile.currentAcademicYear,
  phone: schema.institutionProfile.phone,
  address: schema.institutionProfile.address,
  resolution: schema.institutionProfile.resolution,
  campuses: campusCount,
  students: studentCount,
  admins: adminCount,
};

/** List-input ids to columns; the only way a client id reaches SQL. */
const LIST_COLUMNS = {
  name: schema.organization.name,
  nit: schema.institutionProfile.nit,
  municipality: schema.institutionProfile.municipality,
  academicYear: schema.institutionProfile.currentAcademicYear,
  campuses: campusCount as unknown as AnyColumn,
  students: studentCount as unknown as AnyColumn,
  createdAt: schema.organization.createdAt,
} as const satisfies ListColumns;

const selectRows = (db: Reader) =>
  db
    .select(rowColumns)
    .from(schema.organization)
    .leftJoin(
      schema.institutionProfile,
      eq(schema.institutionProfile.organizationId, schema.organization.id),
    )
    .$dynamic();

type RawRow = Awaited<ReturnType<typeof selectRows>>[number];

export type InstitutionRow = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  email: string | null;
  nit: string | null;
  municipality: string | null;
  department: string | null;
  academicYear: string;
  createdAt: Date;
  counts: { campuses: number; students: number; admins: number };
  /** The oldest `owner` member; null when none exists. Extra to the spec row (INS-01 P0 table). */
  rector: InstitutionListItem["rector"];
};

export type InstitutionDetail = InstitutionRow & {
  phone: string | null;
  address: string | null;
  resolution: string | null;
};

const currentYear = () => String(new Date().getFullYear());

function toDetail(row: RawRow, rector: InstitutionListItem["rector"]): InstitutionDetail {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo: row.logo ?? null,
    email: row.email ?? null,
    nit: row.nit ?? null,
    municipality: row.municipality ?? null,
    department: row.department ?? null,
    // An organization with no profile row reads as the current year until the profile is saved.
    academicYear: row.academicYear ?? currentYear(),
    createdAt: row.createdAt,
    counts: { campuses: row.campuses, students: row.students, admins: row.admins },
    rector,
    phone: row.phone ?? null,
    address: row.address ?? null,
    resolution: row.resolution ?? null,
  };
}

export async function listInstitutionRows(
  db: Reader,
  input: ListInput,
): Promise<{ rows: InstitutionRow[]; total: number }> {
  const query = buildListQuery({
    columns: LIST_COLUMNS,
    input,
    tieBreakers: [schema.organization.id],
  });
  const [raw, [totalRow]] = await Promise.all([
    selectRows(db)
      .where(query.where)
      .orderBy(...query.orderBy)
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: count() })
      .from(schema.organization)
      .leftJoin(
        schema.institutionProfile,
        eq(schema.institutionProfile.organizationId, schema.organization.id),
      )
      .where(query.where),
  ]);
  const rectors = await rectorsFor(
    db,
    raw.map((row) => row.id),
  );
  const rows = raw.map((row) => {
    const {
      phone: _phone,
      address: _address,
      resolution: _resolution,
      ...base
    } = toDetail(row, rectors.get(row.id) ?? null);
    return base;
  });
  return { rows, total: totalRow?.total ?? 0 };
}

/** `null` when the institution does not exist. */
export async function findInstitutionDetail(
  db: Reader,
  id: string,
): Promise<InstitutionDetail | null> {
  const [row] = await selectRows(db).where(eq(schema.organization.id, id)).limit(1);
  if (!row) return null;
  const rectors = await rectorsFor(db, [id]);
  return toDetail(row, rectors.get(id) ?? null);
}

/** KPI tiles of INS-01: totals over every institution. */
export async function institutionStats(db: Reader) {
  const [institutions, campuses, students, admins] = await Promise.all([
    db.select({ total: count() }).from(schema.organization),
    db.select({ total: count() }).from(schema.campus),
    db.select({ total: count() }).from(schema.student).where(eq(schema.student.status, "activo")),
    db
      .select({ total: count() })
      .from(schema.member)
      .where(inArray(schema.member.role, ADMIN_ROLES)),
  ]);
  return {
    institutions: institutions[0]?.total ?? 0,
    campuses: campuses[0]?.total ?? 0,
    students: students[0]?.total ?? 0,
    admins: admins[0]?.total ?? 0,
  };
}

import type { SigeKind } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { eq, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

/**
 * Row-level scope resolver (sige/00 §4.3, sige/01 AUTH-R2). Role grants say WHAT a caller may do;
 * `ScopePolicy` says WHICH rows. It is resolved once per request by `sigeProcedure` and is the only
 * way module code restricts tenant rows to a caller's visible students and offerings.
 * See docs/architecture/authorization.md#scopepolicy
 */

/** Built-in role name, or `custom` for any dynamic role (institution-wide, no row scope, R1.10). */
export type CallerKind = SigeKind | "custom";

/** Kinds whose rows are restricted. Every other kind sees the whole institution. */
export type RestrictedKind = "teacher" | "student" | "parent";

const RESTRICTED_KINDS: readonly CallerKind[] = ["teacher", "student", "parent"];

export function isRestrictedKind(kind: CallerKind): kind is RestrictedKind {
  return RESTRICTED_KINDS.includes(kind);
}

/** Who is asking, in which tenant. `organizationId` comes from the session, never from input. */
export type ScopeSubject = {
  kind: CallerKind;
  organizationId: string;
  personId: string;
};

/** Predicate over a module's table, ANDed into every query for a restricted caller. */
export type RowPredicate = (subject: ScopeSubject) => SQL;

/**
 * Lifts a `student` / `offering` predicate onto another table's foreign-key column, so a module
 * can filter its own rows (`grade_record`, `attendance_record`, `observation`) without joining the
 * scoped table (D4). `scopeWhere` is the caller's predicate; `idColumn` is the row's `student_id`
 * or `offering_id`.
 */
export type RowLift = (subject: ScopeSubject, scopeWhere: SQL, idColumn: AnyColumn) => SQL;

/**
 * Seams that later modules fill in (P1+). P0 has no course, offering or guardian tables, so every
 * default fails closed: a restricted caller sees nothing and `assert*` throws `NOT_FOUND`.
 *
 * - `studentWhere` / `offeringWhere`: per restricted kind, the predicate over the module's own
 *   `student` / `offering` table (teacher: OD-21 offerings and director courses; student: own
 *   row; parent: `student_guardian` links). Missing entry = fail closed.
 * - `studentRowWhere` / `offeringRowWhere`: the same predicates lifted onto another table's
 *   `student_id` / `offering_id` column (D4). Missing implementation = fail closed.
 * - `studentVisible` / `offeringVisible`: whether one row id exists in the caller's tenant AND
 *   satisfies `scopeWhere` (the predicate above; `undefined` for unrestricted callers). The module
 *   implements it with a single tenant-filtered select.
 */
export type ScopeResolvers = {
  studentWhere: Partial<Record<RestrictedKind, RowPredicate>>;
  offeringWhere: Partial<Record<RestrictedKind, RowPredicate>>;
  studentRowWhere: RowLift;
  offeringRowWhere: RowLift;
  studentVisible: (
    subject: ScopeSubject,
    studentId: string,
    scopeWhere: SQL | undefined,
  ) => Promise<boolean>;
  offeringVisible: (
    subject: ScopeSubject,
    offeringId: string,
    scopeWhere: SQL | undefined,
  ) => Promise<boolean>;
};

const FAIL_CLOSED: SQL = sql`false`;

/** Fail-closed defaults. A module replaces the entries it implements (see the docs seam list). */
export const DEFAULT_SCOPE_RESOLVERS: ScopeResolvers = {
  studentWhere: {},
  offeringWhere: {},
  studentRowWhere: () => FAIL_CLOSED,
  offeringRowWhere: () => FAIL_CLOSED,
  studentVisible: async () => false,
  offeringVisible: async () => false,
};

export interface ScopePolicy {
  readonly kind: CallerKind;
  /** True for owner, admin, coordinator, viewer and custom: no row restriction. */
  readonly unrestricted: boolean;
  /** Predicate over `student` to AND into every query; `undefined` means unrestricted. */
  studentWhere(): SQL | undefined;
  /** Predicate over `offering` to AND into every query; `undefined` means unrestricted. */
  offeringWhere(): SQL | undefined;
  /**
   * `studentWhere` applied to another table's `student_id` column: the predicate GRD-08 and the
   * observation reads AND into their own queries (D4). `undefined` means unrestricted.
   */
  studentRowWhere(studentIdColumn: AnyColumn): SQL | undefined;
  /**
   * `offeringWhere` applied to another table's `offering_id` column (D4). ATT-R5: this is the one
   * predicate `attendance.studentSummary`, `history` and `calendar` all use, so a teacher's table
   * and KPIs are computed over exactly the same rows.
   */
  offeringRowWhere(offeringIdColumn: AnyColumn): SQL | undefined;
  /** `organization_id = <caller's org>` for a column; every tenant query starts from it (R3.3). */
  inTenant(organizationIdColumn: AnyColumn): SQL;
  /** Whether `personId` is the caller's own person (rule available without module tables). */
  isSelf(personId: string): boolean;
  /** Throws `NOT_FOUND` (never `FORBIDDEN`, R1.15) when the student is outside tenant or scope. */
  assertStudent(studentId: string): Promise<void>;
  /** Throws `NOT_FOUND` (never `FORBIDDEN`, R1.15) when the offering is outside tenant or scope. */
  assertOffering(offeringId: string): Promise<void>;
}

function notFound(resource: string): ORPCError<"NOT_FOUND", undefined> {
  return new ORPCError("NOT_FOUND", { message: `${resource} not found.` });
}

export function createScopePolicy(
  subject: ScopeSubject,
  resolvers: ScopeResolvers = DEFAULT_SCOPE_RESOLVERS,
): ScopePolicy {
  const restricted = isRestrictedKind(subject.kind);
  const predicate = (byKind: Partial<Record<RestrictedKind, RowPredicate>>): SQL | undefined => {
    if (!isRestrictedKind(subject.kind)) {
      return undefined;
    }
    return byKind[subject.kind]?.(subject) ?? FAIL_CLOSED;
  };

  const lift = (
    byKind: Partial<Record<RestrictedKind, RowPredicate>>,
    rowLift: RowLift,
    idColumn: AnyColumn,
  ): SQL | undefined => {
    const scopeWhere = predicate(byKind);
    return scopeWhere === undefined ? undefined : rowLift(subject, scopeWhere, idColumn);
  };

  return {
    kind: subject.kind,
    unrestricted: !restricted,
    studentWhere: () => predicate(resolvers.studentWhere),
    offeringWhere: () => predicate(resolvers.offeringWhere),
    studentRowWhere: (studentIdColumn) =>
      lift(resolvers.studentWhere, resolvers.studentRowWhere, studentIdColumn),
    offeringRowWhere: (offeringIdColumn) =>
      lift(resolvers.offeringWhere, resolvers.offeringRowWhere, offeringIdColumn),
    inTenant: (column) => eq(column, subject.organizationId),
    isSelf: (personId) => personId === subject.personId,
    async assertStudent(studentId) {
      const visible = await resolvers.studentVisible(
        subject,
        studentId,
        predicate(resolvers.studentWhere),
      );
      if (!visible) {
        throw notFound("Student");
      }
    },
    async assertOffering(offeringId) {
      const visible = await resolvers.offeringVisible(
        subject,
        offeringId,
        predicate(resolvers.offeringWhere),
      );
      if (!visible) {
        throw notFound("Offering");
      }
    },
  };
}

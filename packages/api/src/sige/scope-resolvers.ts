import type { Database } from "@base-template/db";
import { offering, teacherAssignment } from "@base-template/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DEFAULT_SCOPE_RESOLVERS } from "./scope";
import type { RowPredicate, ScopeResolvers } from "./scope";

/**
 * The concrete `ScopeResolvers` the SIGE procedures use (sige/00 §4.3). P3 fills the offering
 * seam; student and parent offering scope, and every student resolver, stay fail-closed until
 * P4 ships the enrollment and guardian tables (sige/05).
 */

/** Assignment states that keep an offering in the teacher's scope (D3; `inactivo` removes it). */
export const TEACHER_SCOPE_STATUSES = ["activo", "temporal"] as const;

/**
 * Teacher: offerings where they are the teacher AND the assignment is `activo` or `temporal`.
 * Predicate over `offering`; managers have no predicate (whole tenant).
 */
const teacherOfferingWhere: RowPredicate = (subject) =>
  sql`(${eq(
    offering.teacherPersonId,
    subject.personId,
  )} and exists (select 1 from ${teacherAssignment} where ${eq(
    teacherAssignment.organizationId,
    offering.organizationId,
  )} and ${eq(teacherAssignment.offeringId, offering.id)} and ${inArray(teacherAssignment.status, [
    ...TEACHER_SCOPE_STATUSES,
  ])}))`;

export function createSigeScopeResolvers(db: Pick<Database, "select">): ScopeResolvers {
  return {
    ...DEFAULT_SCOPE_RESOLVERS,
    offeringWhere: { teacher: teacherOfferingWhere },
    async offeringVisible(subject, offeringId, scopeWhere) {
      const [row] = await db
        .select({ id: offering.id })
        .from(offering)
        .where(
          and(
            eq(offering.organizationId, subject.organizationId),
            eq(offering.id, offeringId),
            scopeWhere,
          ),
        )
        .limit(1);
      return row !== undefined;
    },
  };
}

import type { AuditLogger } from "@base-template/auth/audit";
import type { Database } from "@base-template/db";
import { escapeLikePattern } from "@base-template/db/lib/list-values";
import * as schema from "@base-template/db/schema";
import type { GuardianRelationship } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, ilike, notExists, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { hasRoleToken } from "../lib/user-list-config";
import { recordAudit } from "./audit";
import type { AuditContext } from "./audit";
import { rethrowDbError } from "./pg-errors";
import { guardianLinks } from "./student-queries";
import type { GuardianLink } from "./student-queries";
import { STUDENT_NOT_FOUND_MESSAGE } from "./student-service";
import { onLogin, onMember } from "./user-queries";

/**
 * Guardian links (sige/05 §3.1, STU-04, STU-R6, D5). A guardian is an ACTIVE person of the
 * institution whose member role includes `parent`; anything else (another role, inactive, unknown
 * or another tenant's person) is "El usuario seleccionado no es un acudiente.". The student is
 * always resolved inside the tenant and `ScopePolicy.studentWhere()`, so a foreign or
 * out-of-scope student is `NOT_FOUND` (R1.15). Link and unlink run in one transaction each with
 * the audit event as the last statement (P2 convention).
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select">;

export type GuardianServiceContext = AuditContext & {
  db: Database;
  auditLogger: AuditLogger;
  org: { id: string };
  scope: { studentWhere(): SQL | undefined };
};

export type GuardianCandidate = {
  personId: string;
  name: string;
  username: string;
  document: string;
};

export const NOT_A_GUARDIAN_MESSAGE = "El usuario seleccionado no es un acudiente.";
export const GUARDIAN_LINK_EXISTS_MESSAGE = "Este acudiente ya está vinculado a este estudiante.";
// Writer-authored (not in the spec).
export const GUARDIAN_NOT_LINKED_MESSAGE = "El acudiente no está vinculado a este estudiante.";

const studentNotFound = () => new ORPCError("NOT_FOUND", { message: STUDENT_NOT_FOUND_MESSAGE });

const fullName = sql<string>`${schema.person.firstName} || ' ' || ${schema.person.lastName}`;

/** The student id when visible to the caller (tenant + scope), optionally locked. */
async function visibleStudent(
  db: Reader | Tx,
  context: GuardianServiceContext,
  studentId: string,
  lock = false,
): Promise<string> {
  const query = db
    .select({ id: schema.student.id })
    .from(schema.student)
    .where(
      and(
        eq(schema.student.organizationId, context.org.id),
        eq(schema.student.id, studentId),
        context.scope.studentWhere(),
      ),
    );
  const [row] = await (lock ? query.for("update", { of: schema.student }) : query);
  if (!row) throw studentNotFound();
  return row.id;
}

/** `guardian.candidates`: active `parent` persons of the tenant not yet linked to the student. */
export async function listGuardianCandidates(
  context: GuardianServiceContext,
  input: { studentId: string; search?: string; limit: number },
): Promise<GuardianCandidate[]> {
  const studentId = await visibleStudent(context.db, context, input.studentId);
  const pattern = input.search ? `%${escapeLikePattern(input.search)}%` : null;
  const rows = await context.db
    .select({
      personId: schema.person.id,
      name: fullName,
      username: schema.user.username,
      document: schema.person.documentNumber,
    })
    .from(schema.person)
    .innerJoin(schema.member, onMember)
    .innerJoin(schema.user, onLogin)
    .where(
      and(
        eq(schema.person.organizationId, context.org.id),
        eq(schema.person.isActive, true),
        hasRoleToken("parent"),
        notExists(
          context.db
            .select({ id: schema.studentGuardian.id })
            .from(schema.studentGuardian)
            .where(
              and(
                eq(schema.studentGuardian.organizationId, context.org.id),
                eq(schema.studentGuardian.studentId, studentId),
                eq(schema.studentGuardian.guardianPersonId, schema.person.id),
              ),
            ),
        ),
        pattern
          ? or(
              ilike(fullName, pattern),
              ilike(schema.user.username, pattern),
              ilike(schema.person.documentNumber, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(asc(schema.person.lastName), asc(schema.person.firstName), asc(schema.person.id))
    .limit(input.limit);
  return rows.map((row) => ({ ...row, username: row.username ?? "" }));
}

/** STU-R6 / D5: the person must be an active `parent` of the tenant; locked against deactivation. */
async function assertGuardian(tx: Tx, organizationId: string, personId: string) {
  const [row] = await tx
    .select({ isActive: schema.person.isActive })
    .from(schema.person)
    .innerJoin(schema.member, onMember)
    .where(
      and(
        eq(schema.person.organizationId, organizationId),
        eq(schema.person.id, personId),
        hasRoleToken("parent"),
      ),
    )
    .for("share", { of: schema.person });
  if (!row?.isActive) {
    throw new ORPCError("BAD_REQUEST", { message: NOT_A_GUARDIAN_MESSAGE });
  }
}

/** `guardian.link`: one `student_guardian` row; a duplicate is `CONFLICT` (STU-R6). */
export async function linkGuardian(
  context: GuardianServiceContext,
  input: { studentId: string; guardianPersonId: string; relationship: GuardianRelationship },
): Promise<GuardianLink> {
  const orgId = context.org.id;
  try {
    await context.db.transaction(async (tx) => {
      const studentId = await visibleStudent(tx, context, input.studentId, true);
      await assertGuardian(tx, orgId, input.guardianPersonId);
      const [existing] = await tx
        .select({ id: schema.studentGuardian.id })
        .from(schema.studentGuardian)
        .where(
          and(
            eq(schema.studentGuardian.organizationId, orgId),
            eq(schema.studentGuardian.studentId, studentId),
            eq(schema.studentGuardian.guardianPersonId, input.guardianPersonId),
          ),
        );
      if (existing) {
        throw new ORPCError("CONFLICT", { status: 409, message: GUARDIAN_LINK_EXISTS_MESSAGE });
      }
      // The unique constraint stays the race-safe backstop (pg-errors maps it to the same text).
      await tx.insert(schema.studentGuardian).values({
        organizationId: orgId,
        studentId,
        guardianPersonId: input.guardianPersonId,
        relationship: input.relationship,
      });
      await recordAudit(context, {
        action: "guardian.linked",
        targetType: "student",
        targetId: studentId,
        metadata: {
          studentId,
          guardianPersonId: input.guardianPersonId,
          relationship: input.relationship,
        },
      });
    });
  } catch (error) {
    return rethrowDbError(error, "write");
  }
  const links = await guardianLinks(context.db, orgId, input.studentId);
  const link = links.find((row) => row.guardianPersonId === input.guardianPersonId);
  if (!link) throw studentNotFound();
  return link;
}

/** `guardian.unlink`: removes the link only; the guardian's account is untouched. */
export async function unlinkGuardian(
  context: GuardianServiceContext,
  input: { studentId: string; guardianPersonId: string },
): Promise<{ deleted: true }> {
  const orgId = context.org.id;
  try {
    await context.db.transaction(async (tx) => {
      const studentId = await visibleStudent(tx, context, input.studentId, true);
      const [removed] = await tx
        .delete(schema.studentGuardian)
        .where(
          and(
            eq(schema.studentGuardian.organizationId, orgId),
            eq(schema.studentGuardian.studentId, studentId),
            eq(schema.studentGuardian.guardianPersonId, input.guardianPersonId),
          ),
        )
        .returning({ relationship: schema.studentGuardian.relationship });
      if (!removed) {
        throw new ORPCError("NOT_FOUND", { message: GUARDIAN_NOT_LINKED_MESSAGE });
      }
      await recordAudit(context, {
        action: "guardian.unlinked",
        targetType: "student",
        targetId: studentId,
        metadata: {
          studentId,
          guardianPersonId: input.guardianPersonId,
          relationship: removed.relationship,
        },
      });
    });
  } catch (error) {
    return rethrowDbError(error, "delete");
  }
  return { deleted: true };
}

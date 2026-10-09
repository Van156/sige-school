import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { hasRoleToken } from "../lib/user-list-config";
import { onMember } from "./user-queries";

/** sige/02 §4.1. Also the answer for an id of another institution, so nothing leaks. */
export const DIRECTOR_MESSAGE = "El director debe ser un profesor activo de la institución.";

/**
 * A course director must be an active person with role `teacher` in the same institution (D9).
 * An unknown id, another tenant's person and a non-teacher are indistinguishable (`BAD_REQUEST`
 * with the spec message). `current` is the director the course already has: keeping it is allowed
 * even after the teacher was deactivated, so editing other fields never forces a change of
 * director.
 */
export async function assertCourseDirector(
  db: Pick<Database, "select">,
  organizationId: string,
  directorPersonId: string | null | undefined,
  current?: string | null,
): Promise<void> {
  if (directorPersonId == null || directorPersonId === current) {
    return;
  }
  const [teacher] = await db
    .select({ id: schema.person.id })
    .from(schema.person)
    .innerJoin(schema.member, onMember)
    .where(
      and(
        eq(schema.person.organizationId, organizationId),
        eq(schema.person.id, directorPersonId),
        eq(schema.person.isActive, true),
        hasRoleToken("teacher"),
      ),
    )
    .limit(1);
  if (!teacher) {
    throw new ORPCError("BAD_REQUEST", { message: DIRECTOR_MESSAGE });
  }
}

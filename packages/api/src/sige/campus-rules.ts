import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

/** Authored (not in sige/04 §4.1): SCH-R12 rejects inactive campuses for classrooms and blocks. */
export const CAMPUS_INACTIVE_MESSAGE = "La sede seleccionada no está activa.";

/**
 * The campus must exist in the institution (`NOT_FOUND`) and be active (`BAD_REQUEST`, SCH-R12).
 * Takes a share lock, so a concurrent deactivation waits for the surrounding transaction; call it
 * with the transaction handle that performs the write.
 */
export async function assertActiveCampus(
  db: Pick<Database, "select">,
  organizationId: string,
  campusId: string,
): Promise<void> {
  const [row] = await db
    .select({ active: schema.campus.active })
    .from(schema.campus)
    .where(and(eq(schema.campus.organizationId, organizationId), eq(schema.campus.id, campusId)))
    .for("share");
  if (!row) throw new ORPCError("NOT_FOUND", { message: "La sede no existe." });
  if (!row.active) throw new ORPCError("BAD_REQUEST", { message: CAMPUS_INACTIVE_MESSAGE });
}

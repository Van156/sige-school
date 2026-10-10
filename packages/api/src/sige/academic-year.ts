import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { eq } from "drizzle-orm";

/**
 * The institution's current academic year (`institution_profile.current_academic_year`). An
 * institution without a profile row falls back to the calendar year, like `institution.get`.
 */
export async function currentAcademicYear(
  db: Pick<Database, "select">,
  organizationId: string,
): Promise<string> {
  const [row] = await db
    .select({ year: schema.institutionProfile.currentAcademicYear })
    .from(schema.institutionProfile)
    .where(eq(schema.institutionProfile.organizationId, organizationId))
    .limit(1);
  return row?.year ?? String(new Date().getFullYear());
}

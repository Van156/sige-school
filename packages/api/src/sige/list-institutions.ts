import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

/** INS-01 has no paging in P0; the bound applies to institutions (sige/02 §3.1). */
export const INSTITUTION_LIST_LIMIT = 200;

export type InstitutionListItem = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  /** The oldest `owner` member (earliest `member.created_at`); null when none exists. */
  rector: { userId: string; name: string; username: string | null } | null;
};

/**
 * Newest institutions first, at most `limit` of them, each with its rector. The institutions are
 * limited before owners are joined in, so several owners per institution never shrink the page.
 * When an institution has several owners the oldest member row wins, deterministically.
 */
export async function listInstitutions(
  database: Database,
  limit: number = INSTITUTION_LIST_LIMIT,
): Promise<InstitutionListItem[]> {
  const institutions = await database
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      logo: schema.organization.logo,
      createdAt: schema.organization.createdAt,
    })
    .from(schema.organization)
    .orderBy(desc(schema.organization.createdAt), desc(schema.organization.id))
    .limit(limit);
  if (institutions.length === 0) {
    return [];
  }

  const owners = await database
    .select({
      organizationId: schema.member.organizationId,
      userId: schema.user.id,
      name: schema.user.name,
      username: schema.user.username,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(
      and(
        eq(schema.member.role, "owner"),
        inArray(
          schema.member.organizationId,
          institutions.map((institution) => institution.id),
        ),
      ),
    )
    .orderBy(asc(schema.member.createdAt), asc(schema.member.id));

  const rectorByOrganization = new Map<string, InstitutionListItem["rector"]>();
  for (const owner of owners) {
    if (!rectorByOrganization.has(owner.organizationId)) {
      rectorByOrganization.set(owner.organizationId, {
        userId: owner.userId,
        name: owner.name ?? "",
        username: owner.username ?? null,
      });
    }
  }
  return institutions.map((institution) => ({
    ...institution,
    rector: rectorByOrganization.get(institution.id) ?? null,
  }));
}

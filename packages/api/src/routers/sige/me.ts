import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

import { sigePasswordGateExemptProcedure } from "../../sige/procedure";

/**
 * `me` (sige/01 §3.2). Pilot router for P0: self only, any member, exempt from the
 * password gate so the web can route a freshly provisioned user to AUTH-03.
 * `institution` (profile data) joins the output when `institution_profile` lands (module 02).
 */
export const meRouter = {
  get: sigePasswordGateExemptProcedure.handler(async ({ context }) => {
    const [row] = await context.db
      .select({
        userId: schema.user.id,
        username: schema.user.username,
        email: schema.user.email,
        name: schema.user.name,
        documentType: schema.person.documentType,
        documentNumber: schema.person.documentNumber,
        phone: schema.person.phone,
        address: schema.person.address,
        hasRealEmail: schema.person.hasRealEmail,
        lastLoginAt: schema.person.lastLoginAt,
        orgName: schema.organization.name,
        orgSlug: schema.organization.slug,
        orgLogo: schema.organization.logo,
      })
      .from(schema.person)
      .innerJoin(schema.user, eq(schema.user.id, schema.person.userId))
      .innerJoin(schema.organization, eq(schema.organization.id, schema.person.organizationId))
      .where(eq(schema.person.id, context.person.id))
      .limit(1);
    if (!row) {
      throw new ORPCError("NOT_FOUND", { message: "Person not found." });
    }

    return {
      user: {
        id: row.userId,
        username: row.username ?? "",
        // Placeholder emails (OD-1) are an implementation detail, never shown.
        email: row.hasRealEmail ? row.email : null,
        name: row.name,
      },
      person: {
        id: context.person.id,
        firstName: context.person.firstName,
        lastName: context.person.lastName,
        documentType: row.documentType,
        documentNumber: row.documentNumber,
        phone: row.phone,
        address: row.address,
        hasRealEmail: row.hasRealEmail,
        mustChangePassword: context.person.mustChangePassword,
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      },
      kind: context.person.kind,
      roleName: context.person.roleName,
      org: { id: context.org.id, name: row.orgName, slug: row.orgSlug, logo: row.orgLogo },
      impersonating: Boolean(context.session.session.impersonatedBy),
    };
  }),
};

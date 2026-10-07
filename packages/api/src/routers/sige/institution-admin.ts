import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { platformProcedure } from "../../index";
import { createInstitution, InstitutionCreationError } from "../../sige/create-institution";

const text = (max: number) => z.string().trim().max(max);

/** `rectorInput` of sige/02 §3.1: provisionUser re-validates the same fields with Spanish messages. */
const rectorInput = z.object({
  firstName: text(100).min(1, "Los nombres son obligatorios."),
  lastName: text(100).min(1, "Los apellidos son obligatorios."),
  documentType: z.enum(["CC", "TI", "CE"], { message: "Tipo de documento inválido." }),
  documentNumber: text(20).min(5, "El documento debe tener al menos 5 caracteres."),
  email: text(254).pipe(z.email("Ingresa un correo válido.")),
  phone: text(30).optional(),
});

const createInput = z.object({
  // `institution_profile` fields (NIT, address, academic year, ...) arrive with module 02.
  institution: z.object({ name: text(100).min(1, "El nombre de la institución es obligatorio.") }),
  admin: rectorInput,
});

/** Platform (root) institution procedures; INS-01/02 minimal slice (sige/02 §3.1). */
export const institutionAdminRouter = {
  /** INS-01 list. Bounded (no paging in P0); the full list contract lands with module 02. */
  list: platformProcedure({ institution: ["update"] }).handler(async ({ context }) => {
    const rows = await context.db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
        logo: schema.organization.logo,
        createdAt: schema.organization.createdAt,
        rectorUserId: schema.user.id,
        rectorName: schema.user.name,
        rectorUsername: schema.user.username,
      })
      .from(schema.organization)
      .leftJoin(
        schema.member,
        and(
          eq(schema.member.organizationId, schema.organization.id),
          eq(schema.member.role, "owner"),
        ),
      )
      .leftJoin(schema.user, eq(schema.user.id, schema.member.userId))
      .orderBy(desc(schema.organization.createdAt), desc(schema.organization.id))
      .limit(200);

    // One row per institution (oldest owner wins when several exist).
    const seen = new Set<string>();
    return rows.flatMap((row) => {
      if (seen.has(row.id)) return [];
      seen.add(row.id);
      return [
        {
          id: row.id,
          name: row.name,
          slug: row.slug,
          logo: row.logo,
          createdAt: row.createdAt,
          rector: row.rectorUserId
            ? { userId: row.rectorUserId, name: row.rectorName ?? "", username: row.rectorUsername }
            : null,
        },
      ];
    });
  }),

  /** INS-02: creates the institution and its rector (role `owner`) as one audited operation. */
  create: platformProcedure({ institution: ["create"] })
    .input(createInput)
    .handler(async ({ context, input }) => {
      const actor = {
        userId: context.session.user.id,
        impersonatorUserId: context.session.session.impersonatedBy ?? undefined,
      };
      try {
        return await createInstitution(
          { database: context.db, auditLogger: context.auditLogger },
          { name: input.institution.name, rector: input.admin, actor },
        );
      } catch (error) {
        if (error instanceof InstitutionCreationError) {
          throw new ORPCError(error.code === "VALIDATION" ? "BAD_REQUEST" : "CONFLICT", {
            message: error.message,
          });
        }
        throw error;
      }
    }),
};

import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import type { Database } from "@base-template/db";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { platformProcedure, requireAnyPermission, requirePermission } from "../../index";
import { createListInput } from "../../lib/list-input";
import { escapeLikePattern } from "@base-template/db/lib/list-values";
import { hasRoleToken, userListConfig } from "../../lib/user-list-config";
import { defaultRateLimiter } from "../../rate-limit";
import {
  institutionRoleCounts,
  listUserRows,
  loadUserDetail,
  onLogin,
  onMember,
  previewUsernameFor,
} from "../../sige/user-queries";
import {
  passwordSchema,
  personId,
  platformUserCreateInput,
  userCheckEmailInput,
  userCreateInput,
  userOptionsInput,
  userPersonInput,
  userPreviewUsernameInput,
  userResetPasswordInput,
  userSetActiveInput,
  userUpdateInput,
} from "../../sige/schemas/user";
import {
  createUser,
  deleteUser,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "../../sige/user-service";
import type { UserActor } from "../../sige/user-service";
import { defaultImportRunner } from "../../sige/import-runner";
import { INSTITUTION_NOT_FOUND } from "../../sige/logo";
import {
  analyzeUserImport,
  getImportJob,
  NO_VALID_ROWS_MESSAGE,
  previewUserImport,
  startUserImport,
} from "../../sige/user-import-service";
import {
  buildImportTemplate,
  IMPORT_TEMPLATE_FILENAME,
  readImportUpload,
  XLSX_CONTENT_TYPE,
} from "../../sige/user-import-file";
import { sigeProcedure } from "../../sige/procedure";

/**
 * `user.*` read side (sige/03 §3.3, USR-01). Server list mode (R3.8) over `person` joined with
 * the better-auth `user` and `member` rows of the caller's institution. The tenant comes from
 * `context.org`; another tenant's person is `NOT_FOUND`. `previewUsername` and `checkEmail` are
 * tenant-blind (USR-R5): usernames and emails are globally unique, and they answer only whether
 * a value is taken, never by whom.
 */

const listInput = createListInput(userListConfig);

/** The `.xlsx` upload of `importPreview`/`importStart` (limits are enforced by `readImportUpload`). */
const importFileInput = z.object({ file: z.instanceof(File) });

/** `user.checkEmail`: 30 calls per minute per user (sige/03 §3.3). */
const CHECK_EMAIL_RULE = { limit: 30, windowMs: 60_000 } as const;

const notFound = () => new ORPCError("NOT_FOUND", { message: "El usuario no existe." });
const tooManyRequests = () =>
  new ORPCError("TOO_MANY_REQUESTS", {
    status: 429,
    message: "Demasiadas verificaciones. Intenta de nuevo en un momento.",
  });

/** Org callers never reach `owner`/`admin` members (USR-R4); the service enforces it. */
const actorOf = (context: {
  session: { user: { id: string }; session: { impersonatedBy?: string | null } };
}): UserActor => ({
  userId: context.session.user.id,
  impersonatorUserId: context.session.session.impersonatedBy ?? null,
  platform: false,
});

export const userRouter = {
  /** Server-list mode (R3.8): `{ rows, total }`; `total` ignores paging. */
  list: sigeProcedure
    .use(requirePermission({ user: ["read"] }))
    .input(listInput)
    .handler(({ context, input }) =>
      listUserRows(context.db, context.org.id, input, context.person.id),
    ),

  /** KPI tiles of USR-01. */
  stats: sigeProcedure.use(requirePermission({ user: ["read"] })).handler(async ({ context }) => {
    const [row] = await context.db
      .select({
        total: count(),
        teachers: sql<number>`count(*) filter (where ${hasRoleToken("teacher")})`.mapWith(Number),
        students: sql<number>`count(*) filter (where ${hasRoleToken("student")})`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${schema.person.isActive})`.mapWith(Number),
      })
      .from(schema.person)
      .innerJoin(schema.user, onLogin)
      .innerJoin(schema.member, onMember)
      .where(eq(schema.person.organizationId, context.org.id));
    return {
      total: row?.total ?? 0,
      teachers: row?.teachers ?? 0,
      students: row?.students ?? 0,
      active: row?.active ?? 0,
    };
  }),

  get: sigeProcedure
    .use(requirePermission({ user: ["read"] }))
    .input(userPersonInput)
    .handler(async ({ context, input }) => {
      const detail = await loadUserDetail(
        context.db,
        context.org.id,
        input.personId,
        context.person.id,
      );
      if (!detail) {
        throw notFound();
      }
      return detail;
    }),

  /**
   * Teacher and parent selects (INS-12, SCH-04/06; USR-R10). Any holder of `user:read`,
   * `course:update` or `offering:update`, so coordinators can pick teachers without listing
   * users. Active persons only.
   */
  options: sigeProcedure
    .use(requireAnyPermission({ user: ["read"] }, { course: ["update"] }, { offering: ["update"] }))
    .input(userOptionsInput)
    .handler(async ({ context, input }) => {
      const pattern = input.search ? `%${escapeLikePattern(input.search)}%` : undefined;
      const search: SQL | undefined = pattern
        ? or(
            ilike(schema.person.firstName, pattern),
            ilike(schema.person.lastName, pattern),
            ilike(sql`${schema.person.firstName} || ' ' || ${schema.person.lastName}`, pattern),
            ilike(schema.user.username, pattern),
            ilike(schema.person.documentNumber, pattern),
          )
        : undefined;
      const rows = await context.db
        .select({
          personId: schema.person.id,
          firstName: schema.person.firstName,
          lastName: schema.person.lastName,
          username: schema.user.username,
          document: schema.person.documentNumber,
        })
        .from(schema.person)
        .innerJoin(schema.user, onLogin)
        .innerJoin(schema.member, onMember)
        .where(
          and(
            eq(schema.person.organizationId, context.org.id),
            eq(schema.person.isActive, true),
            hasRoleToken(input.role),
            search,
          ),
        )
        .orderBy(asc(schema.person.lastName), asc(schema.person.firstName), asc(schema.person.id))
        .limit(input.limit);
      return rows.map((row) => ({
        personId: row.personId,
        name: `${row.firstName} ${row.lastName}`,
        username: row.username ?? "",
        document: row.document,
      }));
    }),

  /** Live preview of the form (USR-R2); `null` while any part is empty. Writes nothing. */
  previewUsername: sigeProcedure
    // STU-03 "new" shows the same preview to `student:create` holders (coordinators).
    .use(requireAnyPermission({ user: ["create"] }, { student: ["create"] }))
    .input(userPreviewUsernameInput)
    .handler(({ context, input }) => previewUsernameFor(context.db, context.org.id, input)),

  /** Live availability of an email (USR-R5): global, answers only "taken or not". */
  checkEmail: sigeProcedure
    .use(requirePermission({ user: ["create"] }))
    .input(userCheckEmailInput)
    .handler(async ({ context, input }) => {
      const limiter = context.rateLimiter ?? defaultRateLimiter;
      if (!limiter.consume(`user.checkEmail:${context.session.user.id}`, CHECK_EMAIL_RULE)) {
        throw tooManyRequests();
      }
      const [owner] = await context.db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, input.email))
        .limit(1);
      return { available: owner === undefined };
    }),

  create: sigeProcedure
    .use(requirePermission({ user: ["create"] }))
    .input(userCreateInput)
    .handler(({ context, input }) => createUser(context, context.org.id, input, actorOf(context))),

  update: sigeProcedure
    .use(requirePermission({ user: ["update"] }))
    .input(userUpdateInput)
    .handler(({ context, input }) => {
      const { personId, ...edit } = input;
      return updateUser(context, context.org.id, personId, edit, actorOf(context));
    }),

  setActive: sigeProcedure
    .use(requirePermission({ user: ["update"] }))
    .input(userSetActiveInput)
    .handler(({ context, input }) =>
      setUserActive(context, context.org.id, input.personId, input.active, actorOf(context)),
    ),

  delete: sigeProcedure
    .use(requirePermission({ user: ["delete"] }))
    .input(userPersonInput)
    .handler(({ context, input }) =>
      deleteUser(context, context.org.id, input.personId, actorOf(context)),
    ),

  resetPassword: sigeProcedure
    .use(requirePermission({ user: ["reset_password"] }))
    .input(userResetPasswordInput)
    .handler(({ context, input }) =>
      resetUserPassword(context, context.org.id, input, actorOf(context)),
    ),

  /** USR-04 dry run: per-row validation of the upload, no writes (USR-R11, R12). */
  importPreview: sigeProcedure
    .use(requirePermission({ user: ["import"] }))
    .input(importFileInput)
    .handler(async ({ context, input }) => {
      const { rows } = await readImportUpload(input.file);
      return previewUserImport(context.db, context.org.id, rows);
    }),

  /** `plantilla-usuarios.xlsx`: the USR-R11 header row plus an example row. */
  importTemplate: sigeProcedure.use(requirePermission({ user: ["import"] })).handler(
    async () =>
      new File([await buildImportTemplate()], IMPORT_TEMPLATE_FILENAME, {
        type: XLSX_CONTENT_TYPE,
      }),
  ),

  /**
   * Validates the upload, records the job and returns its id; the valid rows are provisioned in
   * the background (USR-R12, D7). A running job of the institution makes this `CONFLICT`.
   */
  importStart: sigeProcedure
    .use(requirePermission({ user: ["import"] }))
    .input(importFileInput)
    .handler(async ({ context, input }) => {
      const { rows } = await readImportUpload(input.file);
      const analysis = await analyzeUserImport(context.db, context.org.id, rows);
      if (analysis.valid.length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: NO_VALID_ROWS_MESSAGE });
      }
      return startUserImport(
        {
          db: context.db,
          auditLogger: context.auditLogger,
          runner: context.importRunner ?? defaultImportRunner,
        },
        context.org.id,
        {
          userId: context.session.user.id,
          personId: context.person.id,
          impersonatorUserId: context.session.session.impersonatedBy ?? null,
        },
        analysis,
      );
    }),
};

/**
 * `importJob.get` (sige/03 §3.3): progress polled by the import screens of any kind. The gate is
 * either import permission; the job is visible to its creator or to a holder of the import
 * permission of its kind, and is `NOT_FOUND` for every other caller or institution.
 */
export const importJobRouter = {
  get: sigeProcedure
    .use(requireAnyPermission({ user: ["import"] }, { student: ["import"] }))
    .input(z.object({ jobId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const job = await getImportJob(context.db, context.org.id, input.jobId);
      const permission: Record<string, string[]> =
        job?.kind === "students" ? { student: ["import"] } : { user: ["import"] };
      const visible =
        job !== null &&
        (job.createdBy === context.person.id ||
          (await context.authorization.hasOrgPermission(context.headers, permission)));
      if (!job || !visible) {
        throw new ORPCError("NOT_FOUND", { message: "La importación no existe." });
      }
      const { createdBy: _createdBy, ...status } = job;
      return status;
    }),
};

/**
 * Platform side of module 03 (sige/03 §3.4, INS-04/05): a superadmin manages one institution's
 * users through the same services and queries as `user.*`. The institution is the explicit
 * `institutionId` (an unknown one is `NOT_FOUND`); the actor is flagged `platform`, so `admin`
 * members are reachable while a second `owner` is still refused by the service. The audit actor is
 * the superadmin and `institutionId` is stored as the audit `organizationId`.
 */
const institutionInput = z.object({ institutionId: z.string().min(1, "Falta la institución.") });
const platformListInput = listInput.and(institutionInput);

const platformActorOf = (context: {
  session: { user: { id: string }; session: { impersonatedBy?: string | null } };
}): UserActor => ({ ...actorOf(context), platform: true });

async function requireInstitution(db: Database, institutionId: string) {
  const [row] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.id, institutionId))
    .limit(1);
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: INSTITUTION_NOT_FOUND });
  }
}

const manageUsers = () => platformProcedure({ institution: ["manage_users"] });

export const platformUserRouter = {
  list: manageUsers()
    .input(platformListInput)
    .handler(async ({ context, input }) => {
      const { institutionId, ...list } = input;
      await requireInstitution(context.db, institutionId);
      return listUserRows(context.db, institutionId, list as never, null);
    }),

  stats: manageUsers()
    .input(institutionInput)
    .handler(async ({ context, input }) => {
      await requireInstitution(context.db, input.institutionId);
      return institutionRoleCounts(context.db, input.institutionId);
    }),

  /** `role` may be `admin` as well as the tenant roles; the service refuses a second `owner`. */
  create: manageUsers()
    .input(institutionInput.extend(platformUserCreateInput.shape))
    .handler(async ({ context, input }) => {
      const { institutionId, ...user } = input;
      await requireInstitution(context.db, institutionId);
      return createUser(context, institutionId, user, platformActorOf(context));
    }),

  setActive: manageUsers()
    .input(institutionInput.extend(userSetActiveInput.shape))
    .handler(async ({ context, input }) => {
      await requireInstitution(context.db, input.institutionId);
      return setUserActive(
        context,
        input.institutionId,
        input.personId,
        input.active,
        platformActorOf(context),
      );
    }),

  /** Custom password only (the prototype dialog); the service re-arms the forced change. */
  resetPassword: manageUsers()
    .input(institutionInput.extend({ personId, newPassword: passwordSchema }))
    .handler(async ({ context, input }) => {
      await requireInstitution(context.db, input.institutionId);
      return resetUserPassword(
        context,
        input.institutionId,
        { personId: input.personId, mode: "custom", newPassword: input.newPassword },
        platformActorOf(context),
      );
    }),

  /** `institutionId` is optional: INS-02 previews the rector's username before the institution exists. */
  previewUsername: manageUsers()
    .input(userPreviewUsernameInput.extend({ institutionId: z.string().min(1).optional() }))
    .handler(async ({ context, input }) => {
      const { institutionId, ...parts } = input;
      if (institutionId !== undefined) {
        await requireInstitution(context.db, institutionId);
      }
      return previewUsernameFor(context.db, institutionId, parts);
    }),
};

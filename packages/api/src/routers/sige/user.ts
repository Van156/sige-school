import * as schema from "@base-template/db/schema";
import { generateUsername, UsernameGenerationError } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, ilike, like, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { requireAnyPermission, requirePermission } from "../../index";
import { createListInput } from "../../lib/list-input";
import { escapeLikePattern } from "@base-template/db/lib/list-values";
import { buildUserListQuery, hasRoleToken, userListConfig } from "../../lib/user-list-config";
import { defaultRateLimiter } from "../../rate-limit";
import { loadUserDetail, onLogin, onMember, rowColumns, toUserRow } from "../../sige/user-queries";
import {
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
import { sigeProcedure } from "../../sige/procedure";

/**
 * `user.*` read side (sige/03 §3.3, USR-01). Server list mode (R3.8) over `person` joined with
 * the better-auth `user` and `member` rows of the caller's institution. The tenant comes from
 * `context.org`; another tenant's person is `NOT_FOUND`. `previewUsername` and `checkEmail` are
 * tenant-blind (USR-R5): usernames and emails are globally unique, and they answer only whether
 * a value is taken, never by whom.
 */

const listInput = createListInput(userListConfig);

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
    .handler(async ({ context, input }) => {
      const query = buildUserListQuery(input);
      const scope = and(eq(schema.person.organizationId, context.org.id), query.where);
      const [rows, [totalRow]] = await Promise.all([
        context.db
          .select(rowColumns)
          .from(schema.person)
          .innerJoin(schema.user, onLogin)
          .innerJoin(schema.member, onMember)
          .where(scope)
          .orderBy(...query.orderBy)
          .limit(query.limit)
          .offset(query.offset),
        context.db
          .select({ total: count() })
          .from(schema.person)
          .innerJoin(schema.user, onLogin)
          .innerJoin(schema.member, onMember)
          .where(scope),
      ]);
      return {
        rows: rows.map((row) => toUserRow(row, row.personId === context.person.id)),
        total: totalRow?.total ?? 0,
      };
    }),

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
    .use(requirePermission({ user: ["create"] }))
    .input(userPreviewUsernameInput)
    .handler(async ({ context, input }) => {
      if (!input.firstName || !input.lastName || !input.documentNumber) {
        return { username: null, documentTaken: false };
      }
      // Usernames are unique across tenants, so the check is global but reveals nothing else.
      let base: string;
      try {
        base = generateUsername(input, new Set());
      } catch (error) {
        if (error instanceof UsernameGenerationError) {
          return { username: null, documentTaken: false };
        }
        throw error;
      }
      const [taken, [document]] = await Promise.all([
        context.db
          .select({ username: schema.user.username })
          .from(schema.user)
          .where(like(schema.user.username, `${escapeLikePattern(base)}%`)),
        context.db
          .select({ id: schema.person.id })
          .from(schema.person)
          .where(
            and(
              eq(schema.person.organizationId, context.org.id),
              eq(schema.person.documentNumber, input.documentNumber),
            ),
          )
          .limit(1),
      ]);
      const username = generateUsername(
        input,
        new Set(taken.flatMap((row) => (row.username ? [row.username] : []))),
      );
      return { username, documentTaken: document !== undefined };
    }),

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
};

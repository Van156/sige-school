import { createAuth } from "@base-template/auth";
import {
  cookieHeaderFromSetCookie,
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  truncateAllTables,
} from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { createBetterAuthAuthorization } from "../../authorization";
import type { Context } from "../../context";
import { createBetterAuthPlatformAdmin } from "../../platform-admin";
import { sigeProcedure } from "../../sige/procedure";
import { institutionAdminRouter } from "./institution-admin";
import { meRouter } from "./me";

/**
 * `institutionAdmin.create|list` (sige/02 INS-02 minimal, sige/00 §4.4) against a real Postgres:
 * root creates an institution plus its rector; the rector signs in with username + document.
 */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "institutionAdmin (INS-02)");

const rector: {
  firstName: string;
  lastName: string;
  documentType: "CC" | "TI" | "CE";
  documentNumber: string;
  email: string;
} = {
  firstName: "Marta",
  lastName: "Gómez",
  documentType: "CC",
  documentNumber: "52123456",
  email: "marta@colegio.example.com",
};

describe.skipIf(!reachable)("institutionAdmin (INS-02)", () => {
  let handle: TestDatabaseHandle;
  let auth: ReturnType<typeof createAuth>;
  let helpers: TestHelpers;
  let auditLogger: RecordingAuditLogger;

  beforeAll(async () => {
    handle = createTestDatabase(url);
    auditLogger = new RecordingAuditLogger();
    auth = createAuth(
      {
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
        CORS_ORIGIN: "http://localhost:3001",
        DEFAULT_MAX_ORGS_PER_USER: 3,
      },
      handle.db,
      new RecordingEmailSender(),
      auditLogger,
      { extraPlugins: [testUtils()] },
    );
    helpers = ((await auth.$context) as unknown as { test: TestHelpers }).test;
  });

  afterAll(async () => {
    await truncateAllTables(handle.db);
    await handle.close();
  });

  beforeEach(async () => {
    auditLogger.reset();
    await truncateAllTables(handle.db);
  });

  async function contextFor(
    headers: Headers,
    logger: Context["auditLogger"] = auditLogger,
  ): Promise<Context> {
    return {
      db: handle.db,
      session: await auth.api.getSession({ headers }),
      headers,
      authorization: createBetterAuthAuthorization(auth),
      platformAdmin: createBetterAuthPlatformAdmin(auth),
      auditLogger: logger,
      defaultMaxOrganizationsPerUser: 3,
    };
  }

  async function rootContext(logger?: Context["auditLogger"]) {
    const root = helpers.createUser({ role: "superadmin" });
    await helpers.saveUser(root);
    const { headers } = await helpers.login({ userId: root.id });
    return { root, context: await contextFor(headers, logger) };
  }

  const create = (context: Context, name = "Colegio Sol", admin = rector) =>
    call(institutionAdminRouter.create, { institution: { name }, admin }, { context });

  const codeOf = (promise: Promise<unknown>) =>
    promise.then(
      () => undefined,
      (error: unknown) => (error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR"),
    );

  async function residue() {
    const [orgs, users, people, members] = await Promise.all([
      handle.db.select().from(schema.organization),
      handle.db.select().from(schema.user),
      handle.db.select().from(schema.person),
      handle.db.select().from(schema.member),
    ]);
    return {
      orgs: orgs.length,
      users: users.length,
      people: people.length,
      members: members.length,
    };
  }

  test("root creates an institution and its rector (owner, forced change armed)", async () => {
    const { root, context } = await rootContext();
    const baseline = await residue();

    const result = await create(context);

    expect(result.institution.name).toBe("Colegio Sol");
    expect(result.institution.slug).toBe("colegio-sol");
    expect(result.rector.username).toBe("mgomez3456");

    const [person] = await handle.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.id, result.rector.personId));
    expect(person?.organizationId).toBe(result.institution.id);
    expect(person?.mustChangePassword).toBe(true);
    const [member] = await handle.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, result.rector.userId));
    expect(member).toMatchObject({ organizationId: result.institution.id, role: "owner" });
    const [rectorUser] = await handle.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, result.rector.userId));
    expect(rectorUser?.maxOrganizations).toBe(1);

    const after = await residue();
    expect(after.orgs).toBe(baseline.orgs + 1);

    const created = auditLogger.eventsFor("organization.created");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      actorUserId: root.id,
      organizationId: result.institution.id,
      targetId: result.institution.id,
    });
    expect(auditLogger.eventsFor("user.created")).toHaveLength(1);
    expect(auditLogger.eventsFor("user.created")[0]?.actorUserId).toBe(root.id);
  });

  test("the rector signs in with username + document number and hits PASSWORD_CHANGE_REQUIRED", async () => {
    const { context } = await rootContext();
    const result = await create(context);

    const response = await auth.api.signInUsername({
      body: { username: result.rector.username, password: rector.documentNumber },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const headers = cookieHeaderFromSetCookie(response.headers.get("set-cookie"));
    // The session has no active organization yet: set it as the web does after sign-in.
    await auth.api.setActiveOrganization({
      body: { organizationId: result.institution.id },
      headers,
    });
    const activeContext = await contextFor(headers);

    const me = await call(meRouter.get, undefined, { context: activeContext });
    expect(me.kind).toBe("owner");
    expect(me.person.mustChangePassword).toBe(true);

    const gated = sigeProcedure.handler(() => "reached");
    expect(await codeOf(call(gated, undefined, { context: activeContext }))).toBe(
      "PASSWORD_CHANGE_REQUIRED",
    );

    const changed = await auth.api.changePassword({
      body: { currentPassword: rector.documentNumber, newPassword: "nueva-clave-2026" },
      headers,
      asResponse: true,
    });
    // The change issues a fresh session (other sessions are revoked).
    const refreshed = cookieHeaderFromSetCookie(changed.headers.get("set-cookie"));
    await auth.api.setActiveOrganization({
      body: { organizationId: result.institution.id },
      headers: refreshed,
    });
    expect(await call(gated, undefined, { context: await contextFor(refreshed) })).toBe("reached");
  });

  test("slug collisions get a numeric suffix", async () => {
    const { context } = await rootContext();
    const first = await create(context);
    const second = await create(context, "Colegio Sol", {
      ...rector,
      documentNumber: "52999999",
      email: "otra@colegio.example.com",
    });
    expect(first.institution.slug).toBe("colegio-sol");
    expect(second.institution.slug).toBe("colegio-sol-2");
  });

  test("non-root callers are FORBIDDEN, including an institution owner", async () => {
    const { context: rootCtx } = await rootContext();
    const result = await create(rootCtx);
    await handle.db
      .update(schema.person)
      .set({ mustChangePassword: false })
      .where(eq(schema.person.id, result.rector.personId));
    const { headers } = await helpers.login({
      userId: result.rector.userId,
      session: { activeOrganizationId: result.institution.id },
    });
    const ownerContext = await contextFor(headers);
    expect(
      await codeOf(
        create(ownerContext, "Otro", {
          ...rector,
          documentNumber: "11111111",
          email: "x@y.example.com",
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await codeOf(call(institutionAdminRouter.list, undefined, { context: ownerContext })),
    ).toBe("FORBIDDEN");
  });

  test("unauthenticated callers are UNAUTHORIZED", async () => {
    const context = await contextFor(new Headers());
    expect(await codeOf(create(context))).toBe("UNAUTHORIZED");
  });

  test("a taken rector email leaves no partial institution", async () => {
    const { context } = await rootContext();
    await create(context);
    const before = await residue();
    const code = await codeOf(
      create(context, "Colegio Luna", { ...rector, documentNumber: "52777777" }),
    );
    expect(code).toBe("CONFLICT");
    expect(await residue()).toEqual(before);
  });

  test("a failing organization audit write compensates org, rector and membership", async () => {
    const failing: Context["auditLogger"] = {
      record: (event) =>
        event.action === "organization.created"
          ? Promise.reject(new Error("audit down"))
          : auditLogger.record(event),
    };
    const { context } = await rootContext(failing);
    const before = await residue();
    expect(await codeOf(create(context))).toBe("NOT_AN_ORPC_ERROR");
    expect(await residue()).toEqual(before);
  });

  test("invalid rector input is BAD_REQUEST and writes nothing", async () => {
    const { context } = await rootContext();
    const before = await residue();
    expect(
      await codeOf(
        create(context, "Colegio Luna", { ...rector, documentType: "TI", email: "no-email" }),
      ),
    ).toBe("BAD_REQUEST");
    expect(await codeOf(create(context, "  ", rector))).toBe("BAD_REQUEST");
    expect(await residue()).toEqual(before);
  });

  test("list returns created institutions with their rector, newest first", async () => {
    const { context } = await rootContext();
    await create(context, "Colegio Uno");
    await create(context, "Colegio Dos", {
      ...rector,
      documentNumber: "52888888",
      email: "dos@colegio.example.com",
    });
    const rows = await call(institutionAdminRouter.list, undefined, { context });
    expect(rows.map((row) => row.name)).toEqual(["Colegio Dos", "Colegio Uno"]);
    expect(rows[0]?.rector).toMatchObject({ name: "Marta Gómez" });
    expect(rows[0]?.rector?.username).toBeTruthy();
  });
});

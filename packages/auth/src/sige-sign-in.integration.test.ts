import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";

import { createAuth } from "./index";
import { provisionUser } from "./provision-user";
import {
  cookieHeaderFromSetCookie,
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  truncateAllTables,
} from "./testing";

/**
 * SIGE sign-in and forced-password hooks (sige/01 AUTH-R7..R9) against a real Postgres: inactive
 * block, `last_login_at`, `/change-password` clearing `must_change_password`, reset completion.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "SIGE sign-in hooks");

const INACTIVE_MESSAGE = "Su cuenta está desactivada. Contacte al administrador.";
const SAME_PASSWORD_MESSAGE = "La nueva contraseña debe ser diferente a la actual.";

describe.skipIf(!reachable)("SIGE sign-in hooks", () => {
  let handle: TestDatabaseHandle;
  let auditLogger: RecordingAuditLogger;
  let emailSender: RecordingEmailSender;
  let auth: ReturnType<typeof createAuth>;
  const orgId = "org-sol";

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    auditLogger = new RecordingAuditLogger();
    emailSender = new RecordingEmailSender();
    auth = createAuth(
      {
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
        CORS_ORIGIN: "http://localhost:3001",
        DEFAULT_MAX_ORGS_PER_USER: 3,
      },
      handle.db,
      emailSender,
      auditLogger,
    );
  });

  afterAll(async () => {
    // Leave no `person` rows behind: they restrict user deletion in other suites.
    await truncateAllTables(handle.db);
    await handle.close();
  });

  beforeEach(async () => {
    auditLogger.reset();
    emailSender.reset();
    await truncateAllTables(handle.db);
    await handle.db
      .insert(schema.organization)
      .values({ id: orgId, name: "Colegio Sol", slug: "colegio-sol" });
  });

  const provision = (overrides: { email?: string; documentNumber?: string } = {}) =>
    provisionUser(
      { database: handle.db, auth, auditLogger },
      {
        organizationId: orgId,
        role: "teacher",
        firstName: "Juan",
        lastName: "López",
        documentType: "CC",
        documentNumber: overrides.documentNumber ?? "1234560001",
        email: overrides.email,
        actor: "system",
      },
    );

  const personOf = async (userId: string) =>
    (await handle.db.select().from(schema.person).where(eq(schema.person.userId, userId)))[0]!;

  async function signInByUsername(username: string, password: string) {
    const response = await auth.api.signInUsername({
      body: { username, password },
      asResponse: true,
    });
    return {
      response,
      headers: cookieHeaderFromSetCookie(response.headers.get("set-cookie")),
    };
  }

  async function failureOf(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      const api = error as { body?: { code?: string; message?: string }; status?: string };
      return { code: api.body?.code, message: api.body?.message ?? (error as Error).message };
    }
    return null;
  }

  /** Makes every UPDATE that sets `column` of `person` fail, for the duration of `body`. */
  async function withFailingPersonUpdate(column: string, body: () => Promise<void>) {
    await handle.db.execute(
      sql.raw(
        `CREATE OR REPLACE FUNCTION test_fail_person_update() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'blocked by test'; END; $$ LANGUAGE plpgsql`,
      ),
    );
    await handle.db.execute(
      sql.raw(
        `CREATE TRIGGER test_fail_person BEFORE UPDATE OF ${column} ON person FOR EACH ROW EXECUTE FUNCTION test_fail_person_update()`,
      ),
    );
    try {
      await body();
    } finally {
      await handle.db.execute(sql.raw(`DROP TRIGGER IF EXISTS test_fail_person ON person`));
    }
  }

  describe("last_login_at (AUTH-R8)", () => {
    test("is written on username sign-in", async () => {
      const provisioned = await provision();
      expect((await personOf(provisioned.userId)).lastLoginAt).toBeNull();
      await signInByUsername(provisioned.username, "1234560001");
      expect((await personOf(provisioned.userId)).lastLoginAt).toBeInstanceOf(Date);
    });

    test("is written on email sign-in", async () => {
      const provisioned = await provision({ email: "juan@example.com" });
      await auth.api.signInEmail({ body: { email: "juan@example.com", password: "1234560001" } });
      expect((await personOf(provisioned.userId)).lastLoginAt).toBeInstanceOf(Date);
    });

    test("a failed write is best-effort: the sign-in still succeeds", async () => {
      const provisioned = await provision();
      await withFailingPersonUpdate("last_login_at", async () => {
        const { response } = await signInByUsername(provisioned.username, "1234560001");
        expect(response.status).toBe(200);
      });
      expect((await personOf(provisioned.userId)).lastLoginAt).toBeNull();
    });

    test("a failed sign-in leaves it untouched", async () => {
      const provisioned = await provision();
      expect(
        await failureOf(
          auth.api.signInUsername({
            body: { username: provisioned.username, password: "wrong-password" },
          }),
        ),
      ).not.toBeNull();
      expect((await personOf(provisioned.userId)).lastLoginAt).toBeNull();
    });
  });

  describe("inactive person (AUTH-R7)", () => {
    test("cannot sign in by username and no session is created", async () => {
      const provisioned = await provision();
      await handle.db
        .update(schema.person)
        .set({ isActive: false })
        .where(eq(schema.person.userId, provisioned.userId));
      const failure = await failureOf(
        auth.api.signInUsername({
          body: { username: provisioned.username, password: "1234560001" },
        }),
      );
      expect(failure?.message).toBe(INACTIVE_MESSAGE);
      expect(failure?.code).toBe("ACCOUNT_DISABLED");
      expect(await handle.db.select().from(schema.session)).toHaveLength(0);
    });

    test("cannot sign in by email", async () => {
      const provisioned = await provision({ email: "juan@example.com" });
      await handle.db
        .update(schema.person)
        .set({ isActive: false })
        .where(eq(schema.person.userId, provisioned.userId));
      const failure = await failureOf(
        auth.api.signInEmail({ body: { email: "Juan@Example.com", password: "1234560001" } }),
      );
      expect(failure?.message).toBe(INACTIVE_MESSAGE);
    });

    test("no route can issue a session for an inactive person (session choke point)", async () => {
      const provisioned = await provision();
      await handle.db
        .update(schema.person)
        .set({ isActive: false })
        .where(eq(schema.person.userId, provisioned.userId));
      const context = await auth.$context;
      const failure = await failureOf(context.internalAdapter.createSession(provisioned.userId));
      expect(failure?.code).toBe("ACCOUNT_DISABLED");
      expect(await handle.db.select().from(schema.session)).toHaveLength(0);
    });

    test("an active person gets a session from the same choke point", async () => {
      const provisioned = await provision();
      const context = await auth.$context;
      const session = await context.internalAdapter.createSession(provisioned.userId);
      expect(session.userId).toBe(provisioned.userId);
    });

    test("an active person and a user without a person still sign in", async () => {
      const provisioned = await provision();
      await signInByUsername(provisioned.username, "1234560001");
      const created = await auth.api.signUpEmail({
        body: { email: "admin@example.com", password: "correct horse battery", name: "Admin" },
      });
      expect(created.user.id).toBeTruthy();
    });
  });

  describe("forced change (AUTH-R9)", () => {
    test("/change-password clears must_change_password and audits it as forced", async () => {
      const provisioned = await provision();
      expect((await personOf(provisioned.userId)).mustChangePassword).toBe(true);
      const { headers } = await signInByUsername(provisioned.username, "1234560001");

      await auth.api.changePassword({
        body: { currentPassword: "1234560001", newPassword: "nueva-clave-2026" },
        headers,
      });

      expect((await personOf(provisioned.userId)).mustChangePassword).toBe(false);
      const events = auditLogger.eventsFor("user.password_changed");
      expect(events).toHaveLength(1);
      expect(events[0]?.metadata).toMatchObject({ forced: true });
      await signInByUsername(provisioned.username, "nueva-clave-2026");
    });

    test("a failed flag clear still sends the notice and audit, then tells the user", async () => {
      const provisioned = await provision({ email: "juan@example.com" });
      const { headers } = await signInByUsername(provisioned.username, "1234560001");
      emailSender.reset();
      auditLogger.reset();

      await withFailingPersonUpdate("must_change_password", async () => {
        const failure = await failureOf(
          auth.api.changePassword({
            body: { currentPassword: "1234560001", newPassword: "nueva-clave-2026" },
            headers,
          }),
        );
        expect(failure?.code).toBe("PASSWORD_CHANGED_GATE_NOT_CLEARED");
      });

      // The password did change, so the notice and the audit row must exist.
      expect(emailSender.passwordChangedNotices).toHaveLength(1);
      expect(auditLogger.eventsFor("user.password_changed")).toHaveLength(1);
      expect((await personOf(provisioned.userId)).mustChangePassword).toBe(true);

      // Not stuck: the new password is now the current one, so a retry with another one clears it.
      const retry = await signInByUsername(provisioned.username, "nueva-clave-2026");
      await auth.api.changePassword({
        body: { currentPassword: "nueva-clave-2026", newPassword: "tercera-clave-2026" },
        headers: retry.headers,
      });
      expect((await personOf(provisioned.userId)).mustChangePassword).toBe(false);
    });

    test("a voluntary change is not audited as forced", async () => {
      const provisioned = await provision();
      await handle.db
        .update(schema.person)
        .set({ mustChangePassword: false })
        .where(eq(schema.person.userId, provisioned.userId));
      const { headers } = await signInByUsername(provisioned.username, "1234560001");
      await auth.api.changePassword({
        body: { currentPassword: "1234560001", newPassword: "nueva-clave-2026" },
        headers,
      });
      expect(auditLogger.eventsFor("user.password_changed")[0]?.metadata).not.toHaveProperty(
        "forced",
      );
    });

    test("the new password must differ from the current one and the flag stays armed", async () => {
      const provisioned = await provision();
      const { headers } = await signInByUsername(provisioned.username, "1234560001");
      const failure = await failureOf(
        auth.api.changePassword({
          body: { currentPassword: "1234560001", newPassword: "1234560001" },
          headers,
        }),
      );
      expect(failure?.message).toBe(SAME_PASSWORD_MESSAGE);
      expect((await personOf(provisioned.userId)).mustChangePassword).toBe(true);
    });

    test("a wrong current password leaves the flag armed", async () => {
      const provisioned = await provision();
      const { headers } = await signInByUsername(provisioned.username, "1234560001");
      expect(
        await failureOf(
          auth.api.changePassword({
            body: { currentPassword: "not-the-password", newPassword: "nueva-clave-2026" },
            headers,
          }),
        ),
      ).not.toBeNull();
      expect((await personOf(provisioned.userId)).mustChangePassword).toBe(true);
    });

    test("reset-password completion (email flow) clears the flag", async () => {
      const provisioned = await provision({ email: "juan@example.com" });
      await auth.api.requestPasswordReset({
        body: { email: "juan@example.com", redirectTo: "http://localhost:3001/reset-password" },
      });
      const token = emailSender.lastResetPasswordTokenFor("juan@example.com");
      await auth.api.resetPassword({ body: { token, newPassword: "otra-clave-2026" } });
      expect((await personOf(provisioned.userId)).mustChangePassword).toBe(false);
    });
  });
});

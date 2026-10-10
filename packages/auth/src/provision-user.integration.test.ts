import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createAuth } from "./index";
import { provisionUser, provisionUserInTransaction, ProvisionUserError } from "./provision-user";
import type { ProvisionInput } from "./provision-user";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  truncateAllTables,
} from "./testing";

/**
 * `provisionUser` against a real Postgres (sige/00 R1.18-R1.21, sige/03 §3.1). Skips cleanly when
 * no test database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "provisionUser integration");

describe.skipIf(!reachable)("provisionUser integration", () => {
  let handle: TestDatabaseHandle;
  let auditLogger: RecordingAuditLogger;
  let auth: ReturnType<typeof createAuth>;
  const orgId = "org-sol";

  const deps = () => ({ database: handle.db, auth, auditLogger });
  const input = (overrides: Partial<ProvisionInput> = {}): ProvisionInput => ({
    organizationId: orgId,
    role: "teacher",
    firstName: "Juan",
    lastName: "López",
    documentType: "CC",
    documentNumber: "1234560001",
    actor: "system",
    ...overrides,
  });

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
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
    );
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    auditLogger.reset();
    await truncateAllTables(handle.db);
    await handle.db
      .insert(schema.organization)
      .values({ id: orgId, name: "Colegio Sol", slug: "colegio-sol" });
  });

  async function counts() {
    const [users, accounts, members, people] = await Promise.all([
      handle.db.select().from(schema.user),
      handle.db.select().from(schema.account),
      handle.db.select().from(schema.member),
      handle.db.select().from(schema.person),
    ]);
    return [users.length, accounts.length, members.length, people.length];
  }

  test("creates user, credential account, member and person with the SIGE defaults", async () => {
    const result = await provisionUser(deps(), input());

    expect(result.username).toBe("jlopez0001");
    expect(result.hasRealEmail).toBe(false);
    const [user] = await handle.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, result.userId));
    expect(user).toMatchObject({
      name: "Juan López",
      username: "jlopez0001",
      email: "jlopez0001@sin-correo.colegio-sol.invalid",
      emailVerified: true,
    });
    const [member] = await handle.db.select().from(schema.member);
    expect(member).toMatchObject({
      organizationId: orgId,
      userId: result.userId,
      role: "teacher",
    });
    const [person] = await handle.db.select().from(schema.person);
    expect(person).toMatchObject({
      id: result.personId,
      organizationId: orgId,
      documentNumber: "1234560001",
      hasRealEmail: false,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: null,
    });
    const [account] = await handle.db.select().from(schema.account);
    expect(account).toMatchObject({
      providerId: "credential",
      userId: result.userId,
    });
    expect(account?.password).not.toBe("1234560001");
  });

  test("a real email is stored lowercase and flagged", async () => {
    const result = await provisionUser(deps(), input({ email: "Juan@Example.com" }));

    expect(result.hasRealEmail).toBe(true);
    const [user] = await handle.db.select().from(schema.user);
    expect(user?.email).toBe("juan@example.com");
  });

  test("signs in by username with the document number as password", async () => {
    const result = await provisionUser(deps(), input({ documentNumber: "12345" }));

    const signIn = await auth.api.signInUsername({
      body: { username: result.username, password: "12345" },
    });

    expect(signIn.user.id).toBe(result.userId);
    const [person] = await handle.db.select().from(schema.person);
    expect(person?.mustChangePassword).toBe(true);
  });

  test("rejects a wrong password at username sign-in", async () => {
    const result = await provisionUser(deps(), input());

    await expect(
      auth.api.signInUsername({
        body: { username: result.username, password: "nope-nope" },
      }),
    ).rejects.toThrow();
  });

  test("mustChangePassword can be overridden (seed)", async () => {
    await provisionUser(deps(), input({ mustChangePassword: false }));

    const [person] = await handle.db.select().from(schema.person);
    expect(person?.mustChangePassword).toBe(false);
  });

  test("collisions get a counter suffix, across tenants too", async () => {
    await handle.db
      .insert(schema.organization)
      .values({ id: "org-luna", name: "Colegio Luna", slug: "colegio-luna" });

    const first = await provisionUser(deps(), input());
    const second = await provisionUser(deps(), input({ documentNumber: "9999990001" }));
    const third = await provisionUser(
      deps(),
      input({ organizationId: "org-luna", documentNumber: "7777770001" }),
    );

    expect([first.username, second.username, third.username]).toEqual([
      "jlopez0001",
      "jlopez0001_2",
      "jlopez0001_3",
    ]);
  });

  test("the same document may exist in another institution but not twice in one", async () => {
    await handle.db
      .insert(schema.organization)
      .values({ id: "org-luna", name: "Colegio Luna", slug: "colegio-luna" });
    await provisionUser(deps(), input());

    await expect(provisionUser(deps(), input({ firstName: "Pedro" }))).rejects.toMatchObject({
      code: "DOCUMENT_TAKEN",
      message: "Ya existe un usuario con este documento.",
    });
    await expect(
      provisionUser(deps(), input({ organizationId: "org-luna" })),
    ).resolves.toBeDefined();
  });

  test("a duplicate email is rejected globally with no residue", async () => {
    await provisionUser(deps(), input({ email: "a@example.com" }));
    const before = await counts();

    await expect(
      provisionUser(deps(), input({ documentNumber: "5555555555", email: "A@example.com" })),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    expect(await counts()).toEqual(before);
  });

  test("validation errors write nothing", async () => {
    const cases: [Partial<ProvisionInput>, string][] = [
      [{ firstName: "  " }, "Los nombres son obligatorios."],
      [{ lastName: "" }, "Los apellidos son obligatorios."],
      [{ documentNumber: "1234" }, "El documento debe tener al menos 5 caracteres."],
      [{ email: "not-an-email" }, "Ingresa un correo válido."],
      [{ birthDate: "2999-01-01" }, "La fecha de nacimiento no puede ser futura."],
      [{ birthDate: "2020-02-31" }, "Fecha de nacimiento inválida."],
      [{ lastName: "---" }, "No se pudo generar el nombre de usuario."],
    ];
    for (const [overrides, message] of cases) {
      await expect(provisionUser(deps(), input(overrides))).rejects.toMatchObject({
        code: "VALIDATION",
        message,
      });
    }
    expect(await counts()).toEqual([0, 0, 0, 0]);
  });

  test("an unknown organization is rejected", async () => {
    await expect(
      provisionUser(deps(), input({ organizationId: "missing" })),
    ).rejects.toBeInstanceOf(ProvisionUserError);
  });

  test("audit failure compensates: no user, account, member or person remains", async () => {
    const failing = {
      record: () => Promise.reject(new Error("audit down")),
    };

    await expect(provisionUser({ ...deps(), auditLogger: failing }, input())).rejects.toThrow(
      "audit down",
    );
    expect(await counts()).toEqual([0, 0, 0, 0]);
  });

  test("a placeholder email already taken counts as a username collision", async () => {
    // Models losing a race: another request already committed the placeholder email of the
    // username we computed (the email derives from the username), before our username lookup.
    await handle.db.insert(schema.user).values({
      id: "squatter",
      name: "Squatter",
      email: "jlopez0001@sin-correo.colegio-sol.invalid",
      username: "someoneelse",
    });

    const result = await provisionUser(deps(), input());

    expect(result.username).toBe("jlopez0001_2");
    expect(await counts()).toEqual([2, 1, 1, 1]);
  });

  for (const step of ["user", "account", "member", "person"] as const) {
    test(`a failure after the ${step} insert rolls everything back`, async () => {
      const failure = await provisionUser(
        {
          ...deps(),
          faultInjection: {
            afterInsert: (inserted) => {
              if (inserted === step) throw new Error(`injected after ${step}`);
            },
          },
        },
        input(),
      ).catch((error: unknown) => error);

      expect((failure as Error).message).toBe(`injected after ${step}`);
      expect(await counts()).toEqual([0, 0, 0, 0]);
      expect(auditLogger.eventsFor("user.created")).toHaveLength(0);
    });
  }

  test("a failed compensation is logged, the original error surfaces and the state is not hidden", async () => {
    const database = handle.db;
    let transactions = 0;
    const flaky = new Proxy(database, {
      get(target, property, receiver) {
        if (property === "transaction") {
          return (...args: Parameters<typeof database.transaction>) => {
            transactions += 1;
            if (transactions > 1) return Promise.reject(new Error("db down"));
            return target.transaction(...args);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      const failure = await provisionUser(
        {
          database: flaky,
          auth,
          auditLogger: { record: () => Promise.reject(new Error("audit down")) },
        },
        input(),
      ).catch((error: unknown) => error);

      expect((failure as Error).message).toBe("audit down");
    } finally {
      console.error = original;
    }

    expect(logged).toHaveLength(1);
    expect(String(logged[0]?.[0])).toContain("compensation failed");
    // The rows could not be deleted: the failure is loud (logged + thrown), never a success.
    expect(await counts()).toEqual([1, 1, 1, 1]);
  });

  test("concurrent provisioning of one document yields exactly one user", async () => {
    const results = await Promise.allSettled([
      provisionUser(deps(), input()),
      provisionUser(deps(), input()),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await counts()).toEqual([1, 1, 1, 1]);
  });

  test("concurrent provisioning of colliding usernames both succeed with distinct usernames", async () => {
    const results = await Promise.all([
      provisionUser(deps(), input()),
      provisionUser(deps(), input({ documentNumber: "9999990001" })),
    ]);

    expect(new Set(results.map((result) => result.username)).size).toBe(2);
    expect(await counts()).toEqual([2, 2, 2, 2]);
  });

  test("records user.created without secrets, attributing a system actor to the new user", async () => {
    const result = await provisionUser(deps(), input());

    const [event] = auditLogger.eventsFor("user.created");
    expect(event).toMatchObject({
      scope: "organization",
      organizationId: orgId,
      actorUserId: result.userId,
      targetType: "user",
      targetId: result.userId,
      metadata: {
        role: "teacher",
        personId: result.personId,
        hasRealEmail: false,
      },
    });
    expect(JSON.stringify(event)).not.toContain("1234560001");
  });

  test("in a caller transaction: rows commit with the caller and the audit event is returned, not recorded", async () => {
    const result = await handle.db.transaction(async (tx) => {
      const provisioned = await provisionUserInTransaction(deps(), tx, input());
      // Visible inside the caller's transaction only.
      const inside = await tx
        .select()
        .from(schema.person)
        .where(eq(schema.person.id, provisioned.personId));
      expect(inside).toHaveLength(1);
      return provisioned;
    });

    expect(await counts()).toEqual([1, 1, 1, 1]);
    expect(auditLogger.eventsFor("user.created")).toHaveLength(0);
    expect(result.auditEvent).toMatchObject({
      scope: "organization",
      organizationId: orgId,
      action: "user.created",
      targetType: "user",
      targetId: result.userId,
      metadata: { role: "teacher", personId: result.personId, hasRealEmail: false },
    });
  });

  test("in a caller transaction: a caller failure after provisioning leaves no login or person", async () => {
    const failure = await handle.db
      .transaction(async (tx) => {
        await provisionUserInTransaction(deps(), tx, input());
        throw new Error("caller failed after the login");
      })
      .catch((error: unknown) => error);

    expect((failure as Error).message).toBe("caller failed after the login");
    expect(await counts()).toEqual([0, 0, 0, 0]);
    expect(auditLogger.events).toHaveLength(0);
  });

  test("in a caller transaction: a username collision retries on a savepoint and keeps the caller's work", async () => {
    await handle.db.insert(schema.user).values({
      id: "squatter",
      name: "Squatter",
      email: "jlopez0001@sin-correo.colegio-sol.invalid",
      username: "someoneelse",
    });
    const result = await handle.db.transaction(async (tx) => {
      await tx.insert(schema.user).values({ id: "caller-row", name: "C", email: "c@x.com" });
      return provisionUserInTransaction(deps(), tx, input());
    });

    expect(result.username).toBe("jlopez0001_2");
    expect(
      await handle.db.select().from(schema.user).where(eq(schema.user.id, "caller-row")),
    ).toHaveLength(1);
    expect(await counts()).toEqual([3, 1, 1, 1]);
  });

  test("in a caller transaction: a taken document is a typed error", async () => {
    await provisionUser(deps(), input());
    const failure = await handle.db
      .transaction((tx) => provisionUserInTransaction(deps(), tx, input()))
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ProvisionUserError);
    expect((failure as ProvisionUserError).code).toBe("DOCUMENT_TAKEN");
  });

  test("records the acting user and impersonator", async () => {
    await handle.db.insert(schema.user).values({ id: "actor", name: "A", email: "a@x.com" });
    await provisionUser(deps(), input({ actor: { userId: "actor", impersonatorUserId: "root" } }));

    expect(auditLogger.eventsFor("user.created")[0]).toMatchObject({
      actorUserId: "actor",
      impersonatorUserId: "root",
    });
  });
});

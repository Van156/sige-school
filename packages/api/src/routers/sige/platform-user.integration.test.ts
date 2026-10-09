import type { RecordingAuditLogger } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { call, ORPCError } from "@orpc/server";
import { verifyPassword } from "better-auth/crypto";
import type { TestHelpers } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import { SIGE_TEST_ROLES, sigeSuite } from "../../sige/testing";
import type { TestTenant } from "../../sige/testing";
import { platformUserRouter } from "./user";

/** `platformUser.*` (sige/03 §3.4, INS-04/05 API): a superadmin manages one institution's users. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

await sigeSuite("platformUser router", (fx) => {
  let tenant: TestTenant;
  let other: TestTenant;
  let root: Context;
  let rootUserId: string;
  const callers: Record<string, Context> = {};

  const run = (procedure: keyof typeof platformUserRouter, input: unknown, context = root) =>
    call(platformUserRouter[procedure] as never, input as never, { context }) as Promise<any>;
  const inst = () => tenant.orgId;
  const personRow = async (personId: string) =>
    (await fx.db.select().from(schema.person).where(eq(schema.person.id, personId)))[0]!;
  const auditOf = (action: string, targetId: string) =>
    (root.auditLogger as RecordingAuditLogger).events.find(
      (event) => event.action === action && event.targetId === targetId,
    );

  const newUser = (suffix: string, role: string) => ({
    institutionId: inst(),
    firstName: "Nuevo",
    lastName: `Usuario${suffix}`,
    documentType: "CC",
    documentNumber: `9${suffix}${Date.now() % 100000}`.padEnd(8, "0"),
    role,
  });

  test("provisions two institutions, org callers and a superadmin", async () => {
    tenant = await fx.provisionTenant("Plataforma", SIGE_TEST_ROLES);
    other = await fx.provisionTenant("Otra", ["owner"]);
    for (const role of SIGE_TEST_ROLES) {
      callers[role] = await fx.contextFor(tenant.people[role]!, tenant);
    }
    const helpers = ((await fx.auth.$context) as unknown as { test: TestHelpers }).test;
    const superadmin = helpers.createUser({ role: "superadmin" });
    await helpers.saveUser(superadmin);
    rootUserId = superadmin.id;
    const { headers } = await helpers.login({ userId: superadmin.id });
    root = {
      ...(await fx.contextFor(tenant.people.owner!, tenant)),
      session: await fx.auth.api.getSession({ headers }),
      headers,
    };
  });

  // Own tenant: list/stats assertions must not depend on users the create tests add to `tenant`.
  test("list returns the institution's users only, with total", async () => {
    const own = await fx.provisionTenant("Plataforma listado", SIGE_TEST_ROLES);
    const result = await run("list", { institutionId: own.orgId });
    expect(result.total).toBe(SIGE_TEST_ROLES.length);
    expect(result.rows.map((row: any) => row.personId).sort()).toEqual(
      Object.values(own.people)
        .map((person) => person.personId)
        .sort(),
    );
    expect(result.rows.every((row: any) => row.isSelf === false)).toBe(true);
    const foreign = await run("list", { institutionId: other.orgId });
    expect(foreign.total).toBe(1);
  });

  test("list honours the shared filters (role token)", async () => {
    const own = await fx.provisionTenant("Plataforma filtro", SIGE_TEST_ROLES);
    const result = await run("list", {
      institutionId: own.orgId,
      filters: [{ id: "role", variant: "select", operator: "eq", value: "teacher" }],
    });
    expect(result.rows.map((row: any) => row.personId)).toEqual([own.people.teacher!.personId]);
  });

  test("stats counts admins (owner + admin), coordinators, teachers and students", async () => {
    const own = await fx.provisionTenant("Plataforma KPI", SIGE_TEST_ROLES);
    expect(await run("stats", { institutionId: own.orgId })).toEqual({
      admins: 2,
      coordinators: 1,
      teachers: 1,
      students: 1,
    });
  });

  test("an unknown institution is NOT_FOUND on every procedure", async () => {
    const missing = "org-missing";
    const inputs: [keyof typeof platformUserRouter, unknown][] = [
      ["list", { institutionId: missing }],
      ["stats", { institutionId: missing }],
      ["create", { ...newUser("1", "teacher"), institutionId: missing }],
      ["setActive", { institutionId: missing, personId: "x", active: false }],
      ["resetPassword", { institutionId: missing, personId: "x", newPassword: "Clave-12345" }],
      [
        "previewUsername",
        { institutionId: missing, firstName: "Ana", lastName: "Gil", documentNumber: "12345678" },
      ],
    ];
    for (const [procedure, input] of inputs) {
      const error = await errorOf(run(procedure, input));
      expect([procedure, error?.code]).toEqual([procedure, "NOT_FOUND"]);
      expect(error?.message).toBe("La institución no existe.");
    }
  });

  test("create provisions an admin with the superadmin as audit actor", async () => {
    const result = await run("create", newUser("2", "admin"));
    expect(result.user.role).toBe("admin");
    expect(result.username).toBeTruthy();
    const person = await personRow(result.user.personId);
    expect(person.organizationId).toBe(inst());
    expect(person.mustChangePassword).toBe(true);
    const event = auditOf("user.created", result.user.userId);
    expect(event).toMatchObject({ actorUserId: rootUserId, organizationId: inst() });
  });

  test("create also provisions tenant roles", async () => {
    const result = await run("create", newUser("3", "teacher"));
    expect(result.user.role).toBe("teacher");
  });

  test("create never provisions a second owner", async () => {
    const input = newUser("4", "owner");
    const created = () =>
      (root.auditLogger as RecordingAuditLogger).events.filter(
        (event) => event.action === "user.created",
      ).length;
    const countRows = async (table: typeof schema.person | typeof schema.member) =>
      (await fx.db.select({ id: table.id }).from(table).where(eq(table.organizationId, inst())))
        .length;
    const before = {
      events: created(),
      people: await countRows(schema.person),
      members: await countRows(schema.member),
    };
    const error = await errorOf(run("create", input));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("La institución ya tiene un propietario.");
    // The refusal happens before any write: no person/user/member for the submitted document.
    const documents = await fx.db
      .select({ id: schema.person.id })
      .from(schema.person)
      .where(eq(schema.person.documentNumber, input.documentNumber));
    expect(documents).toEqual([]);
    const users = await fx.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.name, `${input.firstName} ${input.lastName}`));
    expect(users).toEqual([]);
    expect(await countRows(schema.person)).toBe(before.people);
    expect(await countRows(schema.member)).toBe(before.members);
    expect(created()).toBe(before.events);
  });

  test("setActive deactivates and reactivates an admin; the owner stays protected by the last-owner rule", async () => {
    const admin = tenant.people.admin!;
    const off = await run("setActive", {
      institutionId: inst(),
      personId: admin.personId,
      active: false,
    });
    expect(off.isActive).toBe(false);
    expect(auditOf("user.deactivated", admin.userId)?.actorUserId).toBe(rootUserId);
    const on = await run("setActive", {
      institutionId: inst(),
      personId: admin.personId,
      active: true,
    });
    expect(on.isActive).toBe(true);

    const error = await errorOf(
      run("setActive", {
        institutionId: inst(),
        personId: tenant.people.owner!.personId,
        active: false,
      }),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("La institución debe conservar al menos un administrador activo.");
  });

  test("setActive on a person of another institution is NOT_FOUND", async () => {
    const error = await errorOf(
      run("setActive", {
        institutionId: inst(),
        personId: other.people.owner!.personId,
        active: false,
      }),
    );
    expect(error?.code).toBe("NOT_FOUND");
  });

  test("resetPassword (custom) re-arms the forced change and records the superadmin", async () => {
    const admin = tenant.people.admin!;
    expect(
      await run("resetPassword", {
        institutionId: inst(),
        personId: admin.personId,
        newPassword: "Clave-Nueva-123",
      }),
    ).toEqual({ ok: true });
    expect((await personRow(admin.personId)).mustChangePassword).toBe(true);
    const [account] = await fx.db
      .select()
      .from(schema.account)
      .where(
        and(eq(schema.account.userId, admin.userId), eq(schema.account.providerId, "credential")),
      );
    expect(await verifyPassword({ hash: account!.password!, password: "Clave-Nueva-123" })).toBe(
      true,
    );
    const event = auditOf("user.password_reset", admin.userId);
    expect(event?.actorUserId).toBe(rootUserId);
    expect(JSON.stringify(event?.metadata)).not.toContain("Clave-Nueva-123");
  });

  test("resetPassword rejects a short password with the spec message", async () => {
    const error = await errorOf(
      run("resetPassword", {
        institutionId: inst(),
        personId: tenant.people.admin!.personId,
        newPassword: "corta",
      }),
    );
    expect(error?.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(error?.data)).toContain(
      "La contraseña debe tener al menos 8 caracteres.",
    );
  });

  test("previewUsername returns the username and flags a taken document", async () => {
    const free = await run("previewUsername", {
      institutionId: inst(),
      firstName: "Ana",
      lastName: "Gil",
      documentNumber: "55512345",
    });
    expect(free).toMatchObject({ documentTaken: false });
    expect(free.username).toBeTruthy();
    const taken = await run("previewUsername", {
      institutionId: inst(),
      firstName: "Ana",
      lastName: "Gil",
      documentNumber: tenant.people.teacher!.documentNumber,
    });
    expect(taken.documentTaken).toBe(true);
  });

  test("previewUsername works without an institution and is null while a part is empty", async () => {
    const noInstitution = await run("previewUsername", {
      firstName: "Ana",
      lastName: "Gil",
      documentNumber: "55512345",
    });
    expect(noInstitution.documentTaken).toBe(false);
    expect(noInstitution.username).toBeTruthy();
    expect(
      await run("previewUsername", { firstName: "", lastName: "Gil", documentNumber: "55512345" }),
    ).toEqual({ username: null, documentTaken: false });
  });

  test("every procedure is FORBIDDEN for each institution role", async () => {
    const calls: [keyof typeof platformUserRouter, unknown][] = [
      ["list", { institutionId: inst() }],
      ["stats", { institutionId: inst() }],
      ["create", newUser("5", "teacher")],
      ["setActive", { institutionId: inst(), personId: "x", active: false }],
      ["resetPassword", { institutionId: inst(), personId: "x", newPassword: "Clave-12345" }],
      [
        "previewUsername",
        { institutionId: inst(), firstName: "A", lastName: "B", documentNumber: "12345678" },
      ],
    ];
    for (const role of SIGE_TEST_ROLES) {
      for (const [procedure, input] of calls) {
        const error = await errorOf(run(procedure, input, callers[role]));
        expect([role, procedure, error?.code]).toEqual([role, procedure, "FORBIDDEN"]);
      }
    }
  });
});

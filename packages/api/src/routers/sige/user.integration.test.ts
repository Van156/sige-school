import type { RecordingAuditLogger } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { call, ORPCError } from "@orpc/server";
import { verifyPassword } from "better-auth/crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import { createSlidingWindowLimiter } from "../../rate-limit";
import {
  isolationCase,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { TestTenant } from "../../sige/testing";
import { createUser, deleteUser, setUserActive } from "../../sige/user-service";
import type { UserActor } from "../../sige/user-service";
import { racingDb } from "../../sige/testing";
import { userRouter } from "./user";

/** `user.*` read side (sige/03 USR-01, §3.3): list, stats, get, options, previews, email check. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const listFilter = (
  id: "name" | "username" | "role" | "status",
  variant: "text" | "select",
  operator: "eq" | "ne" | "iLike" | "notILike",
  value: string,
) => ({ id, variant, operator, value });

await sigeSuite("user router (read side)", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let coordinator: Context;
  let adminCtx: Context;
  let teacherCtx: Context;
  const roles = [
    "owner",
    "admin",
    "coordinator",
    "teacher",
    "student",
    "parent",
    "viewer",
  ] as const;

  const list = (input: Record<string, unknown> = {}, context: Context = owner) =>
    call(userRouter.list, input as never, { context });
  const personIds = async (input: Record<string, unknown>) =>
    (await list(input)).rows.map((row) => row.personId).sort();
  const id = (role: (typeof roles)[number]) => tenant.people[role]!.personId;

  test("provisions a tenant with one user per role", async () => {
    tenant = await fx.provisionTenant("Usuarios", roles);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    coordinator = await fx.contextFor(tenant.people.coordinator!, tenant);
    adminCtx = await fx.contextFor(tenant.people.admin!, tenant);
    teacherCtx = await fx.contextFor(tenant.people.teacher!, tenant);
  });

  test("list returns every user with total, newest first, flagging the caller", async () => {
    const result = await list();
    expect(result.total).toBe(7);
    expect(result.rows).toHaveLength(7);
    const created = result.rows.map((row) => row.createdAt);
    expect(created).toEqual([...created].sort().reverse());
    expect(result.rows.filter((row) => row.isSelf).map((row) => row.personId)).toEqual([
      id("owner"),
    ]);
    const teacher = result.rows.find((row) => row.personId === id("teacher"))!;
    expect(teacher).toMatchObject({
      userId: tenant.people.teacher!.userId,
      username: tenant.people.teacher!.username,
      email: null, // placeholder addresses are not exposed
      firstName: "teacher",
      lastName: "Usuarios",
      name: "teacher Usuarios",
      role: "teacher",
      isActive: true,
      mustChangePassword: false,
      lastLoginAt: null,
      isSelf: false,
    });
    expect(typeof teacher.createdAt).toBe("string");
  });

  test("list exposes the address of users who have a real email", async () => {
    await fx.db
      .update(schema.person)
      .set({ hasRealEmail: true })
      .where(eq(schema.person.id, id("viewer")));
    const email = (
      await list({
        filters: [listFilter("username", "text", "iLike", tenant.people.viewer!.username)],
      })
    ).rows[0]?.email;
    expect(email).toContain("@");
    await fx.db
      .update(schema.person)
      .set({ hasRealEmail: false })
      .where(eq(schema.person.id, id("viewer")));
  });

  test("list pages and total ignores paging", async () => {
    const page = await list({ page: 2, perPage: 3, sort: [{ id: "username", desc: false }] });
    expect(page.total).toBe(7);
    expect(page.rows).toHaveLength(3);
    const all = await list({ sort: [{ id: "username", desc: false }] });
    expect(page.rows.map((row) => row.personId)).toEqual(
      all.rows.slice(3, 6).map((row) => row.personId),
    );
  });

  test("list sorts by every column", async () => {
    for (const column of ["username", "name", "role", "status", "createdAt", "lastLoginAt"]) {
      for (const desc of [false, true]) {
        const result = await list({ sort: [{ id: column, desc }] });
        expect(result.rows).toHaveLength(7);
      }
    }
    const byUsername = await list({ sort: [{ id: "username", desc: false }] });
    const names = byUsername.rows.map((row) => row.username);
    expect(names).toEqual([...names].sort());
  });

  test("name filter matches first name, last name, full name, username and email", async () => {
    const byFirst = await personIds({ filters: [listFilter("name", "text", "iLike", "TEACHER")] });
    expect(byFirst).toEqual([id("teacher")]);
    const byLast = await personIds({ filters: [listFilter("name", "text", "iLike", "usuarios")] });
    expect(byLast).toHaveLength(7);
    const byFull = await personIds({
      filters: [listFilter("name", "text", "iLike", "student Usuarios")],
    });
    expect(byFull).toEqual([id("student")]);
    const byUsername = await personIds({
      filters: [listFilter("name", "text", "iLike", tenant.people.parent!.username)],
    });
    expect(byUsername).toEqual([id("parent")]);
    const byEmail = await personIds({
      filters: [
        listFilter("name", "text", "iLike", `${tenant.people.coordinator!.username}@sin-correo`),
      ],
    });
    expect(byEmail).toEqual([id("coordinator")]);
    const none = await personIds({ filters: [listFilter("name", "text", "iLike", "zzzz")] });
    expect(none).toEqual([]);
  });

  test("name filter treats % and _ literally", async () => {
    expect(await personIds({ filters: [listFilter("name", "text", "iLike", "%")] })).toEqual([]);
    expect(await personIds({ filters: [listFilter("name", "text", "iLike", "_")] })).toEqual([]);
  });

  test("name notILike excludes every matching user", async () => {
    const rest = await personIds({ filters: [listFilter("name", "text", "notILike", "teacher")] });
    expect(rest).toHaveLength(6);
    expect(rest).not.toContain(id("teacher"));
  });

  test("username filter", async () => {
    const ids = await personIds({
      filters: [listFilter("username", "text", "iLike", tenant.people.viewer!.username)],
    });
    expect(ids).toEqual([id("viewer")]);
  });

  test("role filter: admin matches owner and admin; others match one role", async () => {
    expect(await personIds({ filters: [listFilter("role", "select", "eq", "admin")] })).toEqual(
      [id("owner"), id("admin")].sort(),
    );
    expect(await personIds({ filters: [listFilter("role", "select", "eq", "teacher")] })).toEqual([
      id("teacher"),
    ]);
    const notTeacher = await personIds({
      filters: [listFilter("role", "select", "ne", "teacher")],
    });
    expect(notTeacher).toHaveLength(6);
    expect(notTeacher).not.toContain(id("teacher"));
  });

  test("role filter matches by token inside a multi-role member (D3)", async () => {
    const member = fx.db
      .update(schema.member)
      .set({ role: "viewer, teacher" })
      .where(eq(schema.member.userId, tenant.people.viewer!.userId));
    await member;
    expect(await personIds({ filters: [listFilter("role", "select", "eq", "teacher")] })).toEqual(
      [id("teacher"), id("viewer")].sort(),
    );
    // `admin` is a token match, not a substring match.
    expect(await personIds({ filters: [listFilter("role", "select", "eq", "parent")] })).toEqual([
      id("parent"),
    ]);
    const row = (await list({ filters: [listFilter("name", "text", "iLike", "viewer Usuarios")] }))
      .rows[0]!;
    expect(row.role).toBe("viewer");
    await fx.db
      .update(schema.member)
      .set({ role: "viewer" })
      .where(eq(schema.member.userId, tenant.people.viewer!.userId));
  });

  test("status filter and joinOperator", async () => {
    await fx.db
      .update(schema.person)
      .set({ isActive: false })
      .where(eq(schema.person.id, id("student")));
    expect(
      await personIds({ filters: [listFilter("status", "select", "eq", "inactive")] }),
    ).toEqual([id("student")]);
    expect(
      await personIds({ filters: [listFilter("status", "select", "eq", "active")] }),
    ).toHaveLength(6);
    expect(await personIds({ filters: [listFilter("status", "select", "ne", "active")] })).toEqual([
      id("student"),
    ]);
    const either = await personIds({
      filters: [
        listFilter("status", "select", "eq", "inactive"),
        listFilter("role", "select", "eq", "teacher"),
      ],
      joinOperator: "or",
    });
    expect(either).toEqual([id("student"), id("teacher")].sort());
    const both = await personIds({
      filters: [
        listFilter("status", "select", "eq", "inactive"),
        listFilter("role", "select", "eq", "teacher"),
      ],
    });
    expect(both).toEqual([]);
    const sorted = await list({ sort: [{ id: "status", desc: false }] });
    expect(sorted.rows[0]?.personId).toBe(id("student"));
    await fx.db
      .update(schema.person)
      .set({ isActive: true })
      .where(eq(schema.person.id, id("student")));
  });

  test("stats counts total, teachers, students and active", async () => {
    await fx.db
      .update(schema.person)
      .set({ isActive: false })
      .where(eq(schema.person.id, id("parent")));
    expect(await call(userRouter.stats, undefined, { context: owner })).toEqual({
      total: 7,
      teachers: 1,
      students: 1,
      active: 6,
    });
    await fx.db
      .update(schema.person)
      .set({ isActive: true })
      .where(eq(schema.person.id, id("parent")));
  });

  test("get returns the detail with studentId null (D4)", async () => {
    await fx.db
      .update(schema.person)
      .set({ phone: "3001234567", birthDate: "2001-02-03", gender: "F" })
      .where(eq(schema.person.id, id("teacher")));
    const detail = await call(userRouter.get, { personId: id("teacher") }, { context: owner });
    expect(detail).toMatchObject({
      personId: id("teacher"),
      role: "teacher",
      documentType: "CC",
      documentNumber: tenant.people.teacher!.documentNumber,
      birthDate: "2001-02-03",
      gender: "F",
      phone: "3001234567",
      address: null,
      hasRealEmail: false,
      studentId: null,
      isSelf: false,
    });
    const self = await call(userRouter.get, { personId: id("owner") }, { context: owner });
    expect(self.isSelf).toBe(true);
  });

  test("get of an unknown id is NOT_FOUND with the Spanish message", async () => {
    const error = await errorOf(call(userRouter.get, { personId: "missing" }, { context: owner }));
    expect(error?.code).toBe("NOT_FOUND");
    expect(error?.message).toBe("El usuario no existe.");
  });

  test("options lists only active teachers or parents and works for a coordinator (USR-R10)", async () => {
    const teachers = await call(userRouter.options, { role: "teacher" }, { context: coordinator });
    expect(teachers).toEqual([
      {
        personId: id("teacher"),
        name: "teacher Usuarios",
        username: tenant.people.teacher!.username,
        document: tenant.people.teacher!.documentNumber,
      },
    ]);
    const parents = await call(userRouter.options, { role: "parent" }, { context: owner });
    expect(parents.map((row) => row.personId)).toEqual([id("parent")]);
  });

  test("options hides deactivated persons and filters by search", async () => {
    await fx.db
      .update(schema.person)
      .set({ isActive: false })
      .where(eq(schema.person.id, id("teacher")));
    expect(await call(userRouter.options, { role: "teacher" }, { context: owner })).toEqual([]);
    await fx.db
      .update(schema.person)
      .set({ isActive: true })
      .where(eq(schema.person.id, id("teacher")));
    const byName = await call(
      userRouter.options,
      { role: "teacher", search: "TEACH" },
      { context: owner },
    );
    expect(byName).toHaveLength(1);
    const byDocument = await call(
      userRouter.options,
      { role: "teacher", search: tenant.people.teacher!.documentNumber },
      { context: owner },
    );
    expect(byDocument).toHaveLength(1);
    expect(
      await call(userRouter.options, { role: "teacher", search: "nobody" }, { context: owner }),
    ).toEqual([]);
    expect(
      await call(userRouter.options, { role: "teacher", search: "%" }, { context: owner }),
    ).toEqual([]);
  });

  test("options matches multi-role members by token and caps the limit", async () => {
    await fx.db
      .update(schema.member)
      .set({ role: "viewer,teacher" })
      .where(eq(schema.member.userId, tenant.people.viewer!.userId));
    const teachers = await call(userRouter.options, { role: "teacher" }, { context: owner });
    expect(teachers.map((row) => row.personId).sort()).toEqual(
      [id("teacher"), id("viewer")].sort(),
    );
    const one = await call(userRouter.options, { role: "teacher", limit: 1 }, { context: owner });
    expect(one).toHaveLength(1);
    const tooMany = await errorOf(
      call(userRouter.options, { role: "teacher", limit: 51 }, { context: owner }),
    );
    expect(tooMany?.code).toBe("BAD_REQUEST");
    await fx.db
      .update(schema.member)
      .set({ role: "viewer" })
      .where(eq(schema.member.userId, tenant.people.viewer!.userId));
  });

  test("options refuses a caller with none of the three permissions", async () => {
    const error = await errorOf(
      call(userRouter.options, { role: "teacher" }, { context: teacherCtx }),
    );
    expect(error?.code).toBe("FORBIDDEN");
  });

  test("previewUsername generates without writing and is null while any part is empty", async () => {
    const before = await fx.db.select().from(schema.person);
    const preview = await call(
      userRouter.previewUsername,
      { firstName: "María", lastName: "Londoño", documentNumber: "9876543210" },
      { context: owner },
    );
    expect(preview).toEqual({ username: "mlondono3210", documentTaken: false });
    expect(await fx.db.select().from(schema.person)).toHaveLength(before.length);
    for (const empty of [
      { firstName: "", lastName: "Londoño", documentNumber: "9876543210" },
      { firstName: "María", lastName: " ", documentNumber: "9876543210" },
      { firstName: "María", lastName: "Londoño", documentNumber: "" },
    ]) {
      expect(await call(userRouter.previewUsername, empty, { context: owner })).toEqual({
        username: null,
        documentTaken: false,
      });
    }
  });

  test("previewUsername appends a suffix on collision and reports a taken document", async () => {
    const taken = tenant.people.teacher!;
    const person = (
      await fx.db.select().from(schema.person).where(eq(schema.person.id, taken.personId))
    )[0]!;
    const collision = await call(
      userRouter.previewUsername,
      {
        firstName: person.firstName,
        lastName: person.lastName,
        documentNumber: taken.documentNumber,
      },
      { context: owner },
    );
    expect(collision.documentTaken).toBe(true);
    expect(collision.username).toBe(`${taken.username}_2`);
  });

  test("checkEmail reports availability, case-insensitively", async () => {
    await fx.db
      .update(schema.user)
      .set({ email: "ocupado@colegio.co" })
      .where(eq(schema.user.id, tenant.people.viewer!.userId));
    const check = (email: string, context: Context = owner) =>
      call(userRouter.checkEmail, { email }, { context });
    expect(await check("ocupado@colegio.co")).toEqual({ available: false });
    expect(await check(" OCUPADO@Colegio.co ")).toEqual({ available: false });
    expect(await check("libre@colegio.co")).toEqual({ available: true });
    const invalid = await errorOf(check("no-es-correo"));
    expect(invalid?.code).toBe("BAD_REQUEST");
  });

  test("checkEmail is limited to 30 calls per minute per user", async () => {
    let now = 1_000_000;
    const rateLimiter = createSlidingWindowLimiter(() => now);
    const limited: Context = { ...owner, rateLimiter };
    const other: Context = { ...adminCtx, rateLimiter };
    const check = (context: Context) =>
      call(userRouter.checkEmail, { email: "libre@colegio.co" }, { context });
    for (let i = 0; i < 30; i += 1) {
      expect(await check(limited)).toEqual({ available: true });
    }
    const error = await errorOf(check(limited));
    expect(error?.code).toBe("TOO_MANY_REQUESTS");
    expect(error?.status).toBe(429);
    expect(error?.message).toBe("Demasiadas verificaciones. Intenta de nuevo en un momento.");
    // Another user is unaffected; the window slides.
    expect(await check(other)).toEqual({ available: true });
    now += 60_001;
    expect(await check(limited)).toEqual({ available: true });
  });

  test("a refused permission does not consume the rate limit", async () => {
    const rateLimiter = createSlidingWindowLimiter(() => 0);
    const context: Context = { ...teacherCtx, rateLimiter };
    for (let i = 0; i < 31; i += 1) {
      const error = await errorOf(
        call(userRouter.checkEmail, { email: "libre@colegio.co" }, { context }),
      );
      expect(error?.code).toBe("FORBIDDEN");
    }
  });
});

await testPermissionMatrix({
  name: "user (read side)",
  procedures: [
    {
      name: "user.list",
      permissions: { user: ["read"] },
      run: (context) => call(userRouter.list, {}, { context }),
    },
    {
      name: "user.stats",
      permissions: { user: ["read"] },
      run: (context) => call(userRouter.stats, undefined, { context }),
    },
    {
      name: "user.get",
      permissions: { user: ["read"] },
      run: (context) => call(userRouter.get, { personId: "missing" }, { context }),
    },
    {
      name: "user.options",
      permissions: null,
      anyOf: [{ user: ["read"] }, { course: ["update"] }, { offering: ["update"] }],
      run: (context) => call(userRouter.options, { role: "teacher" }, { context }),
    },
    {
      name: "user.previewUsername",
      permissions: { user: ["create"] },
      run: (context) =>
        call(
          userRouter.previewUsername,
          { firstName: "A", lastName: "B", documentNumber: "12345" },
          { context },
        ),
    },
    {
      name: "user.checkEmail",
      permissions: { user: ["create"] },
      run: (context) => call(userRouter.checkEmail, { email: "x@y.co" }, { context }),
    },
  ],
});

const seed = async (t: TestTenant) => ({
  teacher: t.people.teacher!,
  owner: t.people.owner!,
});
type Seed = Awaited<ReturnType<typeof seed>>;
const foreignIds = (foreign: Seed) => [
  foreign.teacher.personId,
  foreign.teacher.username,
  foreign.teacher.documentNumber,
  foreign.owner.username,
];

await testTenantIsolation({
  name: "user (read side)",
  cases: [
    isolationCase({
      name: "user.list never returns the other tenant's users",
      seed,
      run: ({ context }) => call(userRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds,
    }),
    isolationCase({
      name: "user.list filtered by a foreign name, username or role returns nothing foreign",
      seed,
      run: ({ context, foreign }) =>
        call(
          userRouter.list,
          {
            filters: [
              listFilter("name", "text", "iLike", foreign.teacher.username),
              listFilter("username", "text", "iLike", foreign.owner.username),
              listFilter("role", "select", "eq", "teacher"),
            ],
            joinOperator: "or",
          },
          { context },
        ),
      expectation: "noLeak",
      foreignIds,
    }),
    isolationCase({
      name: "user.stats never counts the other tenant's users",
      seed,
      run: async ({ context }) => {
        const stats = await call(userRouter.stats, undefined, { context });
        expect(stats).toEqual({ total: 2, teachers: 1, students: 0, active: 2 });
        return stats;
      },
      expectation: "noLeak",
      foreignIds,
    }),
    isolationCase({
      name: "user.get of a foreign person is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(userRouter.get, { personId: foreign.teacher.personId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "user.options never returns the other tenant's teachers",
      seed,
      run: ({ context, foreign }) =>
        call(
          userRouter.options,
          { role: "teacher", search: foreign.teacher.username },
          { context },
        ),
      expectation: "noLeak",
      foreignIds,
    }),
    isolationCase({
      name: "user.previewUsername does not see a foreign document and writes nothing",
      seed,
      run: async ({ context, foreign }) => {
        const result = await call(
          userRouter.previewUsername,
          { firstName: "Otro", lastName: "Nombre", documentNumber: foreign.teacher.documentNumber },
          { context },
        );
        expect(result.documentTaken).toBe(false);
        return result;
      },
      expectation: "noLeak",
      foreignIds,
    }),
    isolationCase({
      name: "user.checkEmail says only that a foreign address is taken (USR-R5)",
      seed,
      run: async ({ context, fixture, foreign }) => {
        await fixture.db
          .update(schema.user)
          .set({ email: "foraneo@beta.co" })
          .where(eq(schema.user.id, foreign.owner.userId));
        const result = await call(userRouter.checkEmail, { email: "foraneo@beta.co" }, { context });
        expect(result).toEqual({ available: false });
        return result;
      },
      expectation: "noLeak",
      foreignIds,
    }),
  ],
});

const events = (context: Context) => (context.auditLogger as RecordingAuditLogger).events;
const eventsFor = (context: Context, action: string) =>
  events(context).filter((event) => event.action === action);

let documentSeq = 0;
const newDocument = () => `9${String(Date.now() % 100_000_000).padStart(8, "0")}${documentSeq++}`;
const newUser = (role: string, overrides: Record<string, unknown> = {}) => ({
  firstName: "Nuevo",
  lastName: "Usuario",
  documentType: "CC",
  documentNumber: newDocument(),
  role,
  ...overrides,
});

await sigeSuite("user router (write side)", (fx) => {
  let tenant: TestTenant;
  let other: TestTenant;
  let owner: Context;
  let adminCtx: Context;
  let platform: UserActor;

  const create = (input: Record<string, unknown>, context: Context = owner) =>
    call(userRouter.create, input as never, { context });
  const update = (input: Record<string, unknown>, context: Context = owner) =>
    call(userRouter.update, input as never, { context });
  const setActive = (personId: string, active: boolean, context: Context = owner) =>
    call(userRouter.setActive, { personId, active }, { context });
  const remove = (personId: string, context: Context = owner) =>
    call(userRouter.delete, { personId }, { context });
  const sessionCount = async (userId: string) =>
    (
      await fx.db
        .select({ n: count() })
        .from(schema.session)
        .where(eq(schema.session.userId, userId))
    )[0]!.n;
  const personRow = async (personId: string) =>
    (await fx.db.select().from(schema.person).where(eq(schema.person.id, personId)))[0];

  test("provisions tenants", async () => {
    tenant = await fx.provisionTenant("Escritura", ["owner", "admin", "teacher", "coordinator"]);
    other = await fx.provisionTenant("Otra", ["owner"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    adminCtx = await fx.contextFor(tenant.people.admin!, tenant);
    platform = { userId: tenant.people.owner!.userId, platform: true };
  });

  {
    test("creates one user per tenant role; student gets next STU-03", async () => {
      for (const role of ["coordinator", "teacher", "student", "parent", "viewer"] as const) {
        const result = await create(newUser(role, { firstName: "María", lastName: "Peña" }));
        expect(result.user.role).toBe(role);
        expect(result.user.name).toBe("María Peña");
        expect(result.username).toBe(result.user.username);
        expect(result.user.isActive).toBe(true);
        expect(result.user.mustChangePassword).toBe(true);
        expect(result.next).toEqual(
          role === "student" ? { screen: "STU-03", personId: result.user.personId } : null,
        );
      }
      expect(eventsFor(owner, "user.created").length).toBeGreaterThanOrEqual(5);
    });

    test("an admin caller can create too, and a real email is stored lowercase", async () => {
      const result = await create(newUser("teacher", { email: "Profe@Colegio.CO" }), adminCtx);
      expect(result.user.email).toBe("profe@colegio.co");
    });

    test("org callers cannot create admin or owner", async () => {
      for (const role of ["admin", "owner"]) {
        const error = await errorOf(create(newUser(role)));
        expect(error?.code).toBe("BAD_REQUEST");
      }
      const service = await errorOf(
        createUser(
          { db: fx.db, auditLogger: owner.auditLogger },
          tenant.orgId,
          newUser("admin") as never,
          { userId: tenant.people.owner!.userId, platform: false },
        ),
      );
      expect(service?.code).toBe("BAD_REQUEST");
      expect(service?.message).toBe("Solo la plataforma puede crear administradores.");
    });

    test("a platform actor may create an admin", async () => {
      const result = await createUser(
        { db: fx.db, auditLogger: owner.auditLogger },
        tenant.orgId,
        newUser("admin") as never,
        platform,
      );
      expect(result.user.role).toBe("admin");
    });

    test("a duplicate document or email is a CONFLICT with the spec message", async () => {
      const first = newUser("teacher", { email: "dup@colegio.co" });
      await create(first);
      const sameDocument = await errorOf(
        create(newUser("teacher", { documentNumber: first.documentNumber })),
      );
      expect(sameDocument?.code).toBe("CONFLICT");
      expect(sameDocument?.message).toBe("Ya existe un usuario con este documento.");
      const sameEmail = await errorOf(create(newUser("teacher", { email: "DUP@colegio.co" })));
      expect(sameEmail?.code).toBe("CONFLICT");
      expect(sameEmail?.message).toBe("Ya existe un usuario con este correo.");
    });

    test("the same document in another institution is allowed", async () => {
      const input = newUser("teacher");
      await create(input);
      const otherCtx = await fx.contextFor(other.people.owner!, other);
      expect((await create(input, otherCtx)).user.role).toBe("teacher");
    });
  }

  {
    const seedTeacher = async () => (await create(newUser("teacher"))).user;

    test("edits the profile, syncs user.name, keeps username and role, audits before/after", async () => {
      const teacher = await seedTeacher();
      const before = events(owner).length;
      const updated = await update({
        personId: teacher.personId,
        firstName: "Ana",
        lastName: "Gómez",
        documentType: "CE",
        documentNumber: "AB12345",
        phone: "3001112222",
        role: "admin",
      });
      expect(updated).toMatchObject({
        firstName: "Ana",
        lastName: "Gómez",
        name: "Ana Gómez",
        username: teacher.username,
        role: "teacher",
        documentType: "CE",
        documentNumber: "AB12345",
        phone: "3001112222",
      });
      const [userRow] = await fx.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, teacher.userId));
      expect(userRow?.name).toBe("Ana Gómez");
      const [event] = events(owner).slice(before);
      expect(event).toMatchObject({
        action: "user.updated",
        targetType: "user",
        targetId: teacher.userId,
      });
      const metadata = event!.metadata as {
        changed: string[];
        before: Record<string, unknown>;
        after: Record<string, unknown>;
      };
      expect(metadata.changed).toContain("documentNumber");
      expect(metadata.before.firstName).toBe(teacher.firstName);
      expect(metadata.after.firstName).toBe("Ana");
      expect(
        eventsFor(owner, "user.updated").filter((e) => e.targetId === teacher.userId),
      ).toHaveLength(1);
    });

    test("an unchanged edit writes no audit event", async () => {
      const teacher = await seedTeacher();
      const detail = await call(userRouter.get, { personId: teacher.personId }, { context: owner });
      const before = events(owner).length;
      await update({
        personId: teacher.personId,
        firstName: detail.firstName,
        lastName: detail.lastName,
        documentType: detail.documentType,
        documentNumber: detail.documentNumber,
        country: detail.country ?? undefined,
      });
      expect(events(owner).length).toBe(before);
    });

    test("email: set marks it real and verified; clearing reverts to the placeholder", async () => {
      const teacher = await seedTeacher();
      const base = {
        personId: teacher.personId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        documentType: "CC",
        documentNumber: (await personRow(teacher.personId))!.documentNumber,
      };
      const withEmail = await update({ ...base, email: "Nuevo@Colegio.co" });
      expect(withEmail.email).toBe("nuevo@colegio.co");
      expect(withEmail.hasRealEmail).toBe(true);
      const [stored] = await fx.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, teacher.userId));
      expect(stored).toMatchObject({ email: "nuevo@colegio.co", emailVerified: true });

      const cleared = await update({ ...base });
      expect(cleared.email).toBeNull();
      expect(cleared.hasRealEmail).toBe(false);
      const [after] = await fx.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, teacher.userId));
      expect(after?.email).toBe(`${teacher.username}@sin-correo.${tenant.slug}.invalid`);
    });

    test("reverting to the placeholder email marks it unverified", async () => {
      const teacher = await seedTeacher();
      const base = {
        personId: teacher.personId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        documentType: "CC",
        documentNumber: (await personRow(teacher.personId))!.documentNumber,
      };
      await update({ ...base, email: "real@colegio.co" });
      await update({ ...base });
      const [stored] = await fx.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, teacher.userId));
      expect(stored?.emailVerified).toBe(false);
    });

    test("a failed password reset leaves no user.updated event and no change", async () => {
      const teacher = await seedTeacher();
      const before = events(owner).length;
      const original = await personRow(teacher.personId);
      await fx.db.execute(
        sql.raw(
          `CREATE OR REPLACE FUNCTION test_fail_account_update() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'blocked by test'; END; $$ LANGUAGE plpgsql`,
        ),
      );
      await fx.db.execute(
        sql.raw(
          `CREATE TRIGGER test_fail_account BEFORE UPDATE ON account FOR EACH ROW EXECUTE FUNCTION test_fail_account_update()`,
        ),
      );
      let error: ORPCError<string, any> | null;
      try {
        error = await errorOf(
          update({
            personId: teacher.personId,
            firstName: "Cambiado",
            lastName: teacher.lastName,
            documentNumber: original!.documentNumber,
            newPassword: "Nueva-Clave-123",
          }),
        );
      } finally {
        await fx.db.execute(sql.raw(`DROP TRIGGER IF EXISTS test_fail_account ON account`));
      }
      expect(error).not.toBeNull();
      expect(events(owner).slice(before)).toEqual([]);
      expect((await personRow(teacher.personId))!.firstName).toBe(original!.firstName);
    });

    test("a taken document or email is a CONFLICT", async () => {
      const a = await seedTeacher();
      const b = await seedTeacher();
      await update({
        personId: a.personId,
        firstName: a.firstName,
        lastName: a.lastName,
        documentNumber: (await personRow(a.personId))!.documentNumber,
        email: "ocupado2@colegio.co",
      });
      const base = {
        personId: b.personId,
        firstName: b.firstName,
        lastName: b.lastName,
        documentNumber: (await personRow(b.personId))!.documentNumber,
      };
      const document = await errorOf(
        update({ ...base, documentNumber: (await personRow(a.personId))!.documentNumber }),
      );
      expect(document?.code).toBe("CONFLICT");
      expect(document?.message).toBe("Ya existe un usuario con este documento.");
      const email = await errorOf(update({ ...base, email: "ocupado2@colegio.co" }));
      expect(email?.code).toBe("CONFLICT");
      expect(email?.message).toBe("Ya existe un usuario con este correo.");
      expect((await personRow(b.personId))!.hasRealEmail).toBe(false);
    });

    test("owner and admin rows are FORBIDDEN for org callers; unknown and foreign ids are NOT_FOUND", async () => {
      const edit = (personId: string, context: Context = owner) =>
        update({ personId, firstName: "X", lastName: "Y", documentNumber: "12345678" }, context);
      for (const target of [tenant.people.owner!, tenant.people.admin!]) {
        for (const context of [owner, adminCtx]) {
          expect((await errorOf(edit(target.personId, context)))?.code).toBe("FORBIDDEN");
        }
      }
      expect((await errorOf(edit("missing")))?.code).toBe("NOT_FOUND");
      expect((await errorOf(edit(other.people.owner!.personId)))?.code).toBe("NOT_FOUND");
    });

    test("newPassword behaves as a custom reset: hash, forced change, sessions revoked, audited without secrets", async () => {
      const teacher = await seedTeacher();
      const teacherTenantPerson = {
        role: "teacher" as const,
        userId: teacher.userId,
        personId: teacher.personId,
        username: teacher.username,
        documentNumber: "",
      };
      await fx.db
        .update(schema.person)
        .set({ mustChangePassword: false })
        .where(eq(schema.person.id, teacher.personId));
      await fx.contextFor(teacherTenantPerson, tenant);
      expect(await sessionCount(teacher.userId)).toBeGreaterThan(0);
      const before = events(owner).length;
      await update({
        personId: teacher.personId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        documentNumber: (await personRow(teacher.personId))!.documentNumber,
        country: "Colombia",
        newPassword: "Nueva-Clave-123",
      });
      const [credential] = await fx.db
        .select()
        .from(schema.account)
        .where(
          and(
            eq(schema.account.userId, teacher.userId),
            eq(schema.account.providerId, "credential"),
          ),
        );
      expect(
        await verifyPassword({ hash: credential!.password!, password: "Nueva-Clave-123" }),
      ).toBe(true);
      expect((await personRow(teacher.personId))!.mustChangePassword).toBe(true);
      expect(await sessionCount(teacher.userId)).toBe(0);
      const recorded = events(owner).slice(before);
      expect(recorded.map((event) => event.action)).toEqual(["user.password_reset"]);
      expect(recorded[0]!.metadata).toEqual({ personId: teacher.personId, mode: "custom" });
      expect(JSON.stringify(events(owner))).not.toContain("Nueva-Clave-123");
    });
  }

  {
    test("deactivation revokes every session and audits; reactivation audits and restores", async () => {
      const teacher = (await create(newUser("teacher"))).user;
      const person = {
        role: "teacher" as const,
        userId: teacher.userId,
        personId: teacher.personId,
        username: teacher.username,
        documentNumber: "",
      };
      await fx.contextFor(person, tenant);
      await fx.contextFor(person, tenant);
      expect(await sessionCount(teacher.userId)).toBe(2);
      const off = await setActive(teacher.personId, false);
      expect(off.isActive).toBe(false);
      expect(await sessionCount(teacher.userId)).toBe(0);
      const deactivated = eventsFor(owner, "user.deactivated").at(-1)!;
      expect(deactivated.metadata).toEqual({ personId: teacher.personId, role: "teacher" });
      const on = await setActive(teacher.personId, true);
      expect(on.isActive).toBe(true);
      expect(eventsFor(owner, "user.reactivated").at(-1)!.metadata).toEqual({
        personId: teacher.personId,
        role: "teacher",
      });
    });

    test("repeating the current state writes no audit", async () => {
      const teacher = (await create(newUser("teacher"))).user;
      const before = events(owner).length;
      await setActive(teacher.personId, true);
      expect(events(owner).length).toBe(before);
    });

    test("self-deactivation and protected rows are FORBIDDEN", async () => {
      const self = await errorOf(setActive(tenant.people.owner!.personId, false));
      expect(self?.code).toBe("FORBIDDEN");
      expect(self?.message).toBe("No puede desactivar su propia cuenta.");
      const adminSelf = await errorOf(setActive(tenant.people.admin!.personId, false, adminCtx));
      expect(adminSelf?.message).toBe("No puede desactivar su propia cuenta.");
      const protectedRow = await errorOf(setActive(tenant.people.admin!.personId, false));
      expect(protectedRow?.code).toBe("FORBIDDEN");
      expect((await errorOf(setActive("missing", false)))?.code).toBe("NOT_FOUND");
      expect((await personRow(tenant.people.admin!.personId))!.isActive).toBe(true);
    });

    test("the institution keeps at least one active owner", async () => {
      const solo = await fx.provisionTenant("Solo", ["owner"]);
      const deps = { db: fx.db, auditLogger: owner.auditLogger };
      const error = await errorOf(
        setUserActive(deps, solo.orgId, solo.people.owner!.personId, false, platform),
      );
      expect(error?.code).toBe("CONFLICT");
      expect(error?.message).toBe(
        "La institución debe conservar al menos un administrador activo.",
      );
      expect((await personRow(solo.people.owner!.personId))!.isActive).toBe(true);
    });

    test("two concurrent deactivations of the last two owners leave one active", async () => {
      const duo = await fx.provisionTenant("Duo", ["owner", "admin"]);
      await fx.db
        .update(schema.member)
        .set({ role: "owner" })
        .where(
          and(
            eq(schema.member.organizationId, duo.orgId),
            eq(schema.member.userId, duo.people.admin!.userId),
          ),
        );
      // Each statement is delayed, so without a lock both checks would pass before either write.
      const slow = racingDb(fx.db, () => new Promise((resolve) => setTimeout(resolve, 150)));
      const deps = { db: slow, auditLogger: owner.auditLogger };
      const results = await Promise.allSettled([
        setUserActive(deps, duo.orgId, duo.people.owner!.personId, false, platform),
        setUserActive(deps, duo.orgId, duo.people.admin!.personId, false, platform),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect((rejected.reason as ORPCError<string, unknown>).message).toBe(
        "La institución debe conservar al menos un administrador activo.",
      );
      const active = await fx.db
        .select()
        .from(schema.person)
        .where(and(eq(schema.person.organizationId, duo.orgId), eq(schema.person.isActive, true)));
      expect(active).toHaveLength(1);
    });
  }

  {
    test("removes user, account, member, person and sessions; audits a name and role snapshot", async () => {
      const created = (
        await create(newUser("coordinator", { firstName: "Luis", lastName: "Mora" }))
      ).user;
      await fx.contextFor(
        {
          role: "coordinator",
          userId: created.userId,
          personId: created.personId,
          username: created.username,
          documentNumber: "",
        },
        tenant,
      );
      expect(await remove(created.personId)).toEqual({ deleted: true });
      for (const [table, column] of [
        [schema.user, schema.user.id],
        [schema.account, schema.account.userId],
        [schema.member, schema.member.userId],
        [schema.person, schema.person.userId],
        [schema.session, schema.session.userId],
      ] as const) {
        const rows = await fx.db.select().from(table).where(eq(column, created.userId));
        expect(rows).toHaveLength(0);
      }
      const event = eventsFor(owner, "user.deleted").at(-1)!;
      expect(event.targetId).toBe(created.userId);
      expect(event.metadata).toMatchObject({
        personId: created.personId,
        name: "Luis Mora",
        role: "coordinator",
      });
    });

    test("a course director cannot be deleted: HAS_DEPENDENTS with the teacher message, nothing removed", async () => {
      const teacher = (await create(newUser("teacher"))).user;
      const [campus] = await fx.db
        .insert(schema.campus)
        .values({ organizationId: tenant.orgId, name: `Sede ${crypto.randomUUID()}` })
        .returning();
      await fx.db.insert(schema.course).values({
        organizationId: tenant.orgId,
        campusId: campus!.id,
        directorPersonId: teacher.personId,
        name: "6A",
        academicYear: "2026",
        shift: "Mañana",
      });
      const error = await errorOf(remove(teacher.personId));
      expect(error?.code).toBe("HAS_DEPENDENTS");
      expect(error?.message).toBe("El profesor tiene asignaturas o grupos a cargo.");
      expect(await personRow(teacher.personId)).toBeDefined();
      expect(
        await fx.db.select().from(schema.user).where(eq(schema.user.id, teacher.userId)),
      ).toHaveLength(1);
    });

    test("any other reference gets the generic message", async () => {
      const coordinator = (await create(newUser("coordinator"))).user;
      await fx.db.insert(schema.importJob).values({
        organizationId: tenant.orgId,
        kind: "users",
        status: "done",
        createdBy: coordinator.personId,
      });
      const error = await errorOf(remove(coordinator.personId));
      expect(error?.code).toBe("HAS_DEPENDENTS");
      expect(error?.message).toBe("El usuario tiene registros asociados. Desactívelo en su lugar.");
    });

    test("self, protected rows, unknown and foreign ids", async () => {
      const self = await errorOf(remove(tenant.people.owner!.personId));
      expect(self?.code).toBe("FORBIDDEN");
      expect(self?.message).toBe("No puede eliminar su propia cuenta.");
      expect((await errorOf(remove(tenant.people.admin!.personId)))?.code).toBe("FORBIDDEN");
      expect((await errorOf(remove("missing")))?.code).toBe("NOT_FOUND");
      expect((await errorOf(remove(other.people.owner!.personId)))?.code).toBe("NOT_FOUND");
    });

    test("the last active owner cannot be deleted", async () => {
      const solo = await fx.provisionTenant("Solo2", ["owner"]);
      const error = await errorOf(
        deleteUser(
          { db: fx.db, auditLogger: owner.auditLogger },
          solo.orgId,
          solo.people.owner!.personId,
          platform,
        ),
      );
      expect(error?.code).toBe("CONFLICT");
      expect(error?.message).toBe(
        "La institución debe conservar al menos un administrador activo.",
      );
    });
  }

  test("no audit event carries a secret", () => {
    const serialized = JSON.stringify(events(owner).map((event) => event.metadata));
    expect(serialized).not.toMatch(/password|hash|token/i);
  });
});

await testPermissionMatrix({
  name: "user (write side)",
  procedures: [
    {
      name: "user.create",
      permissions: { user: ["create"] },
      run: (context) => call(userRouter.create, newUser("teacher") as never, { context }),
    },
    {
      name: "user.update",
      permissions: { user: ["update"] },
      run: (context) =>
        call(
          userRouter.update,
          { personId: "missing", firstName: "A", lastName: "B", documentNumber: "12345" } as never,
          { context },
        ),
    },
    {
      name: "user.setActive",
      permissions: { user: ["update"] },
      run: (context) =>
        call(userRouter.setActive, { personId: "missing", active: false }, { context }),
    },
    {
      name: "user.delete",
      permissions: { user: ["delete"] },
      run: (context) => call(userRouter.delete, { personId: "missing" }, { context }),
    },
  ],
});

const writeSeed = async (t: TestTenant) => ({ teacher: t.people.teacher!, owner: t.people.owner! });
type WriteSeed = Awaited<ReturnType<typeof writeSeed>>;
const foreignWriteIds = (foreign: WriteSeed) => [
  foreign.teacher.personId,
  foreign.teacher.username,
];
await testTenantIsolation({
  name: "user (write side)",
  cases: [
    isolationCase({
      name: "user.update of a foreign person is NOT_FOUND",
      seed: writeSeed,
      expectation: "notFound",
      run: ({ context, foreign }) =>
        call(
          userRouter.update,
          {
            personId: foreign.teacher.personId,
            firstName: "Hack",
            lastName: "Er",
            documentNumber: "99999999",
          } as never,
          { context },
        ),
    }),
    isolationCase({
      name: "user.setActive of a foreign person is NOT_FOUND",
      seed: writeSeed,
      expectation: "notFound",
      run: ({ context, foreign }) =>
        call(
          userRouter.setActive,
          { personId: foreign.teacher.personId, active: false },
          { context },
        ),
    }),
    isolationCase({
      name: "user.delete of a foreign person is NOT_FOUND",
      seed: writeSeed,
      expectation: "notFound",
      run: ({ context, foreign }) =>
        call(userRouter.delete, { personId: foreign.teacher.personId }, { context }),
    }),
    isolationCase({
      name: "user.create never lands in the other tenant",
      seed: writeSeed,
      expectation: "noLeak",
      foreignIds: foreignWriteIds,
      run: ({ context }) => call(userRouter.create, newUser("teacher") as never, { context }),
    }),
  ],
});

import * as schema from "@base-template/db/schema";
import { call, ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
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

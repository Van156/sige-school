import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { eq } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import {
  isolationCase,
  racingDb,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { SigeTestFixture, TestTenant } from "../../sige/testing";
import { classroomRouter } from "./classroom";

/** `classroom.*` (sige/04 SCH-07/08, §3.4, §4): server list, CRUD, campus rules, audit. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const seedCampus = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  values: Partial<typeof schema.campus.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.campus)
    .values({ organizationId: tenant.orgId, name: `Sede ${crypto.randomUUID()}`, ...values })
    .returning();
  return row!;
};

const seedClassroom = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  values: Partial<typeof schema.classroom.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.classroom)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: `Salón ${crypto.randomUUID().slice(0, 8)}`,
      code: `C-${crypto.randomUUID().slice(0, 8)}`,
      ...values,
    })
    .returning();
  return row!;
};

/** A class in `classroomId`: course, subject, offering and one slot. */
const seedSlot = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  classroomId: string,
) => {
  const [course] = await fx.db
    .insert(schema.course)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: `Curso ${crypto.randomUUID().slice(0, 8)}`,
      academicYear: "2026",
      shift: "Mañana",
    })
    .returning();
  const [subject] = await fx.db
    .insert(schema.subject)
    .values({ organizationId: tenant.orgId, name: `Materia ${crypto.randomUUID().slice(0, 8)}` })
    .returning();
  const [offering] = await fx.db
    .insert(schema.offering)
    .values({ organizationId: tenant.orgId, courseId: course!.id, subjectId: subject!.id })
    .returning();
  await fx.db.insert(schema.scheduleSlot).values({
    organizationId: tenant.orgId,
    offeringId: offering!.id,
    courseId: course!.id,
    classroomId,
    dayOfWeek: 0,
    startTime: "07:00",
    endTime: "08:00",
    academicYear: "2026",
  });
};

const classroomInput = (campusId: string, values: Record<string, unknown> = {}) => ({
  campusId,
  name: "Aula 101",
  code: "A-101",
  capacity: 30,
  floor: 1,
  classroomType: "aula" as const,
  ...values,
});

const listFilter = (
  id: "name" | "campusId" | "type" | (string & {}),
  variant: "text" | "select",
  operator: "eq" | "iLike",
  value: string,
) => ({ id: id as "name", variant, operator, value });

await sigeSuite("classroom router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let audit: RecordingAuditLogger;

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Salones", ["owner", "coordinator", "teacher"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
  });

  test("create returns the row with the campus name; one audit event", async () => {
    const campus = await seedCampus(fx, tenant, { name: "Norte" });
    audit.reset();
    const created = await call(
      classroomRouter.create,
      classroomInput(campus.id, {
        name: " Laboratorio 1 ",
        code: "LAB-1",
        classroomType: "laboratorio",
        building: "B",
        floor: 2,
        resources: { proyector: true, computadoras: 30 },
      }),
      { context: owner },
    );
    expect(created).toMatchObject({
      name: "Laboratorio 1",
      code: "LAB-1",
      campusId: campus.id,
      campusName: "Norte",
      capacity: 30,
      floor: 2,
      building: "B",
      classroomType: "laboratorio",
      resources: { proyector: true, computadoras: 30 },
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "classroom.created",
      targetType: "classroom",
      targetId: created.id,
      organizationId: tenant.orgId,
    });
  });

  test("create defaults capacity 40, floor 1 and no resources", async () => {
    const campus = await seedCampus(fx, tenant);
    const { capacity: _c, floor: _f, ...rest } = classroomInput(campus.id, { code: "DEF" });
    const created = await call(classroomRouter.create, rest as never, { context: owner });
    expect(created).toMatchObject({ capacity: 40, floor: 1, building: null, resources: null });
  });

  test("create on a missing campus is NOT_FOUND", async () => {
    const error = await errorOf(
      call(classroomRouter.create, classroomInput("nope"), { context: owner }),
    );
    expect(error?.code).toBe("NOT_FOUND");
  });

  test("SCH-R12: an inactive campus is rejected on create and update, but kept when unchanged", async () => {
    const inactive = await seedCampus(fx, tenant, { active: false });
    const active = await seedCampus(fx, tenant);
    const created = await errorOf(
      call(classroomRouter.create, classroomInput(inactive.id), { context: owner }),
    );
    expect(created?.code).toBe("BAD_REQUEST");
    expect(created?.message).toBe("La sede seleccionada no está activa.");
    const room = await seedClassroom(fx, tenant, active.id, { name: "Mover", code: "MV" });
    const moved = await errorOf(
      call(
        classroomRouter.update,
        { id: room.id, ...classroomInput(inactive.id, { name: "Mover", code: "MV" }) },
        { context: owner },
      ),
    );
    expect(moved?.message).toBe("La sede seleccionada no está activa.");
    // A classroom whose campus was deactivated later can still be edited without moving it.
    const stay = await seedClassroom(fx, tenant, inactive.id, { name: "Queda", code: "ST" });
    const edited = await call(
      classroomRouter.update,
      { id: stay.id, ...classroomInput(inactive.id, { name: "Queda 2", code: "ST" }) },
      { context: owner },
    );
    expect(edited.name).toBe("Queda 2");
  });

  test("code is unique per campus, case-insensitively, with the spec message", async () => {
    const campus = await seedCampus(fx, tenant);
    await seedClassroom(fx, tenant, campus.id, { code: "ab-1" });
    const error = await errorOf(
      call(classroomRouter.create, classroomInput(campus.id, { code: "AB-1" }), {
        context: owner,
      }),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("Ya existe un salón con este código en la sede.");
    const other = await seedCampus(fx, tenant);
    const ok = await call(classroomRouter.create, classroomInput(other.id, { code: "AB-1" }), {
      context: owner,
    });
    expect(ok.code).toBe("AB-1");
  });

  test("validation messages: capacity, floor and resources", async () => {
    const campus = await seedCampus(fx, tenant);
    const capacity = await errorOf(
      call(classroomRouter.create, classroomInput(campus.id, { capacity: 5 }), {
        context: owner,
      }),
    );
    expect(JSON.stringify(capacity?.data)).toContain("La capacidad debe estar entre 10 y 100.");
    const floor = await errorOf(
      call(classroomRouter.create, classroomInput(campus.id, { floor: 0 }), { context: owner }),
    );
    expect(JSON.stringify(floor?.data)).toContain("El piso debe ser 1 o mayor.");
    const resources = await errorOf(
      call(classroomRouter.create, classroomInput(campus.id, { resources: [1, 2] }), {
        context: owner,
      }),
    );
    expect(JSON.stringify(resources?.data)).toContain("El formato JSON no es válido.");
  });

  test("update changes fields and audits the changed ones only", async () => {
    const campus = await seedCampus(fx, tenant);
    const room = await seedClassroom(fx, tenant, campus.id, {
      name: "Viejo",
      code: "UPD",
      capacity: 30,
    });
    audit.reset();
    const updated = await call(
      classroomRouter.update,
      { id: room.id, ...classroomInput(campus.id, { name: "Nuevo", code: "UPD", capacity: 30 }) },
      { context: owner },
    );
    expect(updated.name).toBe("Nuevo");
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("classroom.updated");
    const metadata = audit.events[0]?.metadata as { changes: unknown };
    expect(metadata.changes).toEqual({ name: { from: "Viejo", to: "Nuevo" } });
  });

  test("the campus is immutable once the classroom has slots", async () => {
    const a = await seedCampus(fx, tenant);
    const b = await seedCampus(fx, tenant);
    const free = await seedClassroom(fx, tenant, a.id, { name: "Libre", code: "FREE" });
    const moved = await call(
      classroomRouter.update,
      { id: free.id, ...classroomInput(b.id, { name: "Libre", code: "FREE" }) },
      { context: owner },
    );
    expect(moved.campusId).toBe(b.id);

    const used = await seedClassroom(fx, tenant, a.id, { name: "Usado", code: "USED" });
    await seedSlot(fx, tenant, a.id, used.id);
    audit.reset();
    const error = await errorOf(
      call(
        classroomRouter.update,
        { id: used.id, ...classroomInput(b.id, { name: "Usado", code: "USED" }) },
        { context: owner },
      ),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("No se puede cambiar la sede de un salón con clases programadas.");
    expect(audit.events).toHaveLength(0);
    // Other fields stay editable.
    const renamed = await call(
      classroomRouter.update,
      { id: used.id, ...classroomInput(a.id, { name: "Usado 2", code: "USED" }) },
      { context: owner },
    );
    expect(renamed.name).toBe("Usado 2");
  });

  test("update/delete/get of a missing id is NOT_FOUND", async () => {
    const campus = await seedCampus(fx, tenant);
    for (const run of [
      () =>
        call(
          classroomRouter.update,
          { id: "nope", ...classroomInput(campus.id) },
          { context: owner },
        ),
      () => call(classroomRouter.get, { id: "nope" }, { context: owner }),
      () => call(classroomRouter.delete, { id: "nope" }, { context: owner }),
    ]) {
      expect((await errorOf(run()))?.code).toBe("NOT_FOUND");
    }
  });

  test("update/delete lose a race to a concurrent delete: NOT_FOUND and no audit", async () => {
    for (const op of ["update", "delete"] as const) {
      const campus = await seedCampus(fx, tenant);
      const room = await seedClassroom(fx, tenant, campus.id);
      // `update` locks its row inside a transaction, so the rival delete must land before it opens.
      const racing = {
        ...owner,
        db: racingDb(
          fx.db,
          async () => {
            await fx.db.delete(schema.classroom).where(eq(schema.classroom.id, room.id));
          },
          op === "update" ? "transaction" : "write",
        ),
      } as Context;
      audit.reset();
      const run =
        op === "update"
          ? call(
              classroomRouter.update,
              { id: room.id, ...classroomInput(campus.id, { name: room.name, code: room.code }) },
              { context: racing },
            )
          : call(classroomRouter.delete, { id: room.id }, { context: racing });
      expect((await errorOf(run))?.code).toBe("NOT_FOUND");
      expect(audit.events).toHaveLength(0);
    }
  });

  test("delete removes the classroom and snapshots it", async () => {
    const campus = await seedCampus(fx, tenant);
    const room = await seedClassroom(fx, tenant, campus.id, { name: "Borrable", code: "DEL" });
    audit.reset();
    expect(await call(classroomRouter.delete, { id: room.id }, { context: owner })).toEqual({
      deleted: true,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "classroom.deleted",
      metadata: { snapshot: { name: "Borrable", code: "DEL" } },
    });
  });

  test("delete is refused while slots exist (HAS_DEPENDENTS) and audits nothing", async () => {
    const campus = await seedCampus(fx, tenant);
    const room = await seedClassroom(fx, tenant, campus.id);
    await seedSlot(fx, tenant, campus.id, room.id);
    audit.reset();
    const error = await errorOf(call(classroomRouter.delete, { id: room.id }, { context: owner }));
    expect(error?.code).toBe("HAS_DEPENDENTS");
    expect(error?.message).toBe("El salón tiene clases programadas en el horario.");
    expect(audit.events).toHaveLength(0);
    expect(
      await fx.db.select().from(schema.classroom).where(eq(schema.classroom.id, room.id)),
    ).toHaveLength(1);
  });

  test("list pages, sorts, filters and counts; total ignores paging", async () => {
    const t = await fx.provisionTenant("ListaSalones", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const zeta = await seedCampus(fx, t, { name: "Zeta" });
    const alfa = await seedCampus(fx, t, { name: "Alfa" });
    await seedClassroom(fx, t, zeta.id, { name: "B", code: "B", capacity: 20 });
    await seedClassroom(fx, t, alfa.id, {
      name: "A",
      code: "C",
      capacity: 50,
      classroomType: "laboratorio",
    });
    await seedClassroom(fx, t, alfa.id, {
      name: "C",
      code: "A",
      capacity: 35,
      classroomType: "cancha",
    });

    const all = await call(classroomRouter.list, {}, { context: ctx });
    expect(all.total).toBe(3);
    expect(all.rows.map((r) => r.name)).toEqual(["A", "B", "C"]);

    const byCode = await call(
      classroomRouter.list,
      { sort: [{ id: "code", desc: false }] },
      { context: ctx },
    );
    expect(byCode.rows.map((r) => r.code)).toEqual(["A", "B", "C"]);
    const byCampus = await call(
      classroomRouter.list,
      {
        sort: [
          { id: "campus", desc: false },
          { id: "name", desc: true },
        ],
      },
      { context: ctx },
    );
    expect(byCampus.rows.map((r) => r.name)).toEqual(["C", "A", "B"]);
    const byCapacity = await call(
      classroomRouter.list,
      { sort: [{ id: "capacity", desc: true }] },
      { context: ctx },
    );
    expect(byCapacity.rows.map((r) => r.name)).toEqual(["A", "C", "B"]);
    const byType = await call(
      classroomRouter.list,
      { sort: [{ id: "type", desc: false }] },
      { context: ctx },
    );
    expect(byType.total).toBe(3);

    const paged = await call(classroomRouter.list, { page: 2, perPage: 2 }, { context: ctx });
    expect(paged.total).toBe(3);
    expect(paged.rows.map((r) => r.name)).toEqual(["C"]);

    const filtered = await call(
      classroomRouter.list,
      {
        filters: [
          listFilter("campusId", "select", "eq", alfa.id),
          listFilter("name", "text", "iLike", "a"),
        ],
      },
      { context: ctx },
    );
    expect(filtered.rows.map((r) => r.name)).toEqual(["A"]);
    expect(filtered.rows[0]).toMatchObject({ campusName: "Alfa" });
    const byTypeFilter = await call(
      classroomRouter.list,
      { filters: [listFilter("type", "select", "eq", "cancha")] },
      { context: ctx },
    );
    expect(byTypeFilter.rows.map((r) => r.name)).toEqual(["C"]);
  });

  test("list rejects columns outside the allowlists", async () => {
    const sort = await errorOf(
      call(classroomRouter.list, { sort: [{ id: "organizationId", desc: false }] } as never, {
        context: owner,
      }),
    );
    expect(sort?.code).toBe("BAD_REQUEST");
    const filter = await errorOf(
      call(
        classroomRouter.list,
        { filters: [listFilter("organizationId", "text", "eq", "x")] } as never,
        { context: owner },
      ),
    );
    expect(filter?.code).toBe("BAD_REQUEST");
  });

  test("stats counts total, aulas and laboratorios", async () => {
    const t = await fx.provisionTenant("StatsSalones", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    expect(await call(classroomRouter.stats, undefined, { context: ctx })).toEqual({
      total: 0,
      aulas: 0,
      laboratorios: 0,
    });
    const campus = await seedCampus(fx, t);
    await seedClassroom(fx, t, campus.id);
    await seedClassroom(fx, t, campus.id);
    await seedClassroom(fx, t, campus.id, { classroomType: "laboratorio" });
    await seedClassroom(fx, t, campus.id, { classroomType: "cancha" });
    expect(await call(classroomRouter.stats, undefined, { context: ctx })).toEqual({
      total: 4,
      aulas: 2,
      laboratorios: 1,
    });
  });
});

await testPermissionMatrix({
  name: "classroom",
  procedures: [
    {
      name: "classroom.list",
      permissions: { classroom: ["read"] },
      run: (context) => call(classroomRouter.list, {}, { context }),
    },
    {
      name: "classroom.stats",
      permissions: { classroom: ["read"] },
      run: (context) => call(classroomRouter.stats, undefined, { context }),
    },
    {
      name: "classroom.get",
      permissions: { classroom: ["read"] },
      run: (context) => call(classroomRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "classroom.create",
      permissions: { classroom: ["create"] },
      run: (context) => call(classroomRouter.create, classroomInput("missing"), { context }),
    },
    {
      name: "classroom.update",
      permissions: { classroom: ["update"] },
      run: (context) =>
        call(classroomRouter.update, { id: "missing", ...classroomInput("missing") }, { context }),
    },
    {
      name: "classroom.delete",
      permissions: { classroom: ["delete"] },
      run: (context) => call(classroomRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = { campusId: string; classroomId: string; classroomName: string };
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const room = await seedClassroom(fx, tenant, campus.id);
  return { campusId: campus.id, classroomId: room.id, classroomName: room.name };
};
const untouched = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.classroom)
    .where(eq(schema.classroom.id, foreign.classroomId));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe(foreign.classroomName);
};

await testTenantIsolation({
  name: "classroom",
  cases: [
    isolationCase({
      name: "classroom.list never returns the other tenant's classrooms",
      seed,
      run: ({ context }) => call(classroomRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.classroomId, foreign.classroomName, foreign.campusId],
    }),
    isolationCase({
      name: "classroom.list filtered by a foreign campus returns nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          classroomRouter.list,
          { filters: [listFilter("campusId", "select", "eq", foreign.campusId)] },
          { context },
        ),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.classroomId, foreign.classroomName],
    }),
    isolationCase({
      name: "classroom.stats never counts the other tenant's classrooms",
      seed,
      run: ({ context }) => call(classroomRouter.stats, undefined, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.classroomId],
    }),
    isolationCase({
      name: "classroom.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(classroomRouter.get, { id: foreign.classroomId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "classroom.create under a foreign campus is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(classroomRouter.create, classroomInput(foreign.campusId, { code: "X" }), { context }),
      expectation: "notFound",
      verifyForeignUnchanged: async (foreign, fx) => {
        const rows = await fx.db
          .select()
          .from(schema.classroom)
          .where(eq(schema.classroom.campusId, foreign.campusId));
        expect(rows).toHaveLength(1);
      },
    }),
    isolationCase({
      name: "classroom.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          classroomRouter.update,
          { id: foreign.classroomId, ...classroomInput(foreign.campusId, { name: "Hackeado" }) },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
    isolationCase({
      name: "classroom.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(classroomRouter.delete, { id: foreign.classroomId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
  ],
});

import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import type { Context } from "../../context";
import {
  isolationCase,
  racingDb,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { SigeTestFixture, TestTenant } from "../../sige/testing";
import { courseRouter } from "./course";

/** `course.*` (sige/02 INS-11/12, §3.3, §4): server list, CRUD, level-in-campus, audit. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const seedCampus = async (fx: SigeTestFixture, tenant: TestTenant, name?: string) => {
  const [row] = await fx.db
    .insert(schema.campus)
    .values({ organizationId: tenant.orgId, name: name ?? `Sede ${crypto.randomUUID()}` })
    .returning();
  return row!;
};

const seedLevel = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  name?: string,
) => {
  const [row] = await fx.db
    .insert(schema.gradeLevel)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: name ?? `Nivel ${crypto.randomUUID()}`,
    })
    .returning();
  return row!;
};

const seedCourse = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  values: Partial<typeof schema.course.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.course)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: `Curso ${crypto.randomUUID().slice(0, 8)}`,
      academicYear: "2026",
      shift: "Mañana",
      ...values,
    })
    .returning();
  return row!;
};

const courseInput = (campusId: string, values: Record<string, unknown> = {}) => ({
  campusId,
  name: "6-1",
  academicYear: "2026",
  shift: "Mañana" as const,
  maxStudents: 40,
  ...values,
});

const listFilter = (
  id: "name" | "campusId" | "levelId" | "shift" | "academicYear" | (string & {}),
  variant: "text" | "select",
  operator: "eq" | "iLike",
  value: string,
) => ({ id: id as "name", variant, operator, value });

await sigeSuite("course router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let coordinator: Context;
  let audit: RecordingAuditLogger;

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Cursos", ["owner", "coordinator", "teacher"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    coordinator = await fx.contextFor(tenant.people.coordinator!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
  });

  test("create returns the row with campus and level names; one audit event", async () => {
    const campus = await seedCampus(fx, tenant, "Norte");
    const level = await seedLevel(fx, tenant, campus.id, "Primaria");
    audit.reset();
    const created = await call(
      courseRouter.create,
      courseInput(campus.id, { name: " 6-1 ", levelId: level.id, maxStudents: 35 }),
      { context: owner },
    );
    expect(created).toMatchObject({
      name: "6-1",
      campusId: campus.id,
      campusName: "Norte",
      levelId: level.id,
      levelName: "Primaria",
      directorPersonId: null,
      directorName: null,
      academicYear: "2026",
      shift: "Mañana",
      maxStudents: 35,
      studentCount: 0,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "course.created",
      targetType: "course",
      targetId: created.id,
      organizationId: tenant.orgId,
    });
  });

  test("create defaults the capacity to 40 and the level to none", async () => {
    const campus = await seedCampus(fx, tenant);
    const { maxStudents: _omit, ...rest } = courseInput(campus.id, { name: "Transición A" });
    const created = await call(courseRouter.create, rest as never, { context: owner });
    expect(created).toMatchObject({ maxStudents: 40, levelId: null, levelName: null });
  });

  test("create on a missing campus is NOT_FOUND", async () => {
    const error = await errorOf(call(courseRouter.create, courseInput("nope"), { context: owner }));
    expect(error?.code).toBe("NOT_FOUND");
  });

  test("a level of another campus is rejected with the spec message", async () => {
    const a = await seedCampus(fx, tenant);
    const b = await seedCampus(fx, tenant);
    const levelOfA = await seedLevel(fx, tenant, a.id);
    const error = await errorOf(
      call(courseRouter.create, courseInput(b.id, { levelId: levelOfA.id }), { context: owner }),
    );
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("El nivel no pertenece a la sede seleccionada.");
    const none = await fx.db.select().from(schema.course).where(eq(schema.course.campusId, b.id));
    expect(none).toHaveLength(0);
  });

  test("update to a level of another campus is rejected and leaves the row intact", async () => {
    const a = await seedCampus(fx, tenant);
    const b = await seedCampus(fx, tenant);
    const levelOfB = await seedLevel(fx, tenant, b.id);
    const course = await seedCourse(fx, tenant, a.id, { name: "Intacto" });
    const error = await errorOf(
      call(
        courseRouter.update,
        { id: course.id, ...courseInput(a.id, { name: "Intacto", levelId: levelOfB.id }) },
        { context: owner },
      ),
    );
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("El nivel no pertenece a la sede seleccionada.");
  });

  test("uniqueness (campus, name, year, shift) is a CONFLICT with the spec message", async () => {
    const campus = await seedCampus(fx, tenant);
    await seedCourse(fx, tenant, campus.id, { name: "7-1" });
    const error = await errorOf(
      call(courseRouter.create, courseInput(campus.id, { name: "7-1" }), { context: owner }),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("Ya existe un grado con la misma sede, nombre, año y jornada.");
    const otherShift = await call(
      courseRouter.create,
      courseInput(campus.id, { name: "7-1", shift: "Tarde" }),
      { context: owner },
    );
    expect(otherShift.shift).toBe("Tarde");
  });

  test("validation messages: empty name and capacity out of range", async () => {
    const campus = await seedCampus(fx, tenant);
    const empty = await errorOf(
      call(courseRouter.create, courseInput(campus.id, { name: "  " }), { context: owner }),
    );
    expect(JSON.stringify(empty?.data)).toContain("El nombre del grado es obligatorio.");
    for (const maxStudents of [0, 61]) {
      const error = await errorOf(
        call(courseRouter.create, courseInput(campus.id, { maxStudents }), { context: owner }),
      );
      expect(JSON.stringify(error?.data)).toContain("La capacidad debe estar entre 1 y 60.");
    }
  });

  test("update changes fields, audits changed fields only", async () => {
    const campus = await seedCampus(fx, tenant);
    const course = await seedCourse(fx, tenant, campus.id, { name: "Viejo", maxStudents: 30 });
    audit.reset();
    const updated = await call(
      courseRouter.update,
      { id: course.id, ...courseInput(campus.id, { name: "Nuevo", maxStudents: 30 }) },
      { context: owner },
    );
    expect(updated.name).toBe("Nuevo");
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("course.updated");
    const metadata = audit.events[0]?.metadata as { changes: unknown };
    expect(metadata.changes).toEqual({ name: { from: "Viejo", to: "Nuevo" } });
  });

  test("update records a director change as { director: { from, to } } (OD-21)", async () => {
    const campus = await seedCampus(fx, tenant);
    const course = await seedCourse(fx, tenant, campus.id, { name: "Dir" });
    const teacher = tenant.people.teacher!;
    audit.reset();
    const updated = await call(
      courseRouter.update,
      {
        id: course.id,
        ...courseInput(campus.id, { name: "Dir", directorPersonId: teacher.personId }),
      },
      { context: owner },
    );
    expect(updated.directorPersonId).toBe(teacher.personId);
    expect(updated.directorName).toContain(`${teacher.role}`);
    const metadata = audit.events[0]?.metadata as { changes: Record<string, unknown> };
    expect(metadata.changes).toEqual({
      director: { from: null, to: teacher.personId },
    });
  });

  describe("director must be an active teacher of the institution (D9, sige/02 §4)", () => {
    const DIRECTOR_MESSAGE = "El director debe ser un profesor activo de la institución.";
    let staff: TestTenant;
    let admin: Context;
    let campusId: string;

    test("provisions staff, a foreign teacher and a campus", async () => {
      staff = await fx.provisionTenant("Directores", ["owner", "coordinator", "teacher", "parent"]);
      admin = await fx.contextFor(staff.people.owner!, staff);
      campusId = (await seedCampus(fx, staff)).id;
    });

    const rejectsAsDirector = async (directorPersonId: string) => {
      const created = await errorOf(
        call(courseRouter.create, courseInput(campusId, { name: "Rechazado", directorPersonId }), {
          context: admin,
        }),
      );
      expect(created?.code).toBe("BAD_REQUEST");
      expect(created?.message).toBe(DIRECTOR_MESSAGE);
      const rows = await fx.db
        .select()
        .from(schema.course)
        .where(eq(schema.course.campusId, campusId));
      expect(rows.filter((row) => row.name === "Rechazado")).toHaveLength(0);

      const course = await seedCourse(fx, staff, campusId);
      const updated = await errorOf(
        call(
          courseRouter.update,
          { id: course.id, ...courseInput(campusId, { name: course.name, directorPersonId }) },
          { context: admin },
        ),
      );
      expect(updated?.code).toBe("BAD_REQUEST");
      expect(updated?.message).toBe(DIRECTOR_MESSAGE);
      const [after] = await fx.db
        .select()
        .from(schema.course)
        .where(eq(schema.course.id, course.id));
      expect(after?.directorPersonId).toBeNull();
    };

    test("accepts an active teacher of the same institution", async () => {
      const created = await call(
        courseRouter.create,
        courseInput(campusId, {
          name: "Con director",
          directorPersonId: staff.people.teacher!.personId,
        }),
        { context: admin },
      );
      expect(created.directorPersonId).toBe(staff.people.teacher!.personId);
    });

    test("rejects a person who is not a teacher", async () => {
      await rejectsAsDirector(staff.people.coordinator!.personId);
      await rejectsAsDirector(staff.people.parent!.personId);
    });

    test("rejects an unknown person id", async () => {
      await rejectsAsDirector("nope");
    });

    test("rejects a teacher of another institution exactly like an unknown id (no leak)", async () => {
      const other = await fx.provisionTenant("Ajeno", ["teacher"]);
      await rejectsAsDirector(other.people.teacher!.personId);
    });

    test("rejects a deactivated teacher", async () => {
      const inactive = await fx.provisionTenant("Inactivo", ["owner", "teacher"]);
      const ctx = await fx.contextFor(inactive.people.owner!, inactive);
      const campus = await seedCampus(fx, inactive);
      await fx.db
        .update(schema.person)
        .set({ isActive: false })
        .where(eq(schema.person.id, inactive.people.teacher!.personId));
      const error = await errorOf(
        call(
          courseRouter.create,
          courseInput(campus.id, { directorPersonId: inactive.people.teacher!.personId }),
          { context: ctx },
        ),
      );
      expect(error?.code).toBe("BAD_REQUEST");
      expect(error?.message).toBe(DIRECTOR_MESSAGE);
    });

    test("update keeps a director who was deactivated after being assigned", async () => {
      const t = await fx.provisionTenant("Conserva", ["owner", "teacher"]);
      const ctx = await fx.contextFor(t.people.owner!, t);
      const campus = await seedCampus(fx, t);
      const course = await seedCourse(fx, t, campus.id, {
        name: "Antes",
        directorPersonId: t.people.teacher!.personId,
      });
      await fx.db
        .update(schema.person)
        .set({ isActive: false })
        .where(eq(schema.person.id, t.people.teacher!.personId));
      const updated = await call(
        courseRouter.update,
        {
          id: course.id,
          ...courseInput(campus.id, {
            name: "Después",
            directorPersonId: t.people.teacher!.personId,
          }),
        },
        { context: ctx },
      );
      expect(updated).toMatchObject({
        name: "Después",
        directorPersonId: t.people.teacher!.personId,
      });
    });

    test("get exposes whether the director is active, from the person row", async () => {
      const t = await fx.provisionTenant("Activo", ["owner", "teacher"]);
      const ctx = await fx.contextFor(t.people.owner!, t);
      const campus = await seedCampus(fx, t);
      const without = await seedCourse(fx, t, campus.id, { name: "Sin" });
      const course = await seedCourse(fx, t, campus.id, {
        name: "Con",
        directorPersonId: t.people.teacher!.personId,
      });
      expect(
        (await call(courseRouter.get, { id: without.id }, { context: ctx })).directorActive,
      ).toBeNull();
      expect(
        (await call(courseRouter.get, { id: course.id }, { context: ctx })).directorActive,
      ).toBe(true);
      await fx.db
        .update(schema.person)
        .set({ isActive: false })
        .where(eq(schema.person.id, t.people.teacher!.personId));
      expect(
        (await call(courseRouter.get, { id: course.id }, { context: ctx })).directorActive,
      ).toBe(false);
    });

    test("get reports a director who lost the teacher role as not active", async () => {
      const t = await fx.provisionTenant("SinRol", ["owner", "teacher"]);
      const ctx = await fx.contextFor(t.people.owner!, t);
      const campus = await seedCampus(fx, t);
      const course = await seedCourse(fx, t, campus.id, {
        directorPersonId: t.people.teacher!.personId,
      });
      expect(
        (await call(courseRouter.get, { id: course.id }, { context: ctx })).directorActive,
      ).toBe(true);
      await fx.db
        .update(schema.member)
        .set({ role: "admin" })
        .where(
          and(
            eq(schema.member.organizationId, t.orgId),
            eq(schema.member.userId, t.people.teacher!.userId),
          ),
        );
      expect(
        (await call(courseRouter.get, { id: course.id }, { context: ctx })).directorActive,
      ).toBe(false);
    });

    test("update can still clear the director", async () => {
      const course = await seedCourse(fx, staff, campusId, {
        directorPersonId: staff.people.teacher!.personId,
      });
      const updated = await call(
        courseRouter.update,
        { id: course.id, ...courseInput(campusId, { name: course.name }) },
        { context: admin },
      );
      expect(updated.directorPersonId).toBeNull();
    });
  });

  test("update/delete of a missing id is NOT_FOUND", async () => {
    const campus = await seedCampus(fx, tenant);
    expect(
      (
        await errorOf(
          call(courseRouter.update, { id: "nope", ...courseInput(campus.id) }, { context: owner }),
        )
      )?.code,
    ).toBe("NOT_FOUND");
    expect((await errorOf(call(courseRouter.get, { id: "nope" }, { context: owner })))?.code).toBe(
      "NOT_FOUND",
    );
    expect(
      (await errorOf(call(courseRouter.delete, { id: "nope" }, { context: owner })))?.code,
    ).toBe("NOT_FOUND");
  });

  test("update/delete lose a race to a concurrent delete: NOT_FOUND and no audit", async () => {
    for (const op of ["update", "delete"] as const) {
      const campus = await seedCampus(fx, tenant);
      const course = await seedCourse(fx, tenant, campus.id);
      const racing = {
        ...owner,
        db: racingDb(fx.db, async () => {
          await fx.db.delete(schema.course).where(eq(schema.course.id, course.id));
        }),
      } as Context;
      audit.reset();
      const run =
        op === "update"
          ? call(
              courseRouter.update,
              { id: course.id, ...courseInput(campus.id, { name: course.name }) },
              { context: racing },
            )
          : call(courseRouter.delete, { id: course.id }, { context: racing });
      expect((await errorOf(run))?.code).toBe("NOT_FOUND");
      expect(audit.events).toHaveLength(0);
    }
  });

  test("delete removes the course and snapshots its name", async () => {
    const campus = await seedCampus(fx, tenant);
    const course = await seedCourse(fx, tenant, campus.id, { name: "Borrable" });
    audit.reset();
    expect(await call(courseRouter.delete, { id: course.id }, { context: owner })).toEqual({
      deleted: true,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "course.deleted",
      metadata: { snapshot: { name: "Borrable" } },
    });
  });

  test("get returns the row", async () => {
    const campus = await seedCampus(fx, tenant, "GetSede");
    const course = await seedCourse(fx, tenant, campus.id, { name: "Get" });
    expect(await call(courseRouter.get, { id: course.id }, { context: owner })).toMatchObject({
      id: course.id,
      campusName: "GetSede",
    });
  });

  test("list pages, sorts, filters and counts; total ignores paging", async () => {
    const t = await fx.provisionTenant("Lista", ["owner", "teacher"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const zeta = await seedCampus(fx, t, "Zeta");
    const alfa = await seedCampus(fx, t, "Alfa");
    const lvl = await seedLevel(fx, t, alfa.id, "Media");
    await seedCourse(fx, t, zeta.id, { name: "B", academicYear: "2025", shift: "Tarde" });
    await seedCourse(fx, t, alfa.id, { name: "A", levelId: lvl.id, maxStudents: 20 });
    await seedCourse(fx, t, alfa.id, {
      name: "C",
      directorPersonId: t.people.teacher!.personId,
      maxStudents: 50,
    });

    const all = await call(courseRouter.list, {}, { context: ctx });
    expect(all.total).toBe(3);
    expect(all.rows.map((r) => r.name)).toEqual(["A", "B", "C"]);

    const byCampus = await call(
      courseRouter.list,
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
      courseRouter.list,
      { sort: [{ id: "maxStudents", desc: true }] },
      { context: ctx },
    );
    expect(byCapacity.rows.map((r) => r.name)).toEqual(["C", "B", "A"]);

    const paged = await call(courseRouter.list, { page: 2, perPage: 2 }, { context: ctx });
    expect(paged.total).toBe(3);
    expect(paged.rows.map((r) => r.name)).toEqual(["C"]);

    const filtered = await call(
      courseRouter.list,
      {
        filters: [
          listFilter("campusId", "select", "eq", alfa.id),
          listFilter("name", "text", "iLike", "a"),
        ],
      },
      { context: ctx },
    );
    expect(filtered.rows.map((r) => r.name)).toEqual(["A"]);
    expect(filtered.rows[0]).toMatchObject({ levelName: "Media", campusName: "Alfa" });

    const byShift = await call(
      courseRouter.list,
      { filters: [listFilter("shift", "select", "eq", "Tarde")] },
      { context: ctx },
    );
    expect(byShift.rows.map((r) => r.name)).toEqual(["B"]);
    const byYear = await call(
      courseRouter.list,
      { filters: [listFilter("academicYear", "select", "eq", "2025")] },
      { context: ctx },
    );
    expect(byYear.rows.map((r) => r.name)).toEqual(["B"]);
    const byLevel = await call(
      courseRouter.list,
      { filters: [listFilter("levelId", "select", "eq", lvl.id)] },
      { context: ctx },
    );
    expect(byLevel.rows.map((r) => r.name)).toEqual(["A"]);

    const byDirector = await call(
      courseRouter.list,
      {
        sort: [
          { id: "director", desc: false },
          { id: "studentCount", desc: false },
        ],
      },
      { context: ctx },
    );
    expect(byDirector.total).toBe(3);
    const withDirector = byDirector.rows.find((r) => r.name === "C");
    expect(withDirector?.directorName).toContain("teacher");
  });

  test("list rejects columns outside the allowlists", async () => {
    const sort = await errorOf(
      call(courseRouter.list, { sort: [{ id: "organizationId", desc: false }] } as never, {
        context: owner,
      }),
    );
    expect(sort?.code).toBe("BAD_REQUEST");
    const filter = await errorOf(
      call(
        courseRouter.list,
        { filters: [listFilter("organizationId", "text", "eq", "x")] } as never,
        { context: owner },
      ),
    );
    expect(filter?.code).toBe("BAD_REQUEST");
  });

  test("stats counts courses, distinct campuses with courses and courses with a director", async () => {
    const t = await fx.provisionTenant("Stats", ["owner", "teacher"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    expect(await call(courseRouter.stats, undefined, { context: ctx })).toEqual({
      total: 0,
      campusesWithCourses: 0,
      withDirector: 0,
    });
    const a = await seedCampus(fx, t);
    const b = await seedCampus(fx, t);
    await seedCampus(fx, t);
    await seedCourse(fx, t, a.id);
    await seedCourse(fx, t, a.id, { directorPersonId: t.people.teacher!.personId });
    await seedCourse(fx, t, b.id);
    expect(await call(courseRouter.stats, undefined, { context: ctx })).toEqual({
      total: 3,
      campusesWithCourses: 2,
      withDirector: 1,
    });
  });

  test("options filters by campus and year, ordered, with the select fields only", async () => {
    const t = await fx.provisionTenant("Opciones", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const a = await seedCampus(fx, t);
    const b = await seedCampus(fx, t);
    const c1 = await seedCourse(fx, t, a.id, { name: "B", academicYear: "2026" });
    const c2 = await seedCourse(fx, t, a.id, { name: "A", academicYear: "2026" });
    await seedCourse(fx, t, a.id, { name: "Z", academicYear: "2025" });
    await seedCourse(fx, t, b.id, { name: "Y", academicYear: "2026" });
    const options = await call(
      courseRouter.options,
      { campusId: a.id, academicYear: "2026" },
      { context: ctx },
    );
    expect(options).toEqual([
      { id: c2.id, name: "A", campusId: a.id, shift: "Mañana", academicYear: "2026" },
      { id: c1.id, name: "B", campusId: a.id, shift: "Mañana", academicYear: "2026" },
    ]);
    expect(await call(courseRouter.options, {}, { context: ctx })).toHaveLength(4);
  });

  test("the coordinator reads but cannot create", async () => {
    expect((await call(courseRouter.list, {}, { context: coordinator })).rows).toBeArray();
    const campus = await seedCampus(fx, tenant);
    const error = await errorOf(
      call(courseRouter.create, courseInput(campus.id), { context: coordinator }),
    );
    expect(error?.code).toBe("FORBIDDEN");
  });
});

await testPermissionMatrix({
  name: "course",
  procedures: [
    {
      name: "course.list",
      permissions: { course: ["read"] },
      run: (context) => call(courseRouter.list, {}, { context }),
    },
    {
      name: "course.stats",
      permissions: { course: ["read"] },
      run: (context) => call(courseRouter.stats, undefined, { context }),
    },
    {
      name: "course.options",
      permissions: { course: ["read"] },
      run: (context) => call(courseRouter.options, {}, { context }),
    },
    {
      name: "course.get",
      permissions: { course: ["read"] },
      run: (context) => call(courseRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "course.create",
      permissions: { course: ["create"] },
      run: (context) => call(courseRouter.create, courseInput("missing"), { context }),
    },
    {
      name: "course.update",
      permissions: { course: ["update"] },
      run: (context) =>
        call(courseRouter.update, { id: "missing", ...courseInput("missing") }, { context }),
    },
    {
      name: "course.delete",
      permissions: { course: ["delete"] },
      run: (context) => call(courseRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = { campusId: string; levelId: string; courseId: string; courseName: string };
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const level = await seedLevel(fx, tenant, campus.id);
  const course = await seedCourse(fx, tenant, campus.id, { levelId: level.id });
  return {
    campusId: campus.id,
    levelId: level.id,
    courseId: course.id,
    courseName: course.name,
  };
};
const courseUntouched = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.course)
    .where(eq(schema.course.id, foreign.courseId));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe(foreign.courseName);
};

await testTenantIsolation({
  name: "course",
  cases: [
    isolationCase({
      name: "course.list never returns the other tenant's courses",
      seed,
      run: ({ context }) => call(courseRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.courseId, foreign.courseName, foreign.campusId],
    }),
    isolationCase({
      name: "course.list filtered by a foreign campus or level returns nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          courseRouter.list,
          {
            filters: [
              listFilter("campusId", "select", "eq", foreign.campusId),
              listFilter("levelId", "select", "eq", foreign.levelId),
            ],
            joinOperator: "or",
          },
          { context },
        ),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.courseId, foreign.courseName],
    }),
    isolationCase({
      name: "course.stats never counts the other tenant's courses",
      seed,
      run: ({ context }) => call(courseRouter.stats, undefined, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.courseId],
    }),
    isolationCase({
      name: "course.options never returns the other tenant's courses",
      seed,
      run: ({ context, foreign }) =>
        call(courseRouter.options, { campusId: foreign.campusId }, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.courseId, foreign.courseName],
    }),
    isolationCase({
      name: "course.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) => call(courseRouter.get, { id: foreign.courseId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "course.create under a foreign campus is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(courseRouter.create, courseInput(foreign.campusId, { name: "Intruso" }), { context }),
      expectation: "notFound",
      verifyForeignUnchanged: async (foreign, fx) => {
        const rows = await fx.db
          .select()
          .from(schema.course)
          .where(eq(schema.course.campusId, foreign.campusId));
        expect(rows).toHaveLength(1);
      },
    }),
    isolationCase({
      name: "course.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          courseRouter.update,
          { id: foreign.courseId, ...courseInput(foreign.campusId, { name: "Hackeado" }) },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: courseUntouched,
    }),
    isolationCase({
      name: "course.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(courseRouter.delete, { id: foreign.courseId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: courseUntouched,
    }),
  ],
});

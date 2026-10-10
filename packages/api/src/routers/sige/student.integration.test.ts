import { call, ORPCError } from "@orpc/server";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { and, eq, inArray } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import {
  isolationCase,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { SigeTestFixture, TestTenant } from "../../sige/testing";
import {
  seedCampus,
  seedCourse,
  seedOffering,
  seedStudent,
  seedSubject,
} from "../../sige/testing/scheduling-seed";
import { enrollmentRouter } from "./enrollment";
import { studentRouter } from "./student";
import { userRouter } from "./user";

/**
 * `student.*` (sige/05 §3.1, STU-01/02/03, STU-R1..R5, R7, R10): lists, detail, picker, the two
 * admission paths, edit and delete.
 */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const listFilter = (id: string, variant: "select" | "text", operator: string, value: string) =>
  ({ id, variant, operator, value }) as never;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let documentCounter = 0;
const nextDocument = () => {
  documentCounter += 1;
  return `7${String(Date.now() % 1_000_000).padStart(6, "0")}${String(documentCounter).padStart(3, "0")}`;
};

/**
 * Fault-injection seam: a database whose `insert`/`update` on `table` throws (also inside
 * transactions and savepoints), modelling a failure at that step of the admission.
 */
function faultingDb(db: Database, operation: "insert" | "update", table: unknown): Database {
  return new Proxy(db, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target) as unknown;
      if (prop === operation && typeof value === "function") {
        return (arg: unknown, ...rest: unknown[]) => {
          if (arg === table) {
            throw new Error(`injected ${operation} failure`);
          }
          return (value as Function).call(target, arg, ...rest);
        };
      }
      if (prop === "transaction" && typeof value === "function") {
        return (callback: (tx: Database) => unknown, ...rest: unknown[]) =>
          (value as Function).call(
            target,
            async (tx: Database) => {
              const wrapped = faultingDb(tx, operation, table);
              return callback(wrapped);
            },
            ...rest,
          );
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

await sigeSuite("student router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let coordinator: Context;
  let teacher: Context;
  let studentCaller: Context;
  let parent: Context;
  let audit: RecordingAuditLogger;
  let campusId: string;
  let otherCampusId: string;

  const courseWithOfferings = async (
    campus: string,
    subjects: number,
    values: Partial<typeof schema.course.$inferInsert> = {},
    teacherPersonId?: string,
  ) => {
    const course = await seedCourse(fx, tenant, campus, values);
    const offerings = [];
    for (let i = 0; i < subjects; i += 1) {
      const subject = await seedSubject(fx, tenant, { name: `Materia ${i} ${course.name}` });
      offerings.push(
        await seedOffering(
          fx,
          tenant,
          course.id,
          subject.id,
          teacherPersonId && i === 0 ? { personId: teacherPersonId } : undefined,
        ),
      );
    }
    return { course, offerings };
  };

  const newStudentInput = (values: Record<string, unknown> = {}) => ({
    firstName: "Laura",
    lastName: "Pérez",
    documentType: "TI" as const,
    documentNumber: nextDocument(),
    campusId,
    courseId: null as string | null,
    ...values,
  });

  const enrollmentsOf = (studentIds: string[]) =>
    fx.db.select().from(schema.enrollment).where(inArray(schema.enrollment.studentId, studentIds));

  const studentRow = async (id: string) =>
    (await fx.db.select().from(schema.student).where(eq(schema.student.id, id)))[0];

  const residueFor = async (documentNumber: string) => {
    const people = await fx.db
      .select()
      .from(schema.person)
      .where(
        and(
          eq(schema.person.organizationId, tenant.orgId),
          eq(schema.person.documentNumber, documentNumber),
        ),
      );
    const users = await fx.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.name, `Fallo ${documentNumber}`));
    return { people: people.length, users: users.length };
  };

  /** A student-role login without a profile (path B, USR-02). */
  const studentLogin = async (values: Record<string, unknown> = {}) => {
    const created = await call(
      userRouter.create,
      {
        firstName: "Sin",
        lastName: "Perfil",
        documentType: "TI",
        documentNumber: nextDocument(),
        role: "student",
        ...values,
      } as never,
      { context: owner },
    );
    return created.user as { personId: string; userId: string; username: string };
  };

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Estudiantes", [
      "owner",
      "coordinator",
      "teacher",
      "student",
      "parent",
    ]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    coordinator = await fx.contextFor(tenant.people.coordinator!, tenant);
    teacher = await fx.contextFor(tenant.people.teacher!, tenant);
    studentCaller = await fx.contextFor(tenant.people.student!, tenant);
    parent = await fx.contextFor(tenant.people.parent!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
    campusId = (await seedCampus(fx, tenant, { name: "Sede Principal" })).id;
    otherCampusId = (await seedCampus(fx, tenant, { name: "Sede Norte" })).id;
  });

  // --- Path A: student.create (STU-R2, STU-R3) -------------------------------------------

  test("create provisions the login, the profile and one enrollment per offering (path A)", async () => {
    const { course, offerings } = await courseWithOfferings(campusId, 2, { maxStudents: 30 });
    audit.reset();
    const input = newStudentInput({
      firstName: "Ana",
      lastName: "Gómez",
      courseId: course.id,
      phone: "3001234567",
      birthDate: "2015-04-02",
      gender: "F",
      address: "Calle 1",
      neighborhood: "El Centro",
      stratum: 2,
      bloodType: "O+",
      eps: "Sanitas",
      guardianName: "Marta Gómez",
      guardianPhone: "3100000000",
      guardianEmail: "marta@example.com",
    });
    const result = await call(studentRouter.create, input, { context: coordinator });

    expect(result.username).toBe(`agomez${input.documentNumber.slice(-4)}`);
    expect(result.enrolled).toEqual({ created: 2, overCapacity: false });
    expect(result.student).toMatchObject({
      name: "Ana Gómez",
      documentType: "TI",
      documentNumber: input.documentNumber,
      courseId: course.id,
      courseName: course.name,
      campusId,
      campusName: "Sede Principal",
      status: "activo",
      guardianName: "Marta Gómez",
      username: result.username,
      email: null,
      phone: "3001234567",
      birthDate: "2015-04-02",
      gender: "F",
      address: "Calle 1",
      neighborhood: "El Centro",
      stratum: 2,
      bloodType: "O+",
      eps: "Sanitas",
      guardianPhone: "3100000000",
      guardianEmail: "marta@example.com",
      // No institution profile: the current academic year falls back to the calendar year.
      enrolledYear: String(new Date().getFullYear()),
      guardians: [],
    });

    const [person] = await fx.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.id, result.student.personId));
    expect(person).toMatchObject({ mustChangePassword: true, hasRealEmail: false });
    const [member] = await fx.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, person!.userId));
    expect(member?.role).toBe("student");
    const rows = await enrollmentsOf([result.student.id]);
    expect(new Set(rows.map((row) => row.offeringId))).toEqual(
      new Set(offerings.map((offering) => offering.id)),
    );
    expect(rows.every((row) => row.status === "activa" && row.academicYear === "2026")).toBe(true);
    expect(rows.every((row) => row.academicYear === course.academicYear)).toBe(true);

    expect(audit.events.map((event) => event.action)).toEqual(["user.created", "student.created"]);
    expect(audit.events[1]).toMatchObject({
      targetType: "student",
      targetId: result.student.id,
      metadata: { mode: "create", enrolled: { created: 2, overCapacity: false } },
    });
    const changed = (audit.events[1]!.metadata as { changed: string[] }).changed;
    expect(changed).toEqual(expect.arrayContaining(["campusId", "courseId", "guardianName"]));
    expect(JSON.stringify(audit.events)).not.toContain(input.documentNumber);
  });

  test("create without a course stores no enrollments and returns enrolled null (STU-R3)", async () => {
    const result = await call(studentRouter.create, newStudentInput(), { context: owner });
    expect(result.enrolled).toBeNull();
    expect(result.student.courseId).toBeNull();
    expect(await enrollmentsOf([result.student.id])).toHaveLength(0);
  });

  test("create over capacity warns but admits; a course without offerings enrolls nothing", async () => {
    const { course } = await courseWithOfferings(campusId, 1, { maxStudents: 1 });
    await seedStudent(fx, tenant, campusId, { courseId: course.id });
    const over = await call(studentRouter.create, newStudentInput({ courseId: course.id }), {
      context: owner,
    });
    expect(over.enrolled).toEqual({ created: 1, overCapacity: true });
    expect((await studentRow(over.student.id))?.courseId).toBe(course.id);

    const empty = await seedCourse(fx, tenant, campusId);
    const none = await call(studentRouter.create, newStudentInput({ courseId: empty.id }), {
      context: owner,
    });
    expect(none.enrolled).toEqual({ created: 0, overCapacity: false });
    expect(none.student.courseId).toBe(empty.id);
  });

  test("create refuses a course of another campus, unknown or inactive campus, a taken document", async () => {
    const foreignCourse = await seedCourse(fx, tenant, otherCampusId);
    const mismatch = await errorOf(
      call(studentRouter.create, newStudentInput({ courseId: foreignCourse.id }), {
        context: owner,
      }),
    );
    expect(mismatch?.code).toBe("BAD_REQUEST");
    expect(mismatch?.message).toBe("El grado no pertenece a la sede seleccionada.");

    const unknownCourse = await errorOf(
      call(studentRouter.create, newStudentInput({ courseId: "nope" }), { context: owner }),
    );
    expect(unknownCourse?.code).toBe("NOT_FOUND");
    expect(unknownCourse?.message).toBe("El grado no existe.");

    const unknownCampus = await errorOf(
      call(studentRouter.create, newStudentInput({ campusId: "nope" }), { context: owner }),
    );
    expect(unknownCampus?.code).toBe("NOT_FOUND");
    expect(unknownCampus?.message).toBe("La sede no existe.");

    const inactive = await seedCampus(fx, tenant, { active: false });
    const inactiveCampus = await errorOf(
      call(studentRouter.create, newStudentInput({ campusId: inactive.id }), { context: owner }),
    );
    expect(inactiveCampus?.code).toBe("BAD_REQUEST");
    expect(inactiveCampus?.message).toBe("La sede seleccionada está inactiva.");

    const taken = await errorOf(
      call(
        studentRouter.create,
        newStudentInput({ documentNumber: tenant.people.teacher!.documentNumber }),
        { context: owner },
      ),
    );
    expect(taken?.code).toBe("CONFLICT");
    expect(taken?.message).toBe("Ya existe un usuario con este documento.");

    const invalid = await errorOf(
      call(studentRouter.create, newStudentInput({ firstName: "", stratum: 9 }), {
        context: owner,
      }),
    );
    expect(invalid?.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(invalid?.data)).toContain("El nombre es obligatorio.");
    expect(JSON.stringify(invalid?.data)).toContain("El estrato debe estar entre 1 y 6.");
  });

  for (const step of [
    { name: "after the login (profile insert)", operation: "insert", table: schema.student },
    {
      name: "after the profile (enrollment insert)",
      operation: "insert",
      table: schema.enrollment,
    },
    { name: "mid-enrollment (course move)", operation: "update", table: schema.student },
  ] as const) {
    test(`create is atomic: a failure ${step.name} leaves no login, person or profile (D1)`, async () => {
      const { course } = await courseWithOfferings(campusId, 2);
      const input = newStudentInput({ courseId: course.id, firstName: "Fallo" });
      input.lastName = input.documentNumber;
      audit.reset();
      const failing = { ...owner, db: faultingDb(fx.db, step.operation, step.table) };
      const error = await errorOf(call(studentRouter.create, input, { context: failing }));
      expect(error).not.toBeNull();
      expect(await residueFor(input.documentNumber)).toEqual({ people: 0, users: 0 });
      expect(audit.events).toHaveLength(0);
    });
  }

  test("create is atomic: a failed audit write rolls the login and profile back", async () => {
    const input = newStudentInput({ firstName: "Fallo" });
    input.lastName = input.documentNumber;
    const failing = {
      ...owner,
      auditLogger: {
        record: async (event: { action: string }) => {
          if (event.action === "student.created") throw new Error("audit down");
        },
      },
    };
    const error = await errorOf(call(studentRouter.create, input, { context: failing as never }));
    expect(error).not.toBeNull();
    expect(await residueFor(input.documentNumber)).toEqual({ people: 0, users: 0 });
  });

  test("create locks the course before counting capacity (waits for a concurrent holder)", async () => {
    const { course } = await courseWithOfferings(campusId, 1, { maxStudents: 5 });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const holder = fx.db.transaction(async (tx) => {
      await tx
        .select({ id: schema.course.id })
        .from(schema.course)
        .where(eq(schema.course.id, course.id))
        // NO KEY UPDATE: blocks the service's FOR UPDATE but not the FK check of the insert.
        .for("no key update");
      locked();
      await held;
    });
    await lockTaken;
    let settled = false;
    const run = call(studentRouter.create, newStudentInput({ courseId: course.id }), {
      context: owner,
    }).finally(() => (settled = true));
    try {
      await sleep(400);
      expect(settled).toBe(false);
    } finally {
      release();
      await holder;
    }
    expect((await run).enrolled).toEqual({ created: 1, overCapacity: false });
  });

  // --- Path B: student.complete -----------------------------------------------------------

  test("complete inserts only the profile for a student login and enrolls (path B)", async () => {
    const login = await studentLogin({ phone: "3005550000" });
    const { course } = await courseWithOfferings(campusId, 3);
    const [personBefore] = await fx.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.id, login.personId));
    audit.reset();
    const result = await call(
      studentRouter.complete,
      { personId: login.personId, campusId, courseId: course.id, eps: "Sura" },
      { context: coordinator },
    );
    expect(result).not.toHaveProperty("username");
    expect(result.enrolled).toEqual({ created: 3, overCapacity: false });
    expect(result.student).toMatchObject({
      personId: login.personId,
      name: "Sin Perfil",
      username: login.username,
      phone: "3005550000",
      eps: "Sura",
      courseId: course.id,
    });
    const [personAfter] = await fx.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.id, login.personId));
    expect(personAfter).toEqual(personBefore);
    expect(audit.events.map((event) => event.action)).toEqual(["student.created"]);
    expect(audit.events[0]).toMatchObject({ metadata: { mode: "complete" } });

    const again = await errorOf(
      call(
        studentRouter.complete,
        { personId: login.personId, campusId, courseId: null },
        {
          context: owner,
        },
      ),
    );
    expect(again?.code).toBe("CONFLICT");
    expect(again?.message).toBe("El usuario ya tiene un perfil académico.");
  });

  test("complete refuses a person without the student role and unknown persons", async () => {
    const notStudent = await errorOf(
      call(
        studentRouter.complete,
        { personId: tenant.people.teacher!.personId, campusId, courseId: null },
        { context: owner },
      ),
    );
    expect(notStudent?.code).toBe("BAD_REQUEST");
    expect(notStudent?.message).toBe("El usuario seleccionado no es un estudiante.");
    const missing = await errorOf(
      call(
        studentRouter.complete,
        { personId: "nope", campusId, courseId: null },
        {
          context: owner,
        },
      ),
    );
    expect(missing?.code).toBe("NOT_FOUND");
    expect(missing?.message).toBe("El usuario no existe.");
  });

  test("listIncomplete lists student logins without a profile; completing removes them", async () => {
    const login = await studentLogin({ firstName: "Pendiente", lastName: "Uno" });
    const page = await call(
      studentRouter.listIncomplete,
      { filters: [listFilter("name", "text", "iLike", "Pendiente")] },
      { context: coordinator },
    );
    expect(page.total).toBe(1);
    expect(page.rows[0]).toEqual({
      personId: login.personId,
      name: "Pendiente Uno",
      documentType: "TI",
      documentNumber: expect.any(String),
      username: login.username,
      email: null,
    });
    const all = await call(studentRouter.listIncomplete, {}, { context: owner });
    expect(all.rows.some((row) => row.personId === tenant.people.teacher!.personId)).toBe(false);
    await call(
      studentRouter.complete,
      { personId: login.personId, campusId, courseId: null },
      {
        context: owner,
      },
    );
    const after = await call(
      studentRouter.listIncomplete,
      { filters: [listFilter("name", "text", "iLike", "Pendiente")] },
      { context: owner },
    );
    expect(after.total).toBe(0);
  });

  test("getIncomplete returns one pending login; NOT_FOUND once completed, for non-students and unknown ids", async () => {
    const login = await studentLogin({ firstName: "Pendiente", lastName: "Dos" });
    const pending = await call(
      studentRouter.getIncomplete,
      { personId: login.personId },
      { context: coordinator },
    );
    expect(pending).toEqual({
      personId: login.personId,
      name: "Pendiente Dos",
      documentType: "TI",
      documentNumber: expect.any(String),
      username: login.username,
      email: null,
    });
    for (const personId of [tenant.people.teacher!.personId, "nope"]) {
      const missing = await errorOf(
        call(studentRouter.getIncomplete, { personId }, { context: owner }),
      );
      expect(missing?.code).toBe("NOT_FOUND");
      expect(missing?.message).toBe("El usuario no existe.");
    }
    await call(
      studentRouter.complete,
      { personId: login.personId, campusId, courseId: null },
      { context: owner },
    );
    const completed = await errorOf(
      call(studentRouter.getIncomplete, { personId: login.personId }, { context: owner }),
    );
    expect(completed?.code).toBe("NOT_FOUND");
  });

  // --- Reads: list / get / pick (STU-R1, STU-R5) ------------------------------------------

  test("list: rows, filters (name/document/guardian, campus, course, status), sorts and paging", async () => {
    const { course } = await courseWithOfferings(otherCampusId, 0);
    const tag = `Lista${crypto.randomUUID().slice(0, 6)}`;
    const a = await call(
      studentRouter.create,
      newStudentInput({
        firstName: "Beto",
        lastName: tag,
        campusId: otherCampusId,
        courseId: course.id,
        guardianName: `Acudiente ${tag}`,
      }),
      { context: owner },
    );
    const b = await call(
      studentRouter.create,
      newStudentInput({ firstName: "Carla", lastName: tag, campusId: otherCampusId }),
      { context: owner },
    );
    await fx.db
      .update(schema.student)
      .set({ status: "retirado" })
      .where(eq(schema.student.id, b.student.id));

    const byName = await call(
      studentRouter.list,
      { filters: [listFilter("name", "text", "iLike", tag)] },
      { context: owner },
    );
    expect(byName.total).toBe(2);
    expect(byName.rows.map((row) => row.name)).toEqual([`Beto ${tag}`, `Carla ${tag}`]);
    expect(byName.rows[0]).toEqual({
      id: a.student.id,
      personId: a.student.personId,
      name: `Beto ${tag}`,
      documentType: "TI",
      documentNumber: a.student.documentNumber,
      courseId: course.id,
      courseName: course.name,
      campusId: otherCampusId,
      campusName: "Sede Norte",
      status: "activo",
      guardianName: `Acudiente ${tag}`,
    });

    const byGuardian = await call(
      studentRouter.list,
      { filters: [listFilter("name", "text", "iLike", `Acudiente ${tag}`)] },
      { context: owner },
    );
    expect(byGuardian.rows.map((row) => row.id)).toEqual([a.student.id]);
    const byDocument = await call(
      studentRouter.list,
      { filters: [listFilter("name", "text", "iLike", b.student.documentNumber)] },
      { context: owner },
    );
    expect(byDocument.rows.map((row) => row.id)).toEqual([b.student.id]);

    const active = await call(
      studentRouter.list,
      {
        filters: [
          listFilter("name", "text", "iLike", tag),
          listFilter("status", "select", "eq", "activo"),
        ],
      },
      { context: owner },
    );
    expect(active.rows.map((row) => row.id)).toEqual([a.student.id]);
    const byCourse = await call(
      studentRouter.list,
      { filters: [listFilter("courseId", "select", "eq", course.id)] },
      { context: owner },
    );
    expect(byCourse.rows.map((row) => row.id)).toEqual([a.student.id]);
    const byCampus = await call(
      studentRouter.list,
      {
        filters: [
          listFilter("campusId", "select", "eq", otherCampusId),
          listFilter("name", "text", "iLike", tag),
        ],
      },
      { context: owner },
    );
    expect(byCampus.total).toBe(2);

    const desc = await call(
      studentRouter.list,
      {
        filters: [listFilter("name", "text", "iLike", tag)],
        sort: [{ id: "status", desc: true }],
        perPage: 1,
      },
      { context: owner },
    );
    expect(desc.total).toBe(2);
    expect(desc.rows.map((row) => row.status)).toEqual(["retirado"]);
  });

  test("get returns the detail with guardian links; unknown id is NOT_FOUND", async () => {
    const created = await call(studentRouter.create, newStudentInput(), { context: owner });
    await fx.db.insert(schema.studentGuardian).values({
      organizationId: tenant.orgId,
      studentId: created.student.id,
      guardianPersonId: tenant.people.parent!.personId,
      relationship: "Madre",
    });
    const detail = await call(studentRouter.get, { id: created.student.id }, { context: owner });
    expect(detail.guardians).toEqual([
      {
        guardianPersonId: tenant.people.parent!.personId,
        name: "parent Estudiantes",
        username: tenant.people.parent!.username,
        relationship: "Madre",
        email: null,
        phone: null,
      },
    ]);
    const missing = await errorOf(call(studentRouter.get, { id: "nope" }, { context: owner }));
    expect(missing?.code).toBe("NOT_FOUND");
    expect(missing?.message).toBe("El estudiante no existe.");
  });

  test("scope: teacher sees only own-course students; student only self; parent only linked children", async () => {
    const own = await courseWithOfferings(campusId, 1, {}, tenant.people.teacher!.personId);
    const other = await courseWithOfferings(campusId, 1);
    const tag = `Scope${crypto.randomUUID().slice(0, 6)}`;
    const mine = await call(
      studentRouter.create,
      newStudentInput({ lastName: tag, courseId: own.course.id }),
      { context: owner },
    );
    const notMine = await call(
      studentRouter.create,
      newStudentInput({ lastName: tag, courseId: other.course.id }),
      { context: owner },
    );
    const nameFilter = { filters: [listFilter("name", "text", "iLike", tag)] };

    const teacherList = await call(studentRouter.list, nameFilter, { context: teacher });
    expect(teacherList.rows.map((row) => row.id)).toEqual([mine.student.id]);
    expect((await call(studentRouter.get, { id: mine.student.id }, { context: teacher })).id).toBe(
      mine.student.id,
    );
    expect(
      (await errorOf(call(studentRouter.get, { id: notMine.student.id }, { context: teacher })))
        ?.code,
    ).toBe("NOT_FOUND");
    const teacherPick = await call(studentRouter.pick, { search: tag }, { context: teacher });
    expect(teacherPick.map((row) => row.id)).toEqual([mine.student.id]);

    // The tenant's student login gets a profile, then sees only itself.
    const self = await call(
      studentRouter.complete,
      { personId: tenant.people.student!.personId, campusId, courseId: null },
      { context: owner },
    );
    expect(
      (await call(studentRouter.pick, {}, { context: studentCaller })).map((row) => row.id),
    ).toEqual([self.student.id]);

    await fx.db.insert(schema.studentGuardian).values({
      organizationId: tenant.orgId,
      studentId: mine.student.id,
      guardianPersonId: tenant.people.parent!.personId,
      relationship: "Padre",
    });
    const children = await call(studentRouter.pick, { search: tag }, { context: parent });
    expect(children.map((row) => row.id)).toEqual([mine.student.id]);
  });

  test("pick: active students only, course filter, search and limit", async () => {
    const { course } = await courseWithOfferings(campusId, 0);
    const tag = `Pick${crypto.randomUUID().slice(0, 6)}`;
    const ids: string[] = [];
    for (const first of ["Ana", "Bea", "Cris"]) {
      const created = await call(
        studentRouter.create,
        newStudentInput({ firstName: first, lastName: tag, courseId: course.id }),
        { context: owner },
      );
      ids.push(created.student.id);
    }
    await call(
      studentRouter.update,
      {
        id: ids[2]!,
        firstName: "Cris",
        lastName: tag,
        campusId,
        courseId: course.id,
        status: "retirado",
      },
      { context: owner },
    );
    const rows = await call(studentRouter.pick, { courseId: course.id }, { context: owner });
    expect(rows).toEqual([
      {
        id: ids[0]!,
        name: `Ana ${tag}`,
        document: expect.any(String),
        courseId: course.id,
        courseName: course.name,
        status: "activo",
      },
      {
        id: ids[1]!,
        name: `Bea ${tag}`,
        document: expect.any(String),
        courseId: course.id,
        courseName: course.name,
        status: "activo",
      },
    ]);
    expect(
      (await call(studentRouter.pick, { search: `Bea ${tag}` }, { context: owner })).map(
        (row) => row.id,
      ),
    ).toEqual([ids[1]!]);
    expect(
      await call(studentRouter.pick, { search: tag, limit: 1 }, { context: owner }),
    ).toHaveLength(1);
  });

  test("filterOptions: campuses and courses of the students in the caller's scope (STU-01)", async () => {
    const tag = crypto.randomUUID().slice(0, 6);
    const north = await seedCampus(fx, tenant, { name: `Norte ${tag}` });
    const taught = await courseWithOfferings(
      north.id,
      1,
      { name: `Dictado ${tag}` },
      tenant.people.teacher!.personId,
    );
    const directed = await seedCourse(fx, tenant, campusId, {
      name: `Dirigido ${tag}`,
      directorPersonId: tenant.people.teacher!.personId,
    });
    const foreign = await seedCourse(fx, tenant, otherCampusId, { name: `Ajeno ${tag}` });
    await seedStudent(fx, tenant, north.id, { courseId: taught.course.id, status: "retirado" });
    await seedStudent(fx, tenant, campusId, { courseId: directed.id });
    await seedStudent(fx, tenant, otherCampusId, { courseId: foreign.id });

    const mine = await call(studentRouter.filterOptions, undefined, { context: teacher });
    expect(mine.courses.filter((course) => course.name.endsWith(tag))).toEqual([
      { id: taught.course.id, name: `Dictado ${tag}`, campusId: north.id },
      { id: directed.id, name: `Dirigido ${tag}`, campusId },
    ]);
    const campusIds = mine.campuses.map((campus) => campus.id);
    expect(campusIds).toContain(north.id);
    expect(campusIds).toContain(campusId);
    expect(campusIds).not.toContain(otherCampusId);
    expect(mine.courses.every((course) => campusIds.includes(course.campusId))).toBe(true);

    const all = await call(studentRouter.filterOptions, undefined, { context: coordinator });
    expect(all.courses.filter((course) => course.name.endsWith(tag)).map((c) => c.id)).toEqual([
      foreign.id,
      taught.course.id,
      directed.id,
    ]);
    expect(all.campuses.map((campus) => campus.id)).toContain(otherCampusId);
    // One entry per campus however many students it holds.
    const ids = all.campuses.map((campus) => campus.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  // --- Edit (STU-R4, STU-R5) --------------------------------------------------------------

  test("update edits personal and academic data, never touches enrollments, flags them stale (STU-R4)", async () => {
    const first = await courseWithOfferings(campusId, 2);
    const second = await courseWithOfferings(campusId, 1);
    const created = await call(
      studentRouter.create,
      newStudentInput({ courseId: first.course.id, phone: "300", eps: "Sura", stratum: 3 }),
      { context: owner },
    );
    const before = await enrollmentsOf([created.student.id]);
    audit.reset();
    const updated = await call(
      studentRouter.update,
      {
        id: created.student.id,
        firstName: "Lucía",
        lastName: "Pérez",
        campusId,
        courseId: second.course.id,
        neighborhood: "Centro",
        guardianName: "Nuevo Acudiente",
        status: "activo",
      },
      { context: coordinator },
    );
    expect(updated).toMatchObject({
      name: "Lucía Pérez",
      courseId: second.course.id,
      neighborhood: "Centro",
      guardianName: "Nuevo Acudiente",
      // Blank optional fields clear (P2 user.update precedent).
      phone: null,
      eps: null,
      stratum: null,
      documentNumber: created.student.documentNumber,
    });
    const after = await enrollmentsOf([created.student.id]);
    expect(after).toEqual(before);
    const listed = await call(
      enrollmentRouter.list,
      { filters: [listFilter("courseId", "select", "eq", first.course.id)] },
      { context: owner },
    );
    expect(
      listed.rows.filter((row) => row.studentId === created.student.id).every((row) => row.isStale),
    ).toBe(true);
    expect(audit.events.map((event) => event.action)).toEqual(["student.updated"]);
    expect(audit.events[0]).toMatchObject({ metadata: { mode: "update" } });
    expect((audit.events[0]!.metadata as { changed: string[] }).changed).toEqual(
      expect.arrayContaining(["firstName", "courseId", "guardianName", "phone", "eps", "stratum"]),
    );
  });

  test("update: a campus change clears the course unless it belongs to the new campus (STU-R4)", async () => {
    const here = await seedCourse(fx, tenant, campusId);
    const there = await seedCourse(fx, tenant, otherCampusId);
    const created = await call(studentRouter.create, newStudentInput({ courseId: here.id }), {
      context: owner,
    });
    const base = {
      id: created.student.id,
      firstName: "Laura",
      lastName: "Pérez",
      status: "activo" as const,
    };
    const cleared = await call(
      studentRouter.update,
      { ...base, campusId: otherCampusId, courseId: here.id },
      { context: owner },
    );
    expect(cleared).toMatchObject({ campusId: otherCampusId, courseId: null });
    const kept = await call(
      studentRouter.update,
      { ...base, campusId: otherCampusId, courseId: there.id },
      { context: owner },
    );
    expect(kept).toMatchObject({ campusId: otherCampusId, courseId: there.id });
    const mismatch = await errorOf(
      call(
        studentRouter.update,
        { ...base, campusId: otherCampusId, courseId: here.id },
        {
          context: owner,
        },
      ),
    );
    expect(mismatch?.code).toBe("BAD_REQUEST");
    expect(mismatch?.message).toBe("El grado no pertenece a la sede seleccionada.");
  });

  test("update: status changes are audited, invalid transitions refused, retired drops out of pick (STU-R5)", async () => {
    const tag = `Estado${crypto.randomUUID().slice(0, 6)}`;
    const created = await call(studentRouter.create, newStudentInput({ lastName: tag }), {
      context: owner,
    });
    const base = {
      id: created.student.id,
      firstName: "Laura",
      lastName: tag,
      campusId,
      courseId: null,
    };
    audit.reset();
    await call(studentRouter.update, { ...base, status: "retirado" }, { context: owner });
    expect(audit.events.map((event) => event.action)).toEqual(["student.status_changed"]);
    expect(audit.events[0]).toMatchObject({
      targetType: "student",
      targetId: created.student.id,
      metadata: { from: "activo", to: "retirado" },
    });
    expect(await call(studentRouter.pick, { search: tag }, { context: owner })).toHaveLength(0);
    // Login is kept (OQ-STU-1).
    const [person] = await fx.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.id, created.student.personId));
    expect(person?.isActive).toBe(true);

    const refused = await errorOf(
      call(studentRouter.update, { ...base, status: "graduado" }, { context: owner }),
    );
    expect(refused?.code).toBe("BAD_REQUEST");
    expect(refused?.message).toBe('No se puede cambiar el estado de "retirado" a "graduado".');

    await call(studentRouter.update, { ...base, status: "activo" }, { context: owner });
    expect(await call(studentRouter.pick, { search: tag }, { context: owner })).toHaveLength(1);
  });

  test("update of an unknown id is NOT_FOUND", async () => {
    const error = await errorOf(
      call(
        studentRouter.update,
        { id: "nope", firstName: "A", lastName: "B", campusId, courseId: null, status: "activo" },
        { context: owner },
      ),
    );
    expect(error?.code).toBe("NOT_FOUND");
  });

  // --- Delete (STU-R7) --------------------------------------------------------------------

  test("delete refuses a profile with enrollments (HAS_DEPENDENTS) and keeps everything", async () => {
    const { course } = await courseWithOfferings(campusId, 1);
    const created = await call(studentRouter.create, newStudentInput({ courseId: course.id }), {
      context: owner,
    });
    const error = await errorOf(
      call(studentRouter.delete, { id: created.student.id }, { context: owner }),
    );
    expect(error?.code).toBe("HAS_DEPENDENTS");
    expect(error?.message).toBe("El estudiante tiene matrículas, notas o asistencia registradas.");
    expect(await studentRow(created.student.id)).toBeDefined();
  });

  test("delete removes guardian links, the profile and the login; the guardian is untouched", async () => {
    const created = await call(studentRouter.create, newStudentInput(), { context: owner });
    await fx.db.insert(schema.studentGuardian).values({
      organizationId: tenant.orgId,
      studentId: created.student.id,
      guardianPersonId: tenant.people.parent!.personId,
      relationship: "Madre",
    });
    const [person] = await fx.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.id, created.student.personId));
    audit.reset();
    expect(
      await call(studentRouter.delete, { id: created.student.id }, { context: coordinator }),
    ).toEqual({ deleted: true });
    expect(await studentRow(created.student.id)).toBeUndefined();
    expect(
      await fx.db
        .select()
        .from(schema.studentGuardian)
        .where(eq(schema.studentGuardian.studentId, created.student.id)),
    ).toHaveLength(0);
    expect(
      await fx.db.select().from(schema.person).where(eq(schema.person.id, person!.id)),
    ).toHaveLength(0);
    expect(
      await fx.db.select().from(schema.user).where(eq(schema.user.id, person!.userId)),
    ).toHaveLength(0);
    expect(
      await fx.db.select().from(schema.member).where(eq(schema.member.userId, person!.userId)),
    ).toHaveLength(0);
    expect(
      await fx.db
        .select()
        .from(schema.person)
        .where(eq(schema.person.id, tenant.people.parent!.personId)),
    ).toHaveLength(1);
    expect(audit.events.map((event) => event.action)).toEqual(["student.deleted"]);
    expect(audit.events[0]).toMatchObject({
      targetType: "student",
      targetId: created.student.id,
      metadata: {
        name: "Laura Pérez",
        documentType: "TI",
        documentNumber: created.student.documentNumber,
      },
    });
    const missing = await errorOf(
      call(studentRouter.delete, { id: created.student.id }, { context: owner }),
    );
    expect(missing?.code).toBe("NOT_FOUND");
  });

  // --- user.previewUsername gate (P2 deferral) --------------------------------------------

  test("user.previewUsername is open to student:create holders (coordinator)", async () => {
    const preview = await call(
      userRouter.previewUsername,
      { firstName: "María", lastName: "Londoño", documentNumber: "9876543210" },
      { context: coordinator },
    );
    expect(preview.username).toBe("mlondono3210");
  });
});

await testPermissionMatrix({
  name: "student",
  procedures: [
    {
      name: "student.list",
      permissions: { student: ["read"] },
      run: (context) => call(studentRouter.list, {}, { context }),
    },
    {
      name: "student.listIncomplete",
      permissions: { student: ["create"] },
      run: (context) => call(studentRouter.listIncomplete, {}, { context }),
    },
    {
      name: "student.getIncomplete",
      permissions: { student: ["create"] },
      run: (context) => call(studentRouter.getIncomplete, { personId: "missing" }, { context }),
    },
    {
      name: "student.get",
      permissions: { student: ["read"] },
      run: (context) => call(studentRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "student.filterOptions",
      permissions: { student: ["read"] },
      run: (context) => call(studentRouter.filterOptions, undefined, { context }),
    },
    {
      name: "student.pick",
      permissions: null,
      anyOf: [{ student: ["read"] }, { portal: ["read_self"] }, { portal: ["read_child"] }],
      run: (context) => call(studentRouter.pick, {}, { context }),
    },
    {
      name: "student.create",
      permissions: { student: ["create"] },
      run: (context) =>
        call(
          studentRouter.create,
          {
            firstName: "Matriz",
            lastName: "Estudiante",
            documentNumber: "12345",
            campusId: "missing",
            courseId: null,
          },
          { context },
        ),
    },
    {
      name: "student.complete",
      permissions: { student: ["create"] },
      run: (context) =>
        call(
          studentRouter.complete,
          { personId: "missing", campusId: "missing", courseId: null },
          { context },
        ),
    },
    {
      name: "student.update",
      permissions: { student: ["update"] },
      run: (context) =>
        call(
          studentRouter.update,
          {
            id: "missing",
            firstName: "A",
            lastName: "B",
            campusId: "missing",
            courseId: null,
            status: "activo",
          },
          { context },
        ),
    },
    {
      name: "student.delete",
      permissions: { student: ["delete"] },
      run: (context) => call(studentRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = {
  studentId: string;
  personId: string;
  campusId: string;
  courseId: string;
  studentName: string;
  loginPersonId: string;
};
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const course = await seedCourse(fx, tenant, campus.id, { name: `Aislado ${tenant.slug}` });
  const student = await seedStudent(fx, tenant, campus.id, {
    courseId: course.id,
    lastName: `Aislado${tenant.slug}`,
  });
  // A student-role login without a profile: a `complete` / `listIncomplete` target.
  const userId = `u-login-${crypto.randomUUID().slice(0, 8)}`;
  await fx.db.insert(schema.user).values({ id: userId, name: "L", email: `${userId}@x.test` });
  await fx.db
    .insert(schema.member)
    .values({ id: crypto.randomUUID(), organizationId: tenant.orgId, userId, role: "student" });
  const [login] = await fx.db
    .insert(schema.person)
    .values({
      organizationId: tenant.orgId,
      userId,
      firstName: "Login",
      lastName: `Aislado${tenant.slug}`,
      documentType: "TI",
      documentNumber: `8${Date.now() % 1_000_000}${userId.slice(-4)}`,
    })
    .returning();
  return {
    studentId: student.id,
    personId: student.personId,
    campusId: campus.id,
    courseId: course.id,
    studentName: `Estudiante Aislado${tenant.slug}`,
    loginPersonId: login!.id,
  };
};
const intact = async (foreign: Seed, fx: SigeTestFixture) => {
  const [student] = await fx.db
    .select()
    .from(schema.student)
    .where(eq(schema.student.id, foreign.studentId));
  expect(student).toMatchObject({ courseId: foreign.courseId, status: "activo" });
  const profiles = await fx.db
    .select()
    .from(schema.student)
    .where(eq(schema.student.personId, foreign.loginPersonId));
  expect(profiles).toHaveLength(0);
};

await testTenantIsolation({
  name: "student",
  cases: [
    isolationCase({
      name: "student.list never returns the other tenant's students",
      seed,
      run: ({ context }) => call(studentRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.studentId, foreign.personId, foreign.studentName],
    }),
    isolationCase({
      name: "student.list filtered by a foreign course returns nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          studentRouter.list,
          { filters: [listFilter("courseId", "select", "eq", foreign.courseId)] },
          { context },
        ),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.studentId, foreign.studentName],
    }),
    isolationCase({
      name: "student.listIncomplete never returns the other tenant's logins",
      seed,
      run: ({ context }) => call(studentRouter.listIncomplete, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.loginPersonId],
    }),
    isolationCase({
      name: "student.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(studentRouter.get, { id: foreign.studentId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "student.filterOptions never returns the other tenant's campuses or courses",
      seed,
      run: ({ context }) => call(studentRouter.filterOptions, undefined, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.campusId, foreign.courseId],
    }),
    isolationCase({
      name: "student.pick never returns the other tenant's students",
      seed,
      run: ({ context, foreign }) =>
        call(studentRouter.pick, { courseId: foreign.courseId }, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.studentId, foreign.studentName],
    }),
    isolationCase({
      name: "student.create into a foreign campus is NOT_FOUND and writes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          studentRouter.create,
          {
            firstName: "Intruso",
            lastName: "Aislado",
            documentNumber: "55555",
            campusId: foreign.campusId,
            courseId: null,
          },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "student.create into a foreign course is NOT_FOUND",
      seed,
      run: ({ context, own, foreign }) =>
        call(
          studentRouter.create,
          {
            firstName: "Intruso",
            lastName: "Aislado",
            documentNumber: "55556",
            campusId: own.campusId,
            courseId: foreign.courseId,
          },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "student.complete of a foreign login is NOT_FOUND",
      seed,
      run: ({ context, own, foreign }) =>
        call(
          studentRouter.complete,
          { personId: foreign.loginPersonId, campusId: own.campusId, courseId: null },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "student.update of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, own, foreign }) =>
        call(
          studentRouter.update,
          {
            id: foreign.studentId,
            firstName: "X",
            lastName: "Y",
            campusId: own.campusId,
            courseId: null,
            status: "retirado",
          },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "student.delete of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(studentRouter.delete, { id: foreign.studentId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
  ],
});

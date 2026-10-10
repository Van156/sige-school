import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { todayIn } from "@base-template/sige-core";
import { and, eq } from "drizzle-orm";
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
  seedSlot,
  seedStudent,
  seedSubject,
} from "../../sige/testing/scheduling-seed";
import { offeringRouter } from "./offering";

/** `offering.*` (sige/04 SCH-05/06, §3.1, SCH-R2/R3/R6, OQ-SCH-1): lists, bulk create, hours, delete, options. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const listFilter = (id: string, variant: "select", operator: "eq", value: string) =>
  ({ id, variant, operator, value }) as never;

await sigeSuite("offering router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let audit: RecordingAuditLogger;
  let campusId: string;

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Materias", ["owner", "coordinator", "teacher", "parent"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
    campusId = (await seedCampus(fx, tenant)).id;
  });

  test("createBulk creates the pairs, skips existing ones and audits once per call", async () => {
    const c1 = await seedCourse(fx, tenant, campusId);
    const c2 = await seedCourse(fx, tenant, campusId);
    const s1 = await seedSubject(fx, tenant);
    const s2 = await seedSubject(fx, tenant);
    audit.reset();
    const first = await call(
      offeringRouter.createBulk,
      { courseIds: [c1.id, c2.id, c1.id], subjectIds: [s1.id, s2.id], hoursPerWeek: 3 },
      { context: owner },
    );
    expect(first).toEqual({ created: 4, skipped: 0 });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("offering.created");
    expect(audit.events[0]?.metadata).toMatchObject({
      created: 4,
      skipped: 0,
      courseIds: [c1.id, c2.id],
      subjectIds: [s1.id, s2.id],
    });

    const s3 = await seedSubject(fx, tenant);
    audit.reset();
    const second = await call(
      offeringRouter.createBulk,
      { courseIds: [c1.id, c2.id], subjectIds: [s1.id, s3.id], hoursPerWeek: 6 },
      { context: owner },
    );
    expect(second).toEqual({ created: 2, skipped: 2 });
    expect(audit.events).toHaveLength(1);
    // Skipped pairs keep their hours.
    const [kept] = await fx.db
      .select()
      .from(schema.offering)
      .where(and(eq(schema.offering.courseId, c1.id), eq(schema.offering.subjectId, s1.id)));
    expect(kept?.hoursPerWeek).toBe(3);
    const none = await call(
      offeringRouter.createBulk,
      { courseIds: [c1.id], subjectIds: [s1.id], hoursPerWeek: 3 },
      { context: owner },
    );
    expect(none).toEqual({ created: 0, skipped: 1 });
  });

  test("createBulk with a teacher also writes the assignments (SCH-R3)", async () => {
    const course = await seedCourse(fx, tenant, campusId, { academicYear: "2027" });
    const subject = await seedSubject(fx, tenant);
    const existing = await seedSubject(fx, tenant);
    await seedOffering(fx, tenant, course.id, existing.id);
    const teacher = tenant.people.teacher!;
    const result = await call(
      offeringRouter.createBulk,
      {
        courseIds: [course.id],
        subjectIds: [subject.id, existing.id],
        teacherPersonId: teacher.personId,
        hoursPerWeek: 5,
      },
      { context: owner },
    );
    expect(result).toEqual({ created: 1, skipped: 1 });
    const [created] = await fx.db
      .select()
      .from(schema.offering)
      .where(
        and(eq(schema.offering.courseId, course.id), eq(schema.offering.subjectId, subject.id)),
      );
    expect(created).toMatchObject({ teacherPersonId: teacher.personId, hoursPerWeek: 5 });
    const assignments = await fx.db
      .select()
      .from(schema.teacherAssignment)
      .where(eq(schema.teacherAssignment.offeringId, created!.id));
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      teacherPersonId: teacher.personId,
      status: "activo",
      academicYear: "2027",
      assignmentDate: todayIn(),
    });
    // The skipped pair got no teacher and no assignment.
    const [untouched] = await fx.db
      .select()
      .from(schema.offering)
      .where(
        and(eq(schema.offering.courseId, course.id), eq(schema.offering.subjectId, existing.id)),
      );
    expect(untouched?.teacherPersonId).toBeNull();
  });

  test("createBulk validates the teacher, the ids and the size", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const base = { courseIds: [course.id], subjectIds: [subject.id], hoursPerWeek: 4 };
    const notTeacher = await errorOf(
      call(
        offeringRouter.createBulk,
        { ...base, teacherPersonId: tenant.people.parent!.personId },
        { context: owner },
      ),
    );
    expect(notTeacher?.code).toBe("BAD_REQUEST");
    expect(notTeacher?.message).toBe("El profesor debe estar activo.");

    const inactive = await fx.provisionTenant("MateriasInactivo", ["owner", "teacher"]);
    await fx.db
      .update(schema.person)
      .set({ isActive: false })
      .where(eq(schema.person.id, inactive.people.teacher!.personId));
    const inactiveCtx = await fx.contextFor(inactive.people.owner!, inactive);
    const inactiveCampus = await seedCampus(fx, inactive);
    const inactiveCourse = await seedCourse(fx, inactive, inactiveCampus.id);
    const inactiveSubject = await seedSubject(fx, inactive);
    expect(
      (
        await errorOf(
          call(
            offeringRouter.createBulk,
            {
              courseIds: [inactiveCourse.id],
              subjectIds: [inactiveSubject.id],
              hoursPerWeek: 4,
              teacherPersonId: inactive.people.teacher!.personId,
            },
            { context: inactiveCtx },
          ),
        )
      )?.message,
    ).toBe("El profesor debe estar activo.");

    expect(
      (
        await errorOf(
          call(offeringRouter.createBulk, { ...base, courseIds: ["nope"] }, { context: owner }),
        )
      )?.code,
    ).toBe("NOT_FOUND");
    expect(
      (
        await errorOf(
          call(offeringRouter.createBulk, { ...base, subjectIds: ["nope"] }, { context: owner }),
        )
      )?.code,
    ).toBe("NOT_FOUND");

    const tooMany = await errorOf(
      call(
        offeringRouter.createBulk,
        {
          courseIds: Array.from({ length: 50 }, (_, i) => `c${i}`),
          subjectIds: Array.from({ length: 11 }, (_, i) => `s${i}`),
          hoursPerWeek: 4,
        },
        { context: owner },
      ),
    );
    expect(tooMany?.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(tooMany?.data)).toContain(
      "Seleccione como máximo 500 combinaciones de grado y materia.",
    );
    const hours = await errorOf(
      call(offeringRouter.createBulk, { ...base, hoursPerWeek: 21 }, { context: owner }),
    );
    expect(JSON.stringify(hours?.data)).toContain("La intensidad debe estar entre 1 y 20 horas.");
  });

  test("createBulk handles the 500-pair maximum in one call", async () => {
    const t = await fx.provisionTenant("Masivo", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const campus = await seedCampus(fx, t);
    const courses = await Promise.all(
      Array.from({ length: 25 }, () => seedCourse(fx, t, campus.id)),
    );
    const subjects = await Promise.all(Array.from({ length: 20 }, () => seedSubject(fx, t)));
    const result = await call(
      offeringRouter.createBulk,
      {
        courseIds: courses.map((c) => c.id),
        subjectIds: subjects.map((s) => s.id),
        hoursPerWeek: 2,
      },
      { context: ctx },
    );
    expect(result).toEqual({ created: 500, skipped: 0 });
  });

  test("update edits the hours only, keeps slots and audits the change (OQ-SCH-1)", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id);
    await seedSlot(fx, tenant, campusId, offering);
    audit.reset();
    const row = await call(
      offeringRouter.update,
      { id: offering.id, hoursPerWeek: 7 },
      { context: owner },
    );
    expect(row).toMatchObject({
      id: offering.id,
      hoursPerWeek: 7,
      courseName: course.name,
      subjectName: subject.name,
    });
    expect(
      await fx.db
        .select()
        .from(schema.scheduleSlot)
        .where(eq(schema.scheduleSlot.offeringId, offering.id)),
    ).toHaveLength(1);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("offering.updated");
    expect(audit.events[0]?.metadata).toMatchObject({
      changes: {
        hoursPerWeek: { from: 4, to: 7 },
      },
    });

    const bad = await errorOf(
      call(offeringRouter.update, { id: offering.id, hoursPerWeek: 0 }, { context: owner }),
    );
    expect(JSON.stringify(bad?.data)).toContain("La intensidad debe estar entre 1 y 20 horas.");
    expect(
      (
        await errorOf(
          call(offeringRouter.update, { id: "nope", hoursPerWeek: 3 }, { context: owner }),
        )
      )?.code,
    ).toBe("NOT_FOUND");
  });

  test("delete removes the offering and its assignment and snapshots it", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id, {
      personId: tenant.people.teacher!.personId,
    });
    audit.reset();
    expect(await call(offeringRouter.delete, { id: offering.id }, { context: owner })).toEqual({
      deleted: true,
    });
    expect(
      await fx.db.select().from(schema.offering).where(eq(schema.offering.id, offering.id)),
    ).toHaveLength(0);
    expect(
      await fx.db
        .select()
        .from(schema.teacherAssignment)
        .where(eq(schema.teacherAssignment.offeringId, offering.id)),
    ).toHaveLength(0);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("offering.deleted");
    expect(audit.events[0]?.metadata).toMatchObject({
      snapshot: { course: course.name, subject: subject.name },
    });
    expect(
      (await errorOf(call(offeringRouter.delete, { id: offering.id }, { context: owner })))?.code,
    ).toBe("NOT_FOUND");
  });

  test("delete is refused while slots exist (§4.2) and audits nothing", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id);
    await seedSlot(fx, tenant, campusId, offering);
    audit.reset();
    const error = await errorOf(
      call(offeringRouter.delete, { id: offering.id }, { context: owner }),
    );
    expect(error?.code).toBe("HAS_DEPENDENTS");
    expect(error?.message).toBe("La materia del grado tiene clases programadas en el horario.");
    expect(audit.events).toHaveLength(0);
    expect(
      await fx.db.select().from(schema.offering).where(eq(schema.offering.id, offering.id)),
    ).toHaveLength(1);
  });

  test("delete checks enrollments before slots (§4.2, P3 D2)", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id);
    await seedSlot(fx, tenant, campusId, offering);
    const student = await seedStudent(fx, tenant, campusId, { courseId: course.id });
    await fx.db.insert(schema.enrollment).values({
      organizationId: tenant.orgId,
      studentId: student.id,
      offeringId: offering.id,
      academicYear: "2026",
    });
    audit.reset();
    const error = await errorOf(
      call(offeringRouter.delete, { id: offering.id }, { context: owner }),
    );
    expect(error?.code).toBe("HAS_DEPENDENTS");
    expect(error?.message).toBe("La materia del grado tiene estudiantes matriculados.");
    expect(audit.events).toHaveLength(0);
    // Without slots the enrollment still blocks the delete.
    await fx.db.delete(schema.scheduleSlot).where(eq(schema.scheduleSlot.offeringId, offering.id));
    const again = await errorOf(
      call(offeringRouter.delete, { id: offering.id }, { context: owner }),
    );
    expect(again?.message).toBe("La materia del grado tiene estudiantes matriculados.");
    expect(
      await fx.db.select().from(schema.offering).where(eq(schema.offering.id, offering.id)),
    ).toHaveLength(1);
  });

  test("delete waits for a concurrent slot insert and is then refused", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id);
    const [room] = await fx.db
      .insert(schema.classroom)
      .values({
        organizationId: tenant.orgId,
        campusId,
        name: "R",
        code: `R-${crypto.randomUUID().slice(0, 8)}`,
      })
      .returning();
    let slotInserted!: () => void;
    const inserted = new Promise<void>((resolve) => (slotInserted = resolve));
    let commitSlot!: () => void;
    const gate = new Promise<void>((resolve) => (commitSlot = resolve));
    const slotTx = fx.db.transaction(async (tx) => {
      await tx.insert(schema.scheduleSlot).values({
        organizationId: tenant.orgId,
        offeringId: offering.id,
        courseId: course.id,
        classroomId: room!.id,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
        academicYear: "2026",
      });
      slotInserted();
      await gate;
    });
    await inserted;
    let settled = false;
    const deletion = errorOf(
      call(offeringRouter.delete, { id: offering.id }, { context: owner }),
    ).finally(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(settled).toBe(false);
    commitSlot();
    await slotTx;
    const error = await deletion;
    expect(error?.code).toBe("HAS_DEPENDENTS");
    expect(error?.message).toBe("La materia del grado tiene clases programadas en el horario.");
    expect(
      await fx.db.select().from(schema.offering).where(eq(schema.offering.id, offering.id)),
    ).toHaveLength(1);
  });

  test("list: default course/subject order, sorts, filters, paging and the inactive flag", async () => {
    const t = await fx.provisionTenant("ListaMaterias", ["owner", "teacher"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const campus = await seedCampus(fx, t);
    const sexto = await seedCourse(fx, t, campus.id, { name: "Sexto", academicYear: "2026" });
    const tercero = await seedCourse(fx, t, campus.id, { name: "Tercero", academicYear: "2027" });
    const mat = await seedSubject(fx, t, { name: "Matemáticas", code: "MAT" });
    const art = await seedSubject(fx, t, { name: "Arte", code: "ART" });
    const teacher = t.people.teacher!;
    await seedOffering(fx, t, tercero.id, mat.id, undefined, 6);
    await seedOffering(
      fx,
      t,
      sexto.id,
      mat.id,
      { personId: teacher.personId, status: "inactivo" },
      3,
    );
    await seedOffering(fx, t, sexto.id, art.id, { personId: teacher.personId }, 2);

    const all = await call(offeringRouter.list, {}, { context: ctx });
    expect(all.total).toBe(3);
    expect(all.rows.map((r) => `${r.courseName}/${r.subjectName}`)).toEqual([
      "Sexto/Arte",
      "Sexto/Matemáticas",
      "Tercero/Matemáticas",
    ]);
    expect(all.rows[0]).toMatchObject({
      subjectCode: "ART",
      teacherPersonId: teacher.personId,
      teacherName: "teacher ListaMaterias",
      assignmentStatus: "activo",
    });
    expect(all.rows[1]?.assignmentStatus).toBe("inactivo");
    expect(all.rows[2]).toMatchObject({
      teacherPersonId: null,
      teacherName: null,
      assignmentStatus: null,
    });

    const byHours = await call(
      offeringRouter.list,
      { sort: [{ id: "hoursPerWeek", desc: true }] },
      { context: ctx },
    );
    expect(byHours.rows.map((r) => r.hoursPerWeek)).toEqual([6, 3, 2]);
    const byTeacher = await call(
      offeringRouter.list,
      { sort: [{ id: "teacher", desc: false }] },
      { context: ctx },
    );
    // Postgres sorts nulls last ascending.
    expect(byTeacher.rows.at(-1)?.teacherPersonId).toBeNull();
    const bySubject = await call(
      offeringRouter.list,
      {
        sort: [
          { id: "subject", desc: true },
          { id: "course", desc: false },
        ],
      },
      { context: ctx },
    );
    expect(bySubject.rows.map((r) => r.courseName)).toEqual(["Sexto", "Tercero", "Sexto"]);

    const unassigned = await call(
      offeringRouter.list,
      { filters: [listFilter("teacher", "select", "eq", "unassigned")] },
      { context: ctx },
    );
    expect(unassigned.rows.map((r) => r.courseName)).toEqual(["Tercero"]);
    const assigned = await call(
      offeringRouter.list,
      { filters: [listFilter("teacher", "select", "eq", "assigned")] },
      { context: ctx },
    );
    expect(assigned.total).toBe(2);
    const byCourse = await call(
      offeringRouter.list,
      { filters: [listFilter("courseId", "select", "eq", tercero.id)] },
      { context: ctx },
    );
    expect(byCourse.rows.map((r) => r.subjectName)).toEqual(["Matemáticas"]);
    const bySubjectFilter = await call(
      offeringRouter.list,
      { filters: [listFilter("subjectId", "select", "eq", art.id)] },
      { context: ctx },
    );
    expect(bySubjectFilter.total).toBe(1);
    const byYear = await call(
      offeringRouter.list,
      { filters: [listFilter("academicYear", "select", "eq", "2027")] },
      { context: ctx },
    );
    expect(byYear.rows.map((r) => r.courseName)).toEqual(["Tercero"]);

    const paged = await call(offeringRouter.list, { page: 2, perPage: 2 }, { context: ctx });
    expect(paged.total).toBe(3);
    expect(paged.rows).toHaveLength(1);

    const badSort = await errorOf(
      call(offeringRouter.list, { sort: [{ id: "organizationId", desc: false }] } as never, {
        context: ctx,
      }),
    );
    expect(badSort?.code).toBe("BAD_REQUEST");
    const badTeacher = await errorOf(
      call(
        offeringRouter.list,
        { filters: [listFilter("teacher", "select", "eq", "x")] },
        {
          context: ctx,
        },
      ),
    );
    expect(badTeacher?.code).toBe("BAD_REQUEST");

    expect(await call(offeringRouter.stats, {}, { context: ctx })).toEqual({
      assigned: 3,
      weeklyHours: 11,
      withoutTeacher: 1,
    });
    expect(await call(offeringRouter.stats, { academicYear: "2026" }, { context: ctx })).toEqual({
      assigned: 2,
      weeklyHours: 5,
      withoutTeacher: 0,
    });
  });

  test("options: managers see every offering; a teacher only own activo/temporal ones (D3)", async () => {
    const t = await fx.provisionTenant("OpcionesMaterias", ["owner", "teacher", "coordinator"]);
    const manager = await fx.contextFor(t.people.owner!, t);
    const teacher = await fx.contextFor(t.people.teacher!, t);
    const campus = await seedCampus(fx, t);
    const course = await seedCourse(fx, t, campus.id, { name: "Octavo" });
    const other = await seedCourse(fx, t, campus.id, { name: "Noveno" });
    const [mine, temp, off, someoneElse, free] = await Promise.all(
      Array.from({ length: 5 }, (_, i) => seedSubject(fx, t, { name: `M${i}`, code: `C${i}` })),
    );
    // A second teacher: the coordinator also holds the teacher role token.
    await fx.db
      .update(schema.member)
      .set({ role: "coordinator,teacher" })
      .where(eq(schema.member.userId, t.people.coordinator!.userId));
    const me = t.people.teacher!.personId;
    const rival = t.people.coordinator!.personId;
    await seedOffering(fx, t, course.id, mine!.id, { personId: me }, 5);
    await seedOffering(fx, t, course.id, temp!.id, { personId: me, status: "temporal" });
    await seedOffering(fx, t, other.id, off!.id, { personId: me, status: "inactivo" });
    await seedOffering(fx, t, other.id, someoneElse!.id, { personId: rival });
    await seedOffering(fx, t, other.id, free!.id);

    const all = await call(offeringRouter.options, {}, { context: manager });
    expect(all).toHaveLength(5);
    expect(all[0]).toEqual({
      offeringId: expect.any(String),
      courseId: other.id,
      courseName: "Noveno",
      subjectId: expect.any(String),
      subjectName: expect.any(String),
      subjectCode: expect.any(String),
      teacherPersonId: expect.anything(),
      teacherName: expect.any(String),
      hoursPerWeek: 4,
      studentCount: 0,
    });
    expect(all.map((row) => row.courseName)).toEqual([
      "Noveno",
      "Noveno",
      "Noveno",
      "Octavo",
      "Octavo",
    ]);

    const own = await call(offeringRouter.options, {}, { context: teacher });
    expect(own.map((row) => row.subjectName).sort()).toEqual(["M0", "M1"]);
    expect(own.every((row) => row.teacherPersonId === me)).toBe(true);
    expect(own.find((row) => row.subjectName === "M0")?.hoursPerWeek).toBe(5);
    expect(
      await call(offeringRouter.options, { courseId: other.id }, { context: teacher }),
    ).toEqual([]);
    const filtered = await call(
      offeringRouter.options,
      { courseId: other.id },
      { context: manager },
    );
    expect(filtered).toHaveLength(3);
    expect(
      await call(offeringRouter.options, { academicYear: "1999" }, { context: manager }),
    ).toEqual([]);

    // The teacher has no `offering:read`: the list is a manager screen, options is the selector.
    expect((await errorOf(call(offeringRouter.list, {}, { context: teacher })))?.code).toBe(
      "FORBIDDEN",
    );
    // Deactivating the assignment (`inactivo`) removes the offering from the teacher at once.
    await fx.db
      .update(schema.teacherAssignment)
      .set({ status: "inactivo" })
      .where(eq(schema.teacherAssignment.teacherPersonId, me));
    expect(await call(offeringRouter.options, {}, { context: teacher })).toEqual([]);
  });

  test("options: studentCount is the number of active students of the offering's course", async () => {
    const t = await fx.provisionTenant("OpcionesConteo", ["owner"]);
    const manager = await fx.contextFor(t.people.owner!, t);
    const campus = await seedCampus(fx, t);
    const course = await seedCourse(fx, t, campus.id, { name: "Octavo" });
    const empty = await seedCourse(fx, t, campus.id, { name: "Noveno" });
    const subject = await seedSubject(fx, t);
    await seedOffering(fx, t, course.id, subject.id);
    await seedOffering(fx, t, empty.id, subject.id);
    await seedStudent(fx, t, campus.id, { courseId: course.id });
    await seedStudent(fx, t, campus.id, { courseId: course.id });
    await seedStudent(fx, t, campus.id, { courseId: course.id, status: "retirado" });
    const rows = await call(offeringRouter.options, {}, { context: manager });
    expect(rows.map((row) => [row.courseName, row.studentCount])).toEqual([
      ["Noveno", 0],
      ["Octavo", 2],
    ]);
  });
});

await testPermissionMatrix({
  name: "offering",
  procedures: [
    {
      name: "offering.list",
      permissions: { offering: ["read"] },
      run: (context) => call(offeringRouter.list, {}, { context }),
    },
    {
      name: "offering.stats",
      permissions: { offering: ["read"] },
      run: (context) => call(offeringRouter.stats, {}, { context }),
    },
    {
      name: "offering.createBulk",
      permissions: { offering: ["create"] },
      run: (context) =>
        call(
          offeringRouter.createBulk,
          { courseIds: ["missing"], subjectIds: ["missing"], hoursPerWeek: 4 },
          { context },
        ),
    },
    {
      name: "offering.update",
      permissions: { offering: ["update"] },
      run: (context) =>
        call(offeringRouter.update, { id: "missing", hoursPerWeek: 4 }, { context }),
    },
    {
      name: "offering.delete",
      permissions: { offering: ["delete"] },
      run: (context) => call(offeringRouter.delete, { id: "missing" }, { context }),
    },
    {
      name: "offering.options",
      permissions: null,
      anyOf: [{ offering: ["read"] }, { grade: ["read"] }, { attendance: ["read"] }],
      run: (context) => call(offeringRouter.options, {}, { context }),
    },
  ],
});

type Seed = { courseId: string; subjectId: string; offeringId: string; courseName: string };
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const course = await seedCourse(fx, tenant, campus.id, { name: `Aislado ${tenant.slug}` });
  const subject = await seedSubject(fx, tenant);
  const offering = await seedOffering(fx, tenant, course.id, subject.id);
  return {
    courseId: course.id,
    subjectId: subject.id,
    offeringId: offering.id,
    courseName: course.name,
  };
};
const intact = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.offering)
    .where(eq(schema.offering.id, foreign.offeringId));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.hoursPerWeek).toBe(4);
};

await testTenantIsolation({
  name: "offering",
  cases: [
    isolationCase({
      name: "offering.list never returns the other tenant's offerings",
      seed,
      run: ({ context }) => call(offeringRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.offeringId, foreign.courseName],
    }),
    isolationCase({
      name: "offering.list filtered by a foreign course returns nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          offeringRouter.list,
          { filters: [listFilter("courseId", "select", "eq", foreign.courseId)] },
          { context },
        ),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.offeringId, foreign.courseName],
    }),
    isolationCase({
      name: "offering.options never returns the other tenant's offerings",
      seed,
      run: ({ context, foreign }) =>
        call(offeringRouter.options, { courseId: foreign.courseId }, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.offeringId, foreign.courseName],
    }),
    isolationCase({
      name: "offering.stats never counts the other tenant's offerings",
      seed,
      run: ({ context }) => call(offeringRouter.stats, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.offeringId],
    }),
    isolationCase({
      name: "offering.createBulk with foreign ids is NOT_FOUND and creates nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          offeringRouter.createBulk,
          { courseIds: [foreign.courseId], subjectIds: [foreign.subjectId], hoursPerWeek: 2 },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "offering.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(offeringRouter.update, { id: foreign.offeringId, hoursPerWeek: 9 }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "offering.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(offeringRouter.delete, { id: foreign.offeringId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
  ],
});

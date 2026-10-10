import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { todayIn } from "@base-template/sige-core";
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
import { racingDb } from "../../sige/testing/racing-db";
import {
  seedCampus,
  seedCourse,
  seedOffering,
  seedStudent,
  seedSubject,
} from "../../sige/testing/scheduling-seed";
import { enrollmentRouter } from "./enrollment";

/** `enrollment.*` (sige/04 SCH-01/02, §3.3, SCH-R5/R7/R8): lists, bulk enrollment, edit, delete. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const listFilter = (id: string, variant: "select" | "text", operator: string, value: string) =>
  ({ id, variant, operator, value }) as never;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

await sigeSuite("enrollment router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let audit: RecordingAuditLogger;
  let campusId: string;

  /** A course with `subjects` offerings. */
  const courseWithOfferings = async (
    t: TestTenant,
    campus: string,
    subjects: number,
    values: Partial<typeof schema.course.$inferInsert> = {},
  ) => {
    const course = await seedCourse(fx, t, campus, values);
    const offerings = [];
    for (let i = 0; i < subjects; i += 1) {
      const subject = await seedSubject(fx, t, { name: `Materia ${i} ${course.name}` });
      offerings.push(await seedOffering(fx, t, course.id, subject.id));
    }
    return { course, offerings };
  };

  const enrollmentsOf = (studentIds: string[]) =>
    fx.db.select().from(schema.enrollment).where(inArray(schema.enrollment.studentId, studentIds));

  const studentRow = async (id: string) =>
    (await fx.db.select().from(schema.student).where(eq(schema.student.id, id)))[0]!;

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Matriculas", ["owner", "coordinator"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
    campusId = (await seedCampus(fx, tenant)).id;
  });

  test("createBulk enrolls students x offerings, moves them into the course and campus, audits once (SCH-R5)", async () => {
    const otherCampus = await seedCampus(fx, tenant);
    const { course, offerings } = await courseWithOfferings(tenant, campusId, 3, {
      academicYear: "2027",
    });
    const a = await seedStudent(fx, tenant, otherCampus.id);
    const b = await seedStudent(fx, tenant, campusId);
    audit.reset();
    const result = await call(
      enrollmentRouter.createBulk,
      { courseId: course.id, studentIds: [a.id, b.id, a.id] },
      { context: owner },
    );
    expect(result).toEqual({ students: 2, created: 6, skipped: 0, overCapacity: false });
    for (const id of [a.id, b.id]) {
      expect(await studentRow(id)).toMatchObject({ courseId: course.id, campusId });
    }
    const rows = await enrollmentsOf([a.id, b.id]);
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((row) => row.offeringId))).toEqual(
      new Set(offerings.map((offering) => offering.id)),
    );
    expect(
      rows.every(
        (row) =>
          row.status === "activa" &&
          row.academicYear === "2027" &&
          row.enrollmentDate === todayIn() &&
          row.organizationId === tenant.orgId,
      ),
    ).toBe(true);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "enrollment.bulk_created",
      metadata: { courseId: course.id, students: 2, created: 6, skipped: 0 },
    });

    // Idempotent re-run: nothing new, everything skipped; a new offering is picked up.
    const again = await call(
      enrollmentRouter.createBulk,
      { courseId: course.id, studentIds: [a.id, b.id] },
      { context: owner },
    );
    expect(again).toEqual({ students: 2, created: 0, skipped: 6, overCapacity: false });
    const extra = await seedSubject(fx, tenant);
    await seedOffering(fx, tenant, course.id, extra.id);
    const third = await call(
      enrollmentRouter.createBulk,
      { courseId: course.id, studentIds: [a.id] },
      { context: owner },
    );
    expect(third).toEqual({ students: 1, created: 1, skipped: 3, overCapacity: false });
    expect(await enrollmentsOf([a.id, b.id])).toHaveLength(7);
  });

  test("createBulk refuses the whole call for a non-active student and persists nothing", async () => {
    const { course } = await courseWithOfferings(tenant, campusId, 2);
    const active = await seedStudent(fx, tenant, campusId);
    const retired = await seedStudent(fx, tenant, campusId, { status: "retirado" });
    audit.reset();
    const error = await errorOf(
      call(
        enrollmentRouter.createBulk,
        { courseId: course.id, studentIds: [active.id, retired.id] },
        { context: owner },
      ),
    );
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("Solo se pueden matricular estudiantes activos.");
    expect(await enrollmentsOf([active.id, retired.id])).toHaveLength(0);
    expect((await studentRow(active.id)).courseId).toBeNull();
    expect(audit.events).toHaveLength(0);
  });

  test("createBulk refuses a course without offerings, unknown ids and an empty selection", async () => {
    const empty = await seedCourse(fx, tenant, campusId);
    const student = await seedStudent(fx, tenant, campusId);
    const noOfferings = await errorOf(
      call(
        enrollmentRouter.createBulk,
        { courseId: empty.id, studentIds: [student.id] },
        { context: owner },
      ),
    );
    expect(noOfferings?.code).toBe("BAD_REQUEST");
    expect(noOfferings?.message).toBe("El grado no tiene materias asignadas.");

    const missingCourse = await errorOf(
      call(
        enrollmentRouter.createBulk,
        { courseId: "nope", studentIds: [student.id] },
        { context: owner },
      ),
    );
    expect(missingCourse?.code).toBe("NOT_FOUND");
    expect(missingCourse?.message).toBe("El grado no existe.");

    const { course } = await courseWithOfferings(tenant, campusId, 1);
    const missingStudent = await errorOf(
      call(
        enrollmentRouter.createBulk,
        { courseId: course.id, studentIds: [student.id, "nope"] },
        { context: owner },
      ),
    );
    expect(missingStudent?.code).toBe("NOT_FOUND");
    expect(missingStudent?.message).toBe("El estudiante no existe.");
    expect(await enrollmentsOf([student.id])).toHaveLength(0);

    const none = await errorOf(
      call(
        enrollmentRouter.createBulk,
        { courseId: course.id, studentIds: [] },
        { context: owner },
      ),
    );
    expect(none?.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(none?.data)).toContain("Seleccione al menos un estudiante.");
    const noCourse = await errorOf(
      call(enrollmentRouter.createBulk, { courseId: "", studentIds: ["x"] }, { context: owner }),
    );
    expect(JSON.stringify(noCourse?.data)).toContain("Debes seleccionar un grado.");
  });

  test("createBulk capacity: refused without override, allowed with it; members are not counted twice (D3)", async () => {
    const { course } = await courseWithOfferings(tenant, campusId, 1, { maxStudents: 2 });
    const member = await seedStudent(fx, tenant, campusId, { courseId: course.id });
    const x = await seedStudent(fx, tenant, campusId);
    const y = await seedStudent(fx, tenant, campusId);

    // Re-selecting the member plus one newcomer: 1 + 1 = 2, at capacity.
    expect(
      await call(
        enrollmentRouter.createBulk,
        { courseId: course.id, studentIds: [member.id, x.id] },
        { context: owner },
      ),
    ).toMatchObject({ students: 2, created: 2, overCapacity: false });

    const refused = await errorOf(
      call(
        enrollmentRouter.createBulk,
        { courseId: course.id, studentIds: [y.id] },
        { context: owner },
      ),
    );
    expect(refused?.code).toBe("BAD_REQUEST");
    expect(refused?.message).toBe("El grado superaría su capacidad máxima (2 estudiantes).");
    expect((await studentRow(y.id)).courseId).toBeNull();

    expect(
      await call(
        enrollmentRouter.createBulk,
        { courseId: course.id, studentIds: [y.id], allowOverCapacity: true },
        { context: owner },
      ),
    ).toEqual({ students: 1, created: 1, skipped: 0, overCapacity: true });
    expect((await studentRow(y.id)).courseId).toBe(course.id);
  });

  test("createBulk is atomic: a failure after the enrollments are written rolls everything back", async () => {
    const { course } = await courseWithOfferings(tenant, campusId, 2);
    const students = await Promise.all(
      Array.from({ length: 3 }, () => seedStudent(fx, tenant, campusId)),
    );
    const failing = {
      ...owner,
      db: racingDb(fx.db, async () => {
        throw new Error("injected failure");
      }),
    };
    const error = await errorOf(
      call(
        enrollmentRouter.createBulk,
        { courseId: course.id, studentIds: students.map((s) => s.id) },
        { context: failing },
      ),
    );
    expect(error).not.toBeNull();
    expect(await enrollmentsOf(students.map((s) => s.id))).toHaveLength(0);
    for (const s of students) expect((await studentRow(s.id)).courseId).toBeNull();
  });

  test("two concurrent createBulk calls serialise on the course and the second sees the capacity", async () => {
    const { course } = await courseWithOfferings(tenant, campusId, 1, { maxStudents: 3 });
    const students = await Promise.all(
      Array.from({ length: 4 }, () => seedStudent(fx, tenant, campusId)),
    );
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const holder = fx.db.transaction(async (tx) => {
      await tx
        .select({ id: schema.course.id })
        .from(schema.course)
        .where(eq(schema.course.id, course.id))
        .for("update");
      locked();
      await held;
    });
    await lockTaken;
    let settled = 0;
    const runs = [students.slice(0, 2), students.slice(2)].map((group) =>
      errorOf(
        call(
          enrollmentRouter.createBulk,
          { courseId: course.id, studentIds: group.map((s) => s.id) },
          { context: owner },
        ),
      ).finally(() => (settled += 1)),
    );
    try {
      await sleep(250);
      expect(settled).toBe(0);
    } finally {
      release();
      await holder;
    }
    const outcomes = await Promise.all(runs);
    expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(1);
    const refusal = outcomes.find((outcome) => outcome !== null);
    expect(refusal?.message).toBe("El grado superaría su capacidad máxima (3 estudiantes).");
    const members = await fx.db
      .select()
      .from(schema.student)
      .where(eq(schema.student.courseId, course.id));
    expect(members).toHaveLength(2);
  });

  test("list: rows, isStale after a course change, sorts, filters and paging; stats", async () => {
    const t = await fx.provisionTenant("ListaMatriculas", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const campus = await seedCampus(fx, t);
    const sexto = await seedCourse(fx, t, campus.id, { name: "Sexto", academicYear: "2026" });
    const septimo = await seedCourse(fx, t, campus.id, { name: "Octavo", academicYear: "2027" });
    const mat = await seedSubject(fx, t, { name: "Matemáticas" });
    const art = await seedSubject(fx, t, { name: "Arte" });
    await seedOffering(fx, t, sexto.id, mat.id);
    await seedOffering(fx, t, sexto.id, art.id);
    const septimoMat = await seedOffering(fx, t, septimo.id, mat.id);
    const ana = await seedStudent(fx, t, campus.id, {
      firstName: "Ana",
      lastName: "Zapata",
      documentNumber: "11110",
    });
    const beto = await seedStudent(fx, t, campus.id, {
      firstName: "Beto",
      lastName: "Arias",
      documentNumber: "22220",
    });
    await call(
      enrollmentRouter.createBulk,
      { courseId: sexto.id, studentIds: [ana.id, beto.id] },
      { context: ctx },
    );
    // Beto moves to Octavo: his Sexto rows become stale (SCH-R7).
    await call(
      enrollmentRouter.createBulk,
      { courseId: septimo.id, studentIds: [beto.id] },
      { context: ctx },
    );

    const all = await call(enrollmentRouter.list, {}, { context: ctx });
    expect(all.total).toBe(5);
    // Default order: student by last name, subject, course.
    expect(all.rows.map((r) => `${r.studentName}/${r.subjectName}/${r.courseName}`)).toEqual([
      "Beto Arias/Arte/Sexto",
      "Beto Arias/Matemáticas/Octavo",
      "Beto Arias/Matemáticas/Sexto",
      "Ana Zapata/Arte/Sexto",
      "Ana Zapata/Matemáticas/Sexto",
    ]);
    expect(all.rows[3]).toEqual({
      id: expect.any(String),
      studentId: ana.id,
      studentName: "Ana Zapata",
      document: "11110",
      subjectName: "Arte",
      courseId: sexto.id,
      courseName: "Sexto",
      enrollmentDate: todayIn(),
      status: "activa",
      finalScore: null,
      statusNote: null,
      isStale: false,
    });
    expect(all.rows.filter((r) => r.isStale).map((r) => r.courseName)).toEqual(["Sexto", "Sexto"]);
    expect(all.rows.find((r) => r.courseId === septimo.id)?.isStale).toBe(false);

    const septimoRow = all.rows.find((r) => r.courseId === septimo.id)!;
    await call(
      enrollmentRouter.update,
      { id: septimoRow.id, status: "retirada", finalScore: 4.5 },
      { context: ctx },
    );

    const byScore = await call(
      enrollmentRouter.list,
      { sort: [{ id: "finalScore", desc: false }] },
      { context: ctx },
    );
    expect(byScore.rows[0]?.finalScore).toBe(4.5);
    const byCourse = await call(
      enrollmentRouter.list,
      { sort: [{ id: "course", desc: false }] },
      { context: ctx },
    );
    expect(byCourse.rows[0]?.courseName).toBe("Octavo");
    const byStatus = await call(
      enrollmentRouter.list,
      { sort: [{ id: "status", desc: true }] },
      { context: ctx },
    );
    expect(byStatus.rows[0]?.status).toBe("retirada");

    const byDocument = await call(
      enrollmentRouter.list,
      { filters: [listFilter("student", "text", "iLike", "22220")] },
      { context: ctx },
    );
    expect(byDocument.total).toBe(3);
    const byName = await call(
      enrollmentRouter.list,
      { filters: [listFilter("student", "text", "iLike", "ana zap")] },
      { context: ctx },
    );
    expect(byName.total).toBe(2);
    const bySubject = await call(
      enrollmentRouter.list,
      { filters: [listFilter("subjectId", "select", "eq", art.id)] },
      { context: ctx },
    );
    expect(bySubject.total).toBe(2);
    const byCourseFilter = await call(
      enrollmentRouter.list,
      { filters: [listFilter("courseId", "select", "eq", septimo.id)] },
      { context: ctx },
    );
    expect(byCourseFilter.rows.map((r) => r.id)).toEqual([septimoRow.id]);
    const retired = await call(
      enrollmentRouter.list,
      { filters: [listFilter("status", "select", "eq", "retirada")] },
      { context: ctx },
    );
    expect(retired.total).toBe(1);
    const byYear = await call(
      enrollmentRouter.list,
      { filters: [listFilter("academicYear", "select", "eq", "2027")] },
      { context: ctx },
    );
    expect(byYear.rows.map((r) => r.id)).toEqual([septimoRow.id]);
    const paged = await call(enrollmentRouter.list, { page: 2, perPage: 2 }, { context: ctx });
    expect(paged.total).toBe(5);
    expect(paged.rows).toHaveLength(2);
    expect(
      (
        await errorOf(
          call(enrollmentRouter.list, { sort: [{ id: "organizationId", desc: false }] } as never, {
            context: ctx,
          }),
        )
      )?.code,
    ).toBe("BAD_REQUEST");
    expect(
      (
        await errorOf(
          call(
            enrollmentRouter.list,
            { filters: [listFilter("status", "select", "eq", "x")] },
            { context: ctx },
          ),
        )
      )?.code,
    ).toBe("BAD_REQUEST");

    expect(await call(enrollmentRouter.stats, {}, { context: ctx })).toEqual({
      total: 5,
      active: 4,
    });
    expect(await call(enrollmentRouter.stats, { academicYear: "2027" }, { context: ctx })).toEqual({
      total: 1,
      active: 0,
    });

    const one = await call(enrollmentRouter.get, { id: septimoRow.id }, { context: ctx });
    expect(one).toMatchObject({
      id: septimoRow.id,
      studentName: "Beto Arias",
      courseName: "Octavo",
      subjectName: "Matemáticas",
      status: "retirada",
      finalScore: 4.5,
      isStale: false,
    });
    expect(septimoMat.id).toBeTruthy();
    expect(
      (await errorOf(call(enrollmentRouter.get, { id: "nope" }, { context: ctx })))?.code,
    ).toBe("NOT_FOUND");
  });

  test("candidates: course summary and active students not in the course, with search", async () => {
    const t = await fx.provisionTenant("Candidatos", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const campus = await seedCampus(fx, t);
    const { course } = await courseWithOfferings(t, campus.id, 2, {
      name: "Quinto",
      maxStudents: 30,
    });
    const other = await seedCourse(fx, t, campus.id, { name: "Cuarto" });
    await seedStudent(fx, t, campus.id, { courseId: course.id, firstName: "Miembro" });
    await seedStudent(fx, t, campus.id, { courseId: course.id, status: "retirado" });
    await seedStudent(fx, t, campus.id, { status: "graduado", firstName: "Graduado" });
    const free = await seedStudent(fx, t, campus.id, {
      firstName: "Carla",
      lastName: "Ruiz",
      documentNumber: "55550",
    });
    const moving = await seedStudent(fx, t, campus.id, {
      courseId: other.id,
      firstName: "Diego",
      lastName: "Bravo",
      documentNumber: "66660",
    });

    const result = await call(
      enrollmentRouter.candidates,
      { courseId: course.id },
      { context: ctx },
    );
    expect(result.course).toEqual({
      id: course.id,
      name: "Quinto",
      maxStudents: 30,
      currentStudents: 1,
      offeringCount: 2,
    });
    expect(result.students).toEqual([
      { id: moving.id, name: "Diego Bravo", document: "66660", currentCourseName: "Cuarto" },
      { id: free.id, name: "Carla Ruiz", document: "55550", currentCourseName: null },
    ]);
    const searched = await call(
      enrollmentRouter.candidates,
      { courseId: course.id, search: "555" },
      { context: ctx },
    );
    expect(searched.students.map((s) => s.id)).toEqual([free.id]);
    const limited = await call(
      enrollmentRouter.candidates,
      { courseId: course.id, limit: 1 },
      { context: ctx },
    );
    expect(limited.students).toHaveLength(1);
    expect(
      (await errorOf(call(enrollmentRouter.candidates, { courseId: "nope" }, { context: ctx })))
        ?.code,
    ).toBe("NOT_FOUND");
  });

  test("update edits status, score and note only and audits before/after (SCH-R8)", async () => {
    const { course } = await courseWithOfferings(tenant, campusId, 1);
    const student = await seedStudent(fx, tenant, campusId);
    await call(
      enrollmentRouter.createBulk,
      { courseId: course.id, studentIds: [student.id] },
      { context: owner },
    );
    const [row] = await enrollmentsOf([student.id]);
    audit.reset();
    const updated = await call(
      enrollmentRouter.update,
      { id: row!.id, status: "cancelada", finalScore: 3.7, statusNote: "  Retiro voluntario " },
      { context: owner },
    );
    expect(updated).toMatchObject({
      id: row!.id,
      status: "cancelada",
      finalScore: 3.7,
      statusNote: "Retiro voluntario",
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "enrollment.updated",
      targetId: row!.id,
      metadata: {
        changes: {
          status: { from: "activa", to: "cancelada" },
          finalScore: { from: null, to: 3.7 },
          statusNote: { from: null, to: "Retiro voluntario" },
        },
      },
    });

    // Omitted score keeps it; null and "" clear.
    const kept = await call(
      enrollmentRouter.update,
      { id: row!.id, status: "activa" },
      { context: owner },
    );
    expect(kept).toMatchObject({
      status: "activa",
      finalScore: 3.7,
      statusNote: "Retiro voluntario",
    });
    const cleared = await call(
      enrollmentRouter.update,
      { id: row!.id, status: "activa", finalScore: null, statusNote: "" },
      { context: owner },
    );
    expect(cleared).toMatchObject({ finalScore: null, statusNote: null });

    const bad = await errorOf(
      call(
        enrollmentRouter.update,
        { id: row!.id, status: "activa", finalScore: 5.5 },
        {
          context: owner,
        },
      ),
    );
    expect(bad?.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(bad?.data)).toContain("La nota final debe estar entre 1.0 y 5.0.");
    expect(
      (
        await errorOf(
          call(enrollmentRouter.update, { id: "nope", status: "activa" }, { context: owner }),
        )
      )?.code,
    ).toBe("NOT_FOUND");
  });

  test("delete removes the enrollment and snapshots the names", async () => {
    const { course } = await courseWithOfferings(tenant, campusId, 1);
    const student = await seedStudent(fx, tenant, campusId, {
      firstName: "Borrar",
      lastName: "Me",
    });
    await call(
      enrollmentRouter.createBulk,
      { courseId: course.id, studentIds: [student.id] },
      { context: owner },
    );
    const [row] = await enrollmentsOf([student.id]);
    audit.reset();
    expect(await call(enrollmentRouter.delete, { id: row!.id }, { context: owner })).toEqual({
      deleted: true,
    });
    expect(await enrollmentsOf([student.id])).toHaveLength(0);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "enrollment.deleted",
      targetId: row!.id,
      metadata: { snapshot: { student: "Borrar Me", course: course.name } },
    });
    expect(
      (await errorOf(call(enrollmentRouter.delete, { id: row!.id }, { context: owner })))?.code,
    ).toBe("NOT_FOUND");
  });
});

await testPermissionMatrix({
  name: "enrollment",
  procedures: [
    {
      name: "enrollment.list",
      permissions: { enrollment: ["read"] },
      run: (context) => call(enrollmentRouter.list, {}, { context }),
    },
    {
      name: "enrollment.stats",
      permissions: { enrollment: ["read"] },
      run: (context) => call(enrollmentRouter.stats, {}, { context }),
    },
    {
      name: "enrollment.get",
      permissions: { enrollment: ["read"] },
      run: (context) => call(enrollmentRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "enrollment.candidates",
      permissions: { enrollment: ["create"] },
      run: (context) => call(enrollmentRouter.candidates, { courseId: "missing" }, { context }),
    },
    {
      name: "enrollment.createBulk",
      permissions: { enrollment: ["create"] },
      run: (context) =>
        call(
          enrollmentRouter.createBulk,
          { courseId: "missing", studentIds: ["missing"] },
          { context },
        ),
    },
    {
      name: "enrollment.update",
      permissions: { enrollment: ["update"] },
      run: (context) =>
        call(enrollmentRouter.update, { id: "missing", status: "activa" }, { context }),
    },
    {
      name: "enrollment.delete",
      permissions: { enrollment: ["delete"] },
      run: (context) => call(enrollmentRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = {
  courseId: string;
  studentId: string;
  enrollmentId: string;
  studentName: string;
  courseName: string;
};
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const course = await seedCourse(fx, tenant, campus.id, { name: `Aislado ${tenant.slug}` });
  const subject = await seedSubject(fx, tenant);
  const offering = await seedOffering(fx, tenant, course.id, subject.id);
  const student = await seedStudent(fx, tenant, campus.id, {
    courseId: course.id,
    lastName: `Aislado${tenant.slug}`,
  });
  const [row] = await fx.db
    .insert(schema.enrollment)
    .values({
      organizationId: tenant.orgId,
      studentId: student.id,
      offeringId: offering.id,
      academicYear: "2026",
    })
    .returning();
  return {
    courseId: course.id,
    studentId: student.id,
    enrollmentId: row!.id,
    studentName: `Estudiante Aislado${tenant.slug}`,
    courseName: course.name,
  };
};
const intact = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.enrollment)
    .where(eq(schema.enrollment.studentId, foreign.studentId));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: foreign.enrollmentId, status: "activa", finalScore: null });
  const [student] = await fx.db
    .select()
    .from(schema.student)
    .where(and(eq(schema.student.id, foreign.studentId)));
  expect(student?.courseId).toBe(foreign.courseId);
};

await testTenantIsolation({
  name: "enrollment",
  cases: [
    isolationCase({
      name: "enrollment.list never returns the other tenant's enrollments",
      seed,
      run: ({ context }) => call(enrollmentRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.enrollmentId, foreign.studentId, foreign.studentName],
    }),
    isolationCase({
      name: "enrollment.list filtered by a foreign course returns nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          enrollmentRouter.list,
          { filters: [listFilter("courseId", "select", "eq", foreign.courseId)] },
          { context },
        ),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.enrollmentId, foreign.studentName],
    }),
    isolationCase({
      name: "enrollment.stats never counts the other tenant's enrollments",
      seed,
      run: ({ context }) => call(enrollmentRouter.stats, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.enrollmentId],
    }),
    isolationCase({
      name: "enrollment.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(enrollmentRouter.get, { id: foreign.enrollmentId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "enrollment.candidates for a foreign course is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(enrollmentRouter.candidates, { courseId: foreign.courseId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "enrollment.candidates never lists the other tenant's students",
      seed,
      run: ({ context, own }) =>
        call(enrollmentRouter.candidates, { courseId: own.courseId }, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.studentId, foreign.studentName],
    }),
    isolationCase({
      name: "enrollment.createBulk into a foreign course is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, own, foreign }) =>
        call(
          enrollmentRouter.createBulk,
          { courseId: foreign.courseId, studentIds: [own.studentId] },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "enrollment.createBulk of a foreign student is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, own, foreign }) =>
        call(
          enrollmentRouter.createBulk,
          { courseId: own.courseId, studentIds: [foreign.studentId] },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "enrollment.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          enrollmentRouter.update,
          { id: foreign.enrollmentId, status: "retirada", finalScore: 2 },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "enrollment.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(enrollmentRouter.delete, { id: foreign.enrollmentId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
  ],
});

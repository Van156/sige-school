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
  seedSubject,
} from "../../sige/testing/scheduling-seed";
import { assignmentRouter } from "./assignment";

/** `assignment.*` (sige/04 SCH-03/04, §3.2, SCH-R3/R4): assign, update, delete, lists. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const listFilter = (
  id: string,
  variant: "select" | "text",
  operator: "eq" | "iLike",
  value: string,
) => ({ id, variant, operator, value }) as never;

/** A second teacher in the same institution: the coordinator also holds the teacher token. */
const makeSecondTeacher = async (fx: SigeTestFixture, tenant: TestTenant) => {
  await fx.db
    .update(schema.member)
    .set({ role: "coordinator,teacher" })
    .where(eq(schema.member.userId, tenant.people.coordinator!.userId));
  return tenant.people.coordinator!.personId;
};

await sigeSuite("assignment router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let audit: RecordingAuditLogger;
  let campusId: string;
  let teacherA: string;
  let teacherB: string;

  const offeringOf = async (courseId: string, subjectId: string) => {
    const [row] = await fx.db
      .select()
      .from(schema.offering)
      .where(and(eq(schema.offering.courseId, courseId), eq(schema.offering.subjectId, subjectId)));
    return row;
  };
  const assignmentsOf = (offeringId: string) =>
    fx.db
      .select()
      .from(schema.teacherAssignment)
      .where(eq(schema.teacherAssignment.offeringId, offeringId));

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Asignaciones", [
      "owner",
      "coordinator",
      "teacher",
      "parent",
    ]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
    campusId = (await seedCampus(fx, tenant)).id;
    teacherA = tenant.people.teacher!.personId;
    teacherB = await makeSecondTeacher(fx, tenant);
  });

  test("assign creates the offering with 4 hours and the assignment (activo, today, course year)", async () => {
    const course = await seedCourse(fx, tenant, campusId, { academicYear: "2027" });
    const subject = await seedSubject(fx, tenant);
    audit.reset();
    const result = await call(
      assignmentRouter.assign,
      { courseId: course.id, subjectId: subject.id, teacherPersonId: teacherA },
      { context: owner },
    );
    expect(result.offeringCreated).toBe(true);
    expect(result.assignment).toMatchObject({
      teacherPersonId: teacherA,
      teacherName: "teacher Asignaciones",
      subjectName: subject.name,
      courseName: course.name,
      status: "activo",
      assignmentDate: todayIn(),
      academicYear: "2027",
      notes: null,
    });
    expect(result.assignment.teacherUsername).toBe(tenant.people.teacher!.username);
    const offering = await offeringOf(course.id, subject.id);
    expect(offering).toMatchObject({ hoursPerWeek: 4, teacherPersonId: teacherA });
    expect(await assignmentsOf(offering!.id)).toHaveLength(1);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("teacher.assigned");
    expect(audit.events[0]?.metadata).toEqual({
      offeringId: offering!.id,
      from: null,
      to: teacherA,
      status: "activo",
    });
  });

  test("assign on an existing offering changes its teacher and resets the assignment", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(
      fx,
      tenant,
      course.id,
      subject.id,
      { personId: teacherA, status: "inactivo" },
      7,
    );
    await fx.db
      .update(schema.teacherAssignment)
      .set({ notes: "nota" })
      .where(eq(schema.teacherAssignment.offeringId, offering.id));
    audit.reset();
    const result = await call(
      assignmentRouter.assign,
      { courseId: course.id, subjectId: subject.id, teacherPersonId: teacherB },
      { context: owner },
    );
    expect(result.offeringCreated).toBe(false);
    expect(result.assignment).toMatchObject({ teacherPersonId: teacherB, status: "activo" });
    const after = await offeringOf(course.id, subject.id);
    expect(after).toMatchObject({ id: offering.id, hoursPerWeek: 7, teacherPersonId: teacherB });
    const rows = await assignmentsOf(offering.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ teacherPersonId: teacherB, status: "activo" });
    expect(audit.events[0]?.metadata).toEqual({
      offeringId: offering.id,
      from: teacherA,
      to: teacherB,
      status: "activo",
    });
  });

  test("assign to the same teacher re-activates the assignment", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id, {
      personId: teacherA,
      status: "inactivo",
    });
    const result = await call(
      assignmentRouter.assign,
      { courseId: course.id, subjectId: subject.id, teacherPersonId: teacherA },
      { context: owner },
    );
    expect(result.assignment.status).toBe("activo");
    expect(await assignmentsOf(offering.id)).toHaveLength(1);
  });

  test("assign to an offering without teacher creates the assignment row", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id);
    const result = await call(
      assignmentRouter.assign,
      { courseId: course.id, subjectId: subject.id, teacherPersonId: teacherA },
      { context: owner },
    );
    expect(result.offeringCreated).toBe(false);
    expect(await assignmentsOf(offering.id)).toHaveLength(1);
  });

  test("assign rejects a non-teacher, an inactive or foreign teacher and unknown ids", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const input = { courseId: course.id, subjectId: subject.id };
    for (const teacherPersonId of [tenant.people.parent!.personId, "nope"]) {
      const error = await errorOf(
        call(assignmentRouter.assign, { ...input, teacherPersonId }, { context: owner }),
      );
      expect(error?.code).toBe("BAD_REQUEST");
      expect(error?.message).toBe("El profesor debe estar activo.");
    }
    const other = await fx.provisionTenant("OtroProfe", ["teacher"]);
    expect(
      (
        await errorOf(
          call(
            assignmentRouter.assign,
            { ...input, teacherPersonId: other.people.teacher!.personId },
            { context: owner },
          ),
        )
      )?.message,
    ).toBe("El profesor debe estar activo.");
    const inactive = await fx.provisionTenant("ProfeInactivo", ["owner", "teacher"]);
    await fx.db
      .update(schema.person)
      .set({ isActive: false })
      .where(eq(schema.person.id, inactive.people.teacher!.personId));
    const inactiveCtx = await fx.contextFor(inactive.people.owner!, inactive);
    const iCampus = await seedCampus(fx, inactive);
    const iCourse = await seedCourse(fx, inactive, iCampus.id);
    const iSubject = await seedSubject(fx, inactive);
    expect(
      (
        await errorOf(
          call(
            assignmentRouter.assign,
            {
              courseId: iCourse.id,
              subjectId: iSubject.id,
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
          call(
            assignmentRouter.assign,
            { ...input, courseId: "nope", teacherPersonId: teacherA },
            { context: owner },
          ),
        )
      )?.code,
    ).toBe("NOT_FOUND");
    expect(
      (
        await errorOf(
          call(
            assignmentRouter.assign,
            { ...input, subjectId: "nope", teacherPersonId: teacherA },
            { context: owner },
          ),
        )
      )?.code,
    ).toBe("NOT_FOUND");
    // Nothing was created by the failures.
    expect(await offeringOf(course.id, subject.id)).toBeUndefined();
    const missing = await errorOf(
      call(
        assignmentRouter.assign,
        { courseId: "", subjectId: "", teacherPersonId: "" },
        { context: owner },
      ),
    );
    expect(JSON.stringify(missing?.data)).toContain("Debes seleccionar un profesor.");
  });

  test("two concurrent assigns of a new pair end with one offering and one assignment", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const results = await Promise.all(
      [teacherA, teacherB].map((teacherPersonId) =>
        call(
          assignmentRouter.assign,
          { courseId: course.id, subjectId: subject.id, teacherPersonId },
          { context: owner },
        ),
      ),
    );
    expect(results.filter((r) => r.offeringCreated)).toHaveLength(1);
    const offering = await offeringOf(course.id, subject.id);
    const rows = await assignmentsOf(offering!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.teacherPersonId).toBe(offering?.teacherPersonId ?? undefined);
  });

  test("reassigning an offering with slots is refused when the new teacher is busy (SCH-R3)", async () => {
    const c1 = await seedCourse(fx, tenant, campusId, { name: "Cuarto A" });
    const c2 = await seedCourse(fx, tenant, campusId, { name: "Cuarto B" });
    const s1 = await seedSubject(fx, tenant);
    const s2 = await seedSubject(fx, tenant);
    const busy = await seedOffering(fx, tenant, c1.id, s1.id, { personId: teacherB });
    await seedSlot(fx, tenant, campusId, busy, {
      dayOfWeek: 2,
      startTime: "07:00",
      endTime: "08:00",
    });
    const target = await seedOffering(fx, tenant, c2.id, s2.id, { personId: teacherA });
    await seedSlot(fx, tenant, campusId, target, {
      dayOfWeek: 2,
      startTime: "07:30",
      endTime: "08:30",
    });
    audit.reset();
    const error = await errorOf(
      call(
        assignmentRouter.assign,
        { courseId: c2.id, subjectId: s2.id, teacherPersonId: teacherB },
        { context: owner },
      ),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe(
      "El profesor ya tiene clases en el mismo horario (Cuarto A, Miércoles 07:00).",
    );
    expect(audit.events).toHaveLength(0);
    const after = await offeringOf(c2.id, s2.id);
    expect(after?.teacherPersonId).toBe(teacherA);
    expect((await assignmentsOf(target.id))[0]?.teacherPersonId).toBe(teacherA);
  });

  test("reassigning with slots to a free teacher moves the slots' teacher along", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id, {
      personId: teacherA,
    });
    const slot = await seedSlot(fx, tenant, campusId, offering, { dayOfWeek: 4 });
    // Back-to-back (half-open) with another class of the new teacher is not a clash.
    const c2 = await seedCourse(fx, tenant, campusId);
    const s2 = await seedSubject(fx, tenant);
    const adjacent = await seedOffering(fx, tenant, c2.id, s2.id, { personId: teacherB });
    await seedSlot(fx, tenant, campusId, adjacent, {
      dayOfWeek: 4,
      startTime: "08:00",
      endTime: "09:00",
    });
    await call(
      assignmentRouter.assign,
      { courseId: course.id, subjectId: subject.id, teacherPersonId: teacherB },
      { context: owner },
    );
    const [moved] = await fx.db
      .select()
      .from(schema.scheduleSlot)
      .where(eq(schema.scheduleSlot.id, slot.id));
    expect(moved?.teacherPersonId).toBe(teacherB);
  });

  test("giving a teacher to an offering whose slots have none fills them", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id);
    const slot = await seedSlot(fx, tenant, campusId, offering, { dayOfWeek: 1 });
    await call(
      assignmentRouter.assign,
      { courseId: course.id, subjectId: subject.id, teacherPersonId: teacherA },
      { context: owner },
    );
    const [filled] = await fx.db
      .select()
      .from(schema.scheduleSlot)
      .where(eq(schema.scheduleSlot.id, slot.id));
    expect(filled?.teacherPersonId).toBe(teacherA);
  });

  test("assign to a different teacher clears the previous teacher's notes (D10)", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id, {
      personId: teacherA,
    });
    await fx.db
      .update(schema.teacherAssignment)
      .set({ notes: "Incapacidad de A" })
      .where(eq(schema.teacherAssignment.offeringId, offering.id));
    const result = await call(
      assignmentRouter.assign,
      { courseId: course.id, subjectId: subject.id, teacherPersonId: teacherB },
      { context: owner },
    );
    expect(result.assignment).toMatchObject({ teacherPersonId: teacherB, notes: null });
    expect((await assignmentsOf(offering.id))[0]?.notes).toBeNull();
  });

  test("assign to the same teacher keeps the notes (D10)", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id, {
      personId: teacherA,
      status: "temporal",
    });
    await fx.db
      .update(schema.teacherAssignment)
      .set({ notes: "Reemplazo temporal" })
      .where(eq(schema.teacherAssignment.offeringId, offering.id));
    const result = await call(
      assignmentRouter.assign,
      { courseId: course.id, subjectId: subject.id, teacherPersonId: teacherA },
      { context: owner },
    );
    expect(result.assignment).toMatchObject({ status: "activo", notes: "Reemplazo temporal" });
  });

  test("an inactive slot of the new teacher never causes the busy refusal (SCH-R3)", async () => {
    const c1 = await seedCourse(fx, tenant, campusId);
    const c2 = await seedCourse(fx, tenant, campusId);
    const s1 = await seedSubject(fx, tenant);
    const s2 = await seedSubject(fx, tenant);
    const busy = await seedOffering(fx, tenant, c1.id, s1.id, { personId: teacherB });
    const when = { dayOfWeek: 1, startTime: "13:00", endTime: "14:00" };
    const inactive = await seedSlot(fx, tenant, campusId, busy, when);
    await fx.db
      .update(schema.scheduleSlot)
      .set({ isActive: false })
      .where(eq(schema.scheduleSlot.id, inactive.id));
    const target = await seedOffering(fx, tenant, c2.id, s2.id, { personId: teacherA });
    await seedSlot(fx, tenant, campusId, target, when);
    const result = await call(
      assignmentRouter.assign,
      { courseId: c2.id, subjectId: s2.id, teacherPersonId: teacherB },
      { context: owner },
    );
    expect(result.assignment.teacherPersonId).toBe(teacherB);
  });

  test("an inactive slot of the target offering never causes the busy refusal (SCH-R3)", async () => {
    const c1 = await seedCourse(fx, tenant, campusId);
    const c2 = await seedCourse(fx, tenant, campusId);
    const s1 = await seedSubject(fx, tenant);
    const s2 = await seedSubject(fx, tenant);
    const busy = await seedOffering(fx, tenant, c1.id, s1.id, { personId: teacherB });
    await seedSlot(fx, tenant, campusId, busy, { dayOfWeek: 3 });
    const target = await seedOffering(fx, tenant, c2.id, s2.id, { personId: teacherA });
    const inactive = await seedSlot(fx, tenant, campusId, target, { dayOfWeek: 3 });
    await fx.db
      .update(schema.scheduleSlot)
      .set({ isActive: false })
      .where(eq(schema.scheduleSlot.id, inactive.id));
    const result = await call(
      assignmentRouter.assign,
      { courseId: c2.id, subjectId: s2.id, teacherPersonId: teacherB },
      { context: owner },
    );
    expect(result.assignment.teacherPersonId).toBe(teacherB);
  });

  test("update changes status and notes only; a left-out note clears it", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id, {
      personId: teacherA,
    });
    const [assignment] = await assignmentsOf(offering.id);
    audit.reset();
    const updated = await call(
      assignmentRouter.update,
      { id: assignment!.id, status: "temporal", notes: " Reemplazo " },
      { context: owner },
    );
    expect(updated).toMatchObject({
      status: "temporal",
      notes: "Reemplazo",
      teacherPersonId: teacherA,
    });
    expect((await offeringOf(course.id, subject.id))?.teacherPersonId).toBe(teacherA);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("teacher.assigned");
    expect(audit.events[0]?.metadata).toMatchObject({
      offeringId: offering.id,
      from: teacherA,
      to: teacherA,
      status: "temporal",
    });
    const cleared = await call(
      assignmentRouter.update,
      { id: assignment!.id, status: "inactivo" },
      { context: owner },
    );
    expect(cleared).toMatchObject({ status: "inactivo", notes: null });
    // Inactive keeps the teacher on the offering (SCH-R3).
    expect((await offeringOf(course.id, subject.id))?.teacherPersonId).toBe(teacherA);
    const bad = await errorOf(
      call(
        assignmentRouter.update,
        { id: assignment!.id, status: "x", notes: "y".repeat(501) } as never,
        { context: owner },
      ),
    );
    expect(bad?.code).toBe("BAD_REQUEST");
    expect(
      (
        await errorOf(
          call(assignmentRouter.update, { id: "nope", status: "activo" }, { context: owner }),
        )
      )?.code,
    ).toBe("NOT_FOUND");
  });

  test("delete removes the row and clears the offering's teacher (assignment first)", async () => {
    const course = await seedCourse(fx, tenant, campusId);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(
      fx,
      tenant,
      course.id,
      subject.id,
      { personId: teacherA, status: "temporal" },
      6,
    );
    const slot = await seedSlot(fx, tenant, campusId, offering, { dayOfWeek: 3 });
    const [assignment] = await assignmentsOf(offering.id);
    audit.reset();
    expect(await call(assignmentRouter.delete, { id: assignment!.id }, { context: owner })).toEqual(
      { deleted: true },
    );
    expect(await assignmentsOf(offering.id)).toHaveLength(0);
    const after = await offeringOf(course.id, subject.id);
    expect(after).toMatchObject({ id: offering.id, teacherPersonId: null, hoursPerWeek: 6 });
    // The slot survives and loses its teacher through the cascade.
    const [kept] = await fx.db
      .select()
      .from(schema.scheduleSlot)
      .where(eq(schema.scheduleSlot.id, slot.id));
    expect(kept?.teacherPersonId).toBeNull();
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.metadata).toEqual({
      offeringId: offering.id,
      from: teacherA,
      to: null,
      status: "temporal",
    });
    expect(
      (await errorOf(call(assignmentRouter.delete, { id: assignment!.id }, { context: owner })))
        ?.code,
    ).toBe("NOT_FOUND");
  });

  test("list, get and stats: default course/subject order, sorts, filters and paging", async () => {
    const t = await fx.provisionTenant("ListaAsig", ["owner", "coordinator", "teacher"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const campus = await seedCampus(fx, t);
    const first = t.people.teacher!.personId;
    const second = await makeSecondTeacher(fx, t);
    const sexto = await seedCourse(fx, t, campus.id, { name: "Sexto", academicYear: "2026" });
    const tercero = await seedCourse(fx, t, campus.id, { name: "Tercero", academicYear: "2027" });
    const mat = await seedSubject(fx, t, { name: "Matemáticas" });
    const art = await seedSubject(fx, t, { name: "Arte" });
    await seedOffering(fx, t, tercero.id, mat.id, { personId: first, status: "inactivo" });
    await seedOffering(fx, t, sexto.id, mat.id, { personId: second, status: "temporal" });
    await seedOffering(fx, t, sexto.id, art.id, { personId: first });
    await seedOffering(fx, t, tercero.id, art.id); // no assignment: not listed

    const all = await call(assignmentRouter.list, {}, { context: ctx });
    expect(all.total).toBe(3);
    expect(all.rows.map((r) => `${r.courseName}/${r.subjectName}`)).toEqual([
      "Sexto/Arte",
      "Sexto/Matemáticas",
      "Tercero/Matemáticas",
    ]);
    expect(all.rows[0]).toMatchObject({
      teacherPersonId: first,
      teacherName: "teacher ListaAsig",
      teacherUsername: t.people.teacher!.username,
      status: "activo",
    });
    const one = await call(assignmentRouter.get, { id: all.rows[1]!.id }, { context: ctx });
    expect(one).toEqual(all.rows[1]!);

    const byTeacher = await call(
      assignmentRouter.list,
      {
        sort: [
          { id: "teacher", desc: true },
          { id: "course", desc: false },
        ],
      },
      { context: ctx },
    );
    expect(byTeacher.rows.map((r) => r.teacherPersonId)).toEqual([first, first, second]);
    const byStatus = await call(
      assignmentRouter.list,
      { sort: [{ id: "status", desc: false }] },
      { context: ctx },
    );
    // Enum declaration order: activo, inactivo, temporal.
    expect(byStatus.rows.map((r) => r.status)).toEqual(["activo", "inactivo", "temporal"]);
    const byDate = await call(
      assignmentRouter.list,
      { sort: [{ id: "assignmentDate", desc: true }] },
      { context: ctx },
    );
    expect(byDate.total).toBe(3);

    const byName = await call(
      assignmentRouter.list,
      { filters: [listFilter("teacher", "text", "iLike", "coordinator")] },
      { context: ctx },
    );
    expect(byName.rows.map((r) => r.teacherPersonId)).toEqual([second]);
    const byStatusFilter = await call(
      assignmentRouter.list,
      { filters: [listFilter("status", "select", "eq", "inactivo")] },
      { context: ctx },
    );
    expect(byStatusFilter.rows.map((r) => r.courseName)).toEqual(["Tercero"]);
    expect(
      (
        await call(
          assignmentRouter.list,
          { filters: [listFilter("courseId", "select", "eq", sexto.id)] },
          { context: ctx },
        )
      ).total,
    ).toBe(2);
    expect(
      (
        await call(
          assignmentRouter.list,
          { filters: [listFilter("subjectId", "select", "eq", art.id)] },
          { context: ctx },
        )
      ).total,
    ).toBe(1);
    expect(
      (
        await call(
          assignmentRouter.list,
          { filters: [listFilter("academicYear", "select", "eq", "2027")] },
          { context: ctx },
        )
      ).total,
    ).toBe(1);
    const paged = await call(assignmentRouter.list, { page: 2, perPage: 2 }, { context: ctx });
    expect(paged.total).toBe(3);
    expect(paged.rows).toHaveLength(1);
    expect(
      (
        await errorOf(
          call(assignmentRouter.list, { sort: [{ id: "organizationId", desc: false }] } as never, {
            context: ctx,
          }),
        )
      )?.code,
    ).toBe("BAD_REQUEST");
    expect(
      (await errorOf(call(assignmentRouter.get, { id: "nope" }, { context: ctx })))?.code,
    ).toBe("NOT_FOUND");

    expect(await call(assignmentRouter.stats, {}, { context: ctx })).toEqual({
      total: 3,
      active: 1,
    });
    expect(await call(assignmentRouter.stats, { academicYear: "2026" }, { context: ctx })).toEqual({
      total: 2,
      active: 1,
    });
  });
});

await testPermissionMatrix({
  name: "assignment",
  procedures: [
    {
      name: "assignment.list",
      permissions: { offering: ["read"] },
      run: (context) => call(assignmentRouter.list, {}, { context }),
    },
    {
      name: "assignment.stats",
      permissions: { offering: ["read"] },
      run: (context) => call(assignmentRouter.stats, {}, { context }),
    },
    {
      name: "assignment.get",
      permissions: { offering: ["read"] },
      run: (context) => call(assignmentRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "assignment.assign",
      permissions: { offering: ["update"] },
      run: (context) =>
        call(
          assignmentRouter.assign,
          { courseId: "missing", subjectId: "missing", teacherPersonId: "missing" },
          { context },
        ),
    },
    {
      name: "assignment.update",
      permissions: { offering: ["update"] },
      run: (context) =>
        call(assignmentRouter.update, { id: "missing", status: "activo" }, { context }),
    },
    {
      name: "assignment.delete",
      permissions: { offering: ["update"] },
      run: (context) => call(assignmentRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = {
  courseId: string;
  subjectId: string;
  offeringId: string;
  assignmentId: string;
  teacherPersonId: string;
  courseName: string;
};
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const course = await seedCourse(fx, tenant, campus.id, { name: `Aislado ${tenant.slug}` });
  const subject = await seedSubject(fx, tenant);
  const teacherPersonId = tenant.people.teacher!.personId;
  const offering = await seedOffering(fx, tenant, course.id, subject.id, {
    personId: teacherPersonId,
  });
  const [assignment] = await fx.db
    .select()
    .from(schema.teacherAssignment)
    .where(eq(schema.teacherAssignment.offeringId, offering.id));
  return {
    courseId: course.id,
    subjectId: subject.id,
    offeringId: offering.id,
    assignmentId: assignment!.id,
    teacherPersonId,
    courseName: course.name,
  };
};
const intact = async (foreign: Seed, fx: SigeTestFixture) => {
  const [assignment] = await fx.db
    .select()
    .from(schema.teacherAssignment)
    .where(eq(schema.teacherAssignment.id, foreign.assignmentId));
  expect(assignment).toMatchObject({ status: "activo", teacherPersonId: foreign.teacherPersonId });
  const [offering] = await fx.db
    .select()
    .from(schema.offering)
    .where(eq(schema.offering.id, foreign.offeringId));
  expect(offering?.teacherPersonId).toBe(foreign.teacherPersonId);
};

await testTenantIsolation({
  name: "assignment",
  cases: [
    isolationCase({
      name: "assignment.list never returns the other tenant's assignments",
      seed,
      run: ({ context }) => call(assignmentRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.assignmentId, foreign.offeringId, foreign.courseName],
    }),
    isolationCase({
      name: "assignment.list filtered by a foreign course returns nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          assignmentRouter.list,
          { filters: [listFilter("courseId", "select", "eq", foreign.courseId)] },
          { context },
        ),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.assignmentId, foreign.courseName],
    }),
    isolationCase({
      name: "assignment.stats never counts the other tenant's assignments",
      seed,
      run: ({ context }) => call(assignmentRouter.stats, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.assignmentId],
    }),
    isolationCase({
      name: "assignment.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(assignmentRouter.get, { id: foreign.assignmentId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "assignment.assign with a foreign course is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, own, foreign }) =>
        call(
          assignmentRouter.assign,
          {
            courseId: foreign.courseId,
            subjectId: own.subjectId,
            teacherPersonId: own.teacherPersonId,
          },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "assignment.assign with a foreign teacher is rejected and changes nothing",
      seed,
      run: async ({ context, own, foreign }) => {
        const error = await errorOf(
          call(
            assignmentRouter.assign,
            {
              courseId: own.courseId,
              subjectId: own.subjectId,
              teacherPersonId: foreign.teacherPersonId,
            },
            { context },
          ),
        );
        expect(error?.code).toBe("BAD_REQUEST");
        throw new ORPCError("NOT_FOUND");
      },
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "assignment.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          assignmentRouter.update,
          { id: foreign.assignmentId, status: "inactivo" },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "assignment.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(assignmentRouter.delete, { id: foreign.assignmentId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
  ],
});

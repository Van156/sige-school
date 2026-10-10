import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
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
import { seedCampus, seedStudent } from "../../sige/testing/scheduling-seed";
import { guardianRouter } from "./guardian";
import { studentRouter } from "./student";

/** `guardian.*` (sige/05 §3.1, STU-04, STU-R6, D5): candidates, link, unlink. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

/** A login of `tenant` with member `role` (comma list allowed) and a person row. */
async function seedMemberPerson(
  fx: SigeTestFixture,
  tenant: TestTenant,
  role: string,
  values: {
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
    documentNumber?: string;
  } = {},
) {
  const tag = crypto.randomUUID().slice(0, 8);
  const userId = `u-grd-${tag}`;
  await fx.db
    .insert(schema.user)
    .values({ id: userId, name: "G", email: `${userId}@x.test`, username: `acu${tag}` });
  await fx.db
    .insert(schema.member)
    .values({ id: crypto.randomUUID(), organizationId: tenant.orgId, userId, role });
  const [person] = await fx.db
    .insert(schema.person)
    .values({
      organizationId: tenant.orgId,
      userId,
      firstName: values.firstName ?? "Acudiente",
      lastName: values.lastName ?? tag,
      documentType: "CC",
      documentNumber: values.documentNumber ?? `6${Date.now() % 1_000_000}${tag.slice(0, 4)}`,
      isActive: values.isActive ?? true,
    })
    .returning();
  return { personId: person!.id, username: `acu${tag}`, documentNumber: person!.documentNumber };
}

await sigeSuite("guardian router", (fx) => {
  let tenant: TestTenant;
  let coordinator: Context;
  let audit: RecordingAuditLogger;
  let studentId: string;
  let otherStudentId: string;
  let parentA: Awaited<ReturnType<typeof seedMemberPerson>>;
  let parentB: Awaited<ReturnType<typeof seedMemberPerson>>;
  let multiRole: Awaited<ReturnType<typeof seedMemberPerson>>;
  let inactiveParent: Awaited<ReturnType<typeof seedMemberPerson>>;
  let teacherPerson: Awaited<ReturnType<typeof seedMemberPerson>>;

  const candidates = (input: Record<string, unknown> = {}) =>
    call(guardianRouter.candidates, { studentId, ...input } as never, { context: coordinator });
  const link = (guardianPersonId: string, relationship = "Madre", target = studentId) =>
    call(guardianRouter.link, { studentId: target, guardianPersonId, relationship } as never, {
      context: coordinator,
    });
  const links = () =>
    fx.db
      .select()
      .from(schema.studentGuardian)
      .where(eq(schema.studentGuardian.organizationId, tenant.orgId));

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Acudientes", ["owner", "coordinator", "teacher"]);
    coordinator = await fx.contextFor(tenant.people.coordinator!, tenant);
    audit = coordinator.auditLogger as RecordingAuditLogger;
    const campus = await seedCampus(fx, tenant);
    studentId = (await seedStudent(fx, tenant, campus.id)).id;
    otherStudentId = (await seedStudent(fx, tenant, campus.id)).id;
    parentA = await seedMemberPerson(fx, tenant, "parent", {
      firstName: "Patricia",
      lastName: "Gómez",
    });
    parentB = await seedMemberPerson(fx, tenant, "parent", {
      firstName: "Rodrigo",
      lastName: "Zapata",
    });
    multiRole = await seedMemberPerson(fx, tenant, "teacher, parent", {
      firstName: "Lucía",
      lastName: "Mora",
    });
    inactiveParent = await seedMemberPerson(fx, tenant, "parent", {
      firstName: "Inactivo",
      lastName: "Acudiente",
      isActive: false,
    });
    teacherPerson = await seedMemberPerson(fx, tenant, "teacher", {
      firstName: "Profe",
      lastName: "Solo",
    });
  });

  // --- candidates --------------------------------------------------------------------------

  test("candidates lists active parent persons (also multi-role) sorted by name", async () => {
    const rows = await candidates();
    expect(rows.map((row) => row.personId)).toEqual([
      parentA.personId,
      multiRole.personId,
      parentB.personId,
    ]);
    expect(rows[0]).toEqual({
      personId: parentA.personId,
      name: "Patricia Gómez",
      username: parentA.username,
      document: parentA.documentNumber,
    });
  });

  test("candidates searches by name, username or document and honours the limit", async () => {
    expect((await candidates({ search: "zapata" })).map((r) => r.personId)).toEqual([
      parentB.personId,
    ]);
    expect((await candidates({ search: parentA.username })).map((r) => r.personId)).toEqual([
      parentA.personId,
    ]);
    expect((await candidates({ search: multiRole.documentNumber })).map((r) => r.personId)).toEqual(
      [multiRole.personId],
    );
    expect((await candidates({ search: "rodrigo zap" })).map((r) => r.personId)).toEqual([
      parentB.personId,
    ]);
    expect(await candidates({ limit: 1 })).toHaveLength(1);
  });

  test("candidates of an unknown student is NOT_FOUND", async () => {
    const error = await errorOf(
      call(guardianRouter.candidates, { studentId: "missing" }, { context: coordinator }),
    );
    expect(error?.code).toBe("NOT_FOUND");
    expect(error?.message).toBe("El estudiante no existe.");
  });

  // --- link ----------------------------------------------------------------------------------

  test("link stores the relationship, returns the GuardianLink and audits guardian.linked", async () => {
    audit.reset();
    const result = await link(parentA.personId, "Madre");
    expect(result).toEqual({
      guardianPersonId: parentA.personId,
      name: "Patricia Gómez",
      username: parentA.username,
      relationship: "Madre",
      // Placeholder-free seed address is not a real email (OD-1).
      email: null,
      phone: null,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "guardian.linked",
      targetType: "student",
      targetId: studentId,
      metadata: { studentId, guardianPersonId: parentA.personId, relationship: "Madre" },
    });
    const detail = await call(studentRouter.get, { id: studentId }, { context: coordinator });
    expect(detail.guardians.map((g) => g.guardianPersonId)).toEqual([parentA.personId]);
  });

  test("a linked guardian is no longer a candidate of that student, but still of another", async () => {
    expect((await candidates()).map((row) => row.personId)).not.toContain(parentA.personId);
    expect((await candidates({ studentId: otherStudentId })).map((row) => row.personId)).toContain(
      parentA.personId,
    );
  });

  test("link refuses a duplicate with the STU-R6 message", async () => {
    audit.reset();
    const error = await errorOf(link(parentA.personId, "Padre"));
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("Este acudiente ya está vinculado a este estudiante.");
    expect(audit.events).toHaveLength(0);
  });

  test("link refuses a non-parent, an inactive parent (D5) and an unknown person", async () => {
    const before = (await links()).length;
    for (const personId of [teacherPerson.personId, inactiveParent.personId, "missing"]) {
      const error = await errorOf(link(personId));
      expect(error?.code).toBe("BAD_REQUEST");
      expect(error?.message).toBe("El usuario seleccionado no es un acudiente.");
    }
    expect((await links()).length).toBe(before);
  });

  test("link refuses a parent of another institution as not a guardian", async () => {
    const other = await fx.provisionTenant("OtroAcudiente", ["parent"]);
    const error = await errorOf(link(other.people.parent!.personId));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("El usuario seleccionado no es un acudiente.");
  });

  test("link to an unknown student is NOT_FOUND", async () => {
    const error = await errorOf(link(parentB.personId, "Padre", "missing"));
    expect(error?.code).toBe("NOT_FOUND");
  });

  test("link rejects an unknown relationship and a missing guardian (schema)", async () => {
    const bad = await errorOf(link(parentB.personId, "Vecino"));
    expect(bad?.code).toBe("BAD_REQUEST");
    const none = await errorOf(link(""));
    expect(none?.code).toBe("BAD_REQUEST");
  });

  test("a guardian may have many students (multi-role person too)", async () => {
    await link(parentA.personId, "Madre", otherStudentId);
    await link(multiRole.personId, "Tío/a");
    const rows = await fx.db
      .select()
      .from(schema.studentGuardian)
      .where(eq(schema.studentGuardian.guardianPersonId, parentA.personId));
    expect(rows).toHaveLength(2);
  });

  // --- unlink --------------------------------------------------------------------------------

  test("unlink removes the link only, audits guardian.unlinked, and a second unlink is NOT_FOUND", async () => {
    audit.reset();
    expect(
      await call(
        guardianRouter.unlink,
        { studentId, guardianPersonId: multiRole.personId },
        { context: coordinator },
      ),
    ).toEqual({ deleted: true });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "guardian.unlinked",
      targetType: "student",
      targetId: studentId,
      metadata: { studentId, guardianPersonId: multiRole.personId, relationship: "Tío/a" },
    });
    const [person] = await fx.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.id, multiRole.personId));
    expect(person?.isActive).toBe(true);
    const remaining = await fx.db
      .select()
      .from(schema.studentGuardian)
      .where(
        and(
          eq(schema.studentGuardian.studentId, studentId),
          eq(schema.studentGuardian.guardianPersonId, multiRole.personId),
        ),
      );
    expect(remaining).toHaveLength(0);

    const again = await errorOf(
      call(
        guardianRouter.unlink,
        { studentId, guardianPersonId: multiRole.personId },
        { context: coordinator },
      ),
    );
    expect(again?.code).toBe("NOT_FOUND");
    expect(again?.message).toBe("El acudiente no está vinculado a este estudiante.");
  });

  test("unlink of an unknown student is NOT_FOUND", async () => {
    const error = await errorOf(
      call(
        guardianRouter.unlink,
        { studentId: "missing", guardianPersonId: parentA.personId },
        { context: coordinator },
      ),
    );
    expect(error?.code).toBe("NOT_FOUND");
    expect(error?.message).toBe("El estudiante no existe.");
  });
});

await testPermissionMatrix({
  name: "guardian",
  procedures: [
    {
      name: "guardian.candidates",
      permissions: { student: ["guardians"] },
      run: (context) => call(guardianRouter.candidates, { studentId: "missing" }, { context }),
    },
    {
      name: "guardian.link",
      permissions: { student: ["guardians"] },
      run: (context) =>
        call(
          guardianRouter.link,
          { studentId: "missing", guardianPersonId: "missing", relationship: "Madre" },
          { context },
        ),
    },
    {
      name: "guardian.unlink",
      permissions: { student: ["guardians"] },
      run: (context) =>
        call(
          guardianRouter.unlink,
          { studentId: "missing", guardianPersonId: "missing" },
          { context },
        ),
    },
  ],
});

type Seed = {
  studentId: string;
  parentPersonId: string;
  parentName: string;
  linkedParentPersonId: string;
};
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const student = await seedStudent(fx, tenant, campus.id);
  const parent = await seedMemberPerson(fx, tenant, "parent", {
    firstName: "Foráneo",
    lastName: `Acudiente${tenant.slug}`,
  });
  const linked = await seedMemberPerson(fx, tenant, "parent");
  await fx.db.insert(schema.studentGuardian).values({
    organizationId: tenant.orgId,
    studentId: student.id,
    guardianPersonId: linked.personId,
    relationship: "Padre",
  });
  return {
    studentId: student.id,
    parentPersonId: parent.personId,
    parentName: `Acudiente${tenant.slug}`,
    linkedParentPersonId: linked.personId,
  };
};
const intact = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.studentGuardian)
    .where(eq(schema.studentGuardian.studentId, foreign.studentId));
  expect(rows.map((row) => row.guardianPersonId)).toEqual([foreign.linkedParentPersonId]);
  const parentLinks = await fx.db
    .select()
    .from(schema.studentGuardian)
    .where(eq(schema.studentGuardian.guardianPersonId, foreign.parentPersonId));
  expect(parentLinks).toHaveLength(0);
};

await testTenantIsolation({
  name: "guardian",
  cases: [
    isolationCase({
      name: "guardian.candidates of a foreign student is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(guardianRouter.candidates, { studentId: foreign.studentId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "guardian.candidates never lists the other tenant's parents",
      seed,
      run: ({ context, own }) =>
        call(guardianRouter.candidates, { studentId: own.studentId }, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.parentPersonId, foreign.parentName],
    }),
    isolationCase({
      name: "guardian.link to a foreign student is NOT_FOUND and writes nothing",
      seed,
      run: ({ context, own, foreign }) =>
        call(
          guardianRouter.link,
          {
            studentId: foreign.studentId,
            guardianPersonId: own.parentPersonId,
            relationship: "Madre",
          },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
    isolationCase({
      name: "guardian.unlink of a foreign link is NOT_FOUND and keeps it",
      seed,
      run: ({ context, foreign }) =>
        call(
          guardianRouter.unlink,
          { studentId: foreign.studentId, guardianPersonId: foreign.linkedParentPersonId },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: intact,
    }),
  ],
});

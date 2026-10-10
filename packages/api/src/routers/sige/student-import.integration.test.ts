import type { RecordingAuditLogger } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { STUDENT_IMPORT_COLUMNS } from "@base-template/sige-core";
import { call, ORPCError } from "@orpc/server";
import { verifyPassword } from "better-auth/crypto";
import ExcelJS from "exceljs";
import { and, count, eq, inArray } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import type { ImportJobRunnerPort } from "../../sige/import-runner";
import {
  createTrackedImportRunner,
  isolationCase,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { TestTenant } from "../../sige/testing";
import {
  seedCampus,
  seedCourse,
  seedOffering,
  seedStudent,
  seedSubject,
} from "../../sige/testing/scheduling-seed";
import { studentRouter } from "./student";
import { importJobRouter, userRouter } from "./user";

/** STU-05 API (sige/05 §3.1, STU-R2 path C, STU-R3, STU-R8): preview, template, start, job. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const HEADER = STUDENT_IMPORT_COLUMNS.map((column) => column.field);
const COL = Object.fromEntries(HEADER.map((field, index) => [field, index])) as Record<
  (typeof HEADER)[number],
  number
>;

async function xlsx(rows: unknown[][], name = "estudiantes.xlsx", header = HEADER) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Estudiantes");
  sheet.addRow([...header]);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return new File([await workbook.xlsx.writeBuffer()], name);
}

let seq = 0;
const stamp = String(Date.now() % 1_000_000).padStart(6, "0");
const documentNo = () => `6${stamp}${String(seq++).padStart(5, "0")}`;

/** A valid row for course `6-01` of the main campus, overridable per column. */
const goodRow = (values: Partial<Record<(typeof HEADER)[number], unknown>> = {}) => {
  const row: unknown[] = Array.from({ length: HEADER.length }, () => "");
  row[COL.nombre] = "Laura";
  row[COL.apellido] = `Prueba${seq}`;
  row[COL.documento] = documentNo();
  row[COL.grado] = "6-01";
  for (const [field, value] of Object.entries(values)) {
    row[COL[field as (typeof HEADER)[number]]] = value;
  }
  return row;
};

/** 100 data rows: 94 good, 6 bad in rows 5, 20, 33, 47, 60 and 90 (Excel numbering). */
function hundredRows() {
  const rows = Array.from({ length: 100 }, () => goodRow());
  rows[3] = goodRow({ documento: "" }); // row 5
  rows[18] = goodRow({ grado: "99-99" }); // row 20
  rows[31] = goodRow({ email_acudiente: "no-es-correo" }); // row 33
  rows[45] = goodRow({ tipo_documento: "XX" }); // row 47
  rows[58] = goodRow({ estrato: 9 }); // row 60
  rows[88] = [...rows[0]!]; // row 90: same document as row 2
  return rows;
}
const BAD_ROWS = [5, 20, 33, 47, 60, 90];

/** A runner that holds every task until `release()`, to act between start and execution. */
function deferredRunner(): ImportJobRunnerPort & { release(): Promise<void> } {
  const tasks: (() => Promise<void>)[] = [];
  return {
    run(task) {
      tasks.push(task);
    },
    async release() {
      await Promise.all(tasks.splice(0).map((task) => task()));
    },
  };
}

await sigeSuite("student import (API)", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let coordinator: Context;
  let mainCampusId: string;
  let course601: { id: string };
  let offerings: { id: string }[];
  let runner = createTrackedImportRunner();

  const ctx = (context: Context): Context => ({ ...context, importRunner: runner });
  const preview = (file: File, context = owner) =>
    call(studentRouter.importPreview, { file }, { context: ctx(context) });
  const start = (file: File, context = owner) =>
    call(studentRouter.importStart, { file }, { context: ctx(context) });
  const getJob = (jobId: string, context = owner) =>
    call(importJobRouter.get, { jobId }, { context: ctx(context) });
  const events = (context: Context) => (context.auditLogger as RecordingAuditLogger).events;
  const counts = async () => ({
    people: (
      await fx.db
        .select({ n: count() })
        .from(schema.person)
        .where(eq(schema.person.organizationId, tenant.orgId))
    )[0]!.n,
    students: (
      await fx.db
        .select({ n: count() })
        .from(schema.student)
        .where(eq(schema.student.organizationId, tenant.orgId))
    )[0]!.n,
    jobs: (await fx.db.select({ n: count() }).from(schema.importJob))[0]!.n,
  });
  const personByDocument = async (documentNumber: string) =>
    (
      await fx.db
        .select()
        .from(schema.person)
        .where(
          and(
            eq(schema.person.organizationId, tenant.orgId),
            eq(schema.person.documentNumber, documentNumber),
          ),
        )
    )[0];

  test("provisions the tenant with campuses, courses and offerings", async () => {
    tenant = await fx.provisionTenant("ImpEst", ["owner", "coordinator", "teacher"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    coordinator = await fx.contextFor(tenant.people.coordinator!, tenant);
    const main = await seedCampus(fx, tenant, { name: "Principal", code: "P", isMain: true });
    const north = await seedCampus(fx, tenant, { name: "Norte", code: "N" });
    const closed = await seedCampus(fx, tenant, { name: "Cerrada", code: "C", active: false });
    mainCampusId = main.id;
    course601 = await seedCourse(fx, tenant, main.id, { name: "6-01" });
    offerings = [];
    for (const name of ["Matemáticas", "Español"]) {
      const subject = await seedSubject(fx, tenant, { name: `${name} ${stamp}` });
      offerings.push(await seedOffering(fx, tenant, course601.id, subject.id));
    }
    await seedCourse(fx, tenant, main.id, { name: "7-01" });
    await seedCourse(fx, tenant, north.id, { name: "7-01" });
    await seedCourse(fx, tenant, closed.id, { name: "9-01" });
    await seedCourse(fx, tenant, main.id, { name: "8-01", academicYear: "2019" });
  });

  test("a 100-row preview reports the 6 bad rows with Excel row numbers and writes nothing", async () => {
    const before = { ...(await counts()), events: events(owner).length };
    const result = await preview(await xlsx(hundredRows()));
    expect(result).toMatchObject({ total: 100, valid: 94, invalid: 6 });
    expect(result.errors.map((error) => error.row)).toEqual(BAD_ROWS);
    expect(result.errors.map((error) => error.message)).toEqual([
      "Fila 5: Falta el documento.",
      'Fila 20: El grado "99-99" no existe.',
      "Fila 33: Ingresa un correo válido.",
      'Fila 47: Tipo de documento inválido "XX".',
      "Fila 60: El estrato debe estar entre 1 y 6.",
      expect.stringMatching(/^Fila 90: El documento ".+" está repetido en el archivo\.$/),
    ]);
    expect(result.rows).toHaveLength(50);
    expect(result.rows[0]).toMatchObject({
      row: 2,
      nombre: "Laura",
      grado: "6-01",
      valid: true,
      message: null,
    });
    expect(result.rows.find((row) => row.row === 5)).toMatchObject({
      valid: false,
      message: "Fila 5: Falta el documento.",
    });
    expect({ ...(await counts()), events: events(owner).length }).toEqual(before);
  });

  test("preview resolves courses and campuses of the current year and active campuses only", async () => {
    const result = await preview(
      await xlsx([
        goodRow({ grado: "7-01" }), // 2: ambiguous
        goodRow({ grado: "7-01", sede: "norte" }), // 3: disambiguated by name
        goodRow({ grado: "7-01", sede: "P" }), // 4: disambiguated by code
        goodRow({ grado: "", sede: "" }), // 5: main campus, no course
        goodRow({ grado: "", sede: "Sur" }), // 6: unknown campus
        goodRow({ grado: "8-01" }), // 7: other academic year
        goodRow({ grado: "9-01" }), // 8: course of an inactive campus
        goodRow({ grado: "", sede: "Cerrada" }), // 9: inactive campus by name
      ]),
    );
    expect(result.errors).toEqual([
      { row: 2, message: 'Fila 2: El grado "7-01" es ambiguo; indique la sede.' },
      { row: 6, message: 'Fila 6: La sede "Sur" no existe.' },
      { row: 7, message: 'Fila 7: El grado "8-01" no existe.' },
      { row: 8, message: "Fila 8: La sede seleccionada está inactiva." },
      { row: 9, message: 'Fila 9: La sede "Cerrada" no existe.' },
    ]);
    expect(result).toMatchObject({ total: 8, valid: 3, invalid: 5 });
  });

  test("preview flags existing students and existing users by document", async () => {
    const existing = await seedStudent(fx, tenant, mainCampusId, { documentNumber: documentNo() });
    const teacher = tenant.people.teacher!;
    const result = await preview(
      await xlsx([
        goodRow({ documento: existing.person.documentNumber }),
        goodRow({ documento: teacher.documentNumber }),
        goodRow(),
      ]),
    );
    expect(result).toMatchObject({ total: 3, valid: 1, invalid: 2 });
    expect(result.errors.map((error) => error.message)).toEqual([
      "Fila 2: Ya existe un estudiante con este documento.",
      "Fila 3: Ya existe un usuario con este documento.",
    ]);
  });

  test("file limits: wrong extension, over 10 MB, over 2,000 rows, missing required column", async () => {
    const xls = await errorOf(preview(new File(["a"], "estudiantes.xls")));
    expect([xls?.code, xls?.message]).toEqual([
      "BAD_REQUEST",
      "Solo se permiten archivos Excel (.xlsx).",
    ]);
    const big = await errorOf(preview(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "x.xlsx")));
    expect(big?.status).toBe(413);
    const rows = Array.from({ length: 2001 }, () => goodRow());
    const many = await errorOf(preview(await xlsx(rows)));
    expect([many?.code, many?.message]).toEqual([
      "BAD_REQUEST",
      "El archivo supera el máximo de 2000 filas.",
    ]);
    const missing = await errorOf(
      preview(await xlsx([["Laura", "1234567"]], "e.xlsx", ["nombres", "documento"] as never)),
    );
    expect([missing?.code, missing?.message]).toEqual([
      "BAD_REQUEST",
      "Faltan columnas obligatorias: apellido.",
    ]);
    const refused = await errorOf(start(await xlsx(rows)));
    expect(refused?.code).toBe("BAD_REQUEST");
    expect((await counts()).jobs).toBe(0);
  });

  test("importTemplate downloads plantilla-estudiantes.xlsx with the 16 STU-R8 columns", async () => {
    const file = await call(studentRouter.importTemplate, undefined, { context: ctx(owner) });
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("plantilla-estudiantes.xlsx");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0]!;
    const header = (sheet.getRow(1).values as unknown[]).slice(1);
    expect(header).toEqual([...HEADER]);
    expect(sheet.actualRowCount).toBe(2);
    // The example row uses the main campus and course 6-01, which this tenant has.
    expect(await preview(file)).toMatchObject({ total: 1, valid: 1, invalid: 0 });
  });

  test("importStart with no valid rows is refused and creates no job", async () => {
    const error = await errorOf(start(await xlsx([goodRow({ documento: "" })])));
    expect([error?.code, error?.message]).toEqual([
      "BAD_REQUEST",
      "El archivo no contiene filas válidas para importar.",
    ]);
    expect((await counts()).jobs).toBe(0);
  });

  test("importStart admits the valid rows in the background: login, profile, enrollments", async () => {
    const before = await counts();
    const rows = hundredRows();
    rows[1] = goodRow({
      tipo_documento: "rc",
      fecha_nacimiento: "20/05/2014",
      genero: "Femenino",
      acudiente: "Ana Pérez",
      telefono_acudiente: "3001234567",
      email_acudiente: "ANA@correo.com",
      direccion: "Calle 1 # 2-3",
      barrio: "Centro",
      estrato: 2,
      tipo_sangre: "O+",
      eps: "Sura",
    });
    const { jobId } = await start(await xlsx(rows));
    expect(await getJob(jobId)).toMatchObject({ kind: "students", total: 100 });
    await runner.settled();

    const job = await getJob(jobId);
    expect(job).toMatchObject({
      status: "done",
      total: 100,
      processed: 100,
      imported: 94,
      skipped: 6,
    });
    expect(job.errors.map((error) => error.row)).toEqual(BAD_ROWS);
    expect(job.finishedAt).not.toBeNull();
    const after = await counts();
    expect(after.people).toBe(before.people + 94);
    expect(after.students).toBe(before.students + 94);

    const person = (await personByDocument(String(rows[1]![COL.documento])))!;
    expect(person).toMatchObject({
      documentType: "RC",
      birthDate: "2014-05-20",
      gender: "F",
      address: "Calle 1 # 2-3",
      mustChangePassword: true,
    });
    const [account] = await fx.db
      .select()
      .from(schema.account)
      .where(
        and(eq(schema.account.userId, person.userId), eq(schema.account.providerId, "credential")),
      );
    expect(
      await verifyPassword({ hash: account!.password!, password: String(rows[1]![COL.documento]) }),
    ).toBe(true);
    const [member] = await fx.db
      .select()
      .from(schema.member)
      .where(
        and(
          eq(schema.member.organizationId, tenant.orgId),
          eq(schema.member.userId, person.userId),
        ),
      );
    expect(member!.role).toBe("student");
    const [profile] = await fx.db
      .select()
      .from(schema.student)
      .where(eq(schema.student.personId, person.id));
    expect(profile).toMatchObject({
      campusId: mainCampusId,
      courseId: course601.id,
      status: "activo",
      neighborhood: "Centro",
      stratum: 2,
      bloodType: "O+",
      eps: "Sura",
      guardianName: "Ana Pérez",
      guardianPhone: "3001234567",
      guardianEmail: "ana@correo.com",
    });
    // STU-R3: one active enrollment per offering of the course.
    const enrolled = await fx.db
      .select()
      .from(schema.enrollment)
      .where(eq(schema.enrollment.studentId, profile!.id));
    expect(enrolled.map((row) => row.offeringId).toSorted()).toEqual(
      offerings.map((offering) => offering.id).toSorted(),
    );
    expect(enrolled.every((row) => row.status === "activa")).toBe(true);

    // One event per job, no per-student rows (§3.2), no document in the metadata.
    const imported = events(owner).filter((event) => event.action === "student.imported");
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      targetType: "import_job",
      targetId: jobId,
      actorUserId: tenant.people.owner!.userId,
      metadata: { jobId, total: 100, imported: 94, skipped: 6 },
    });
    expect(
      events(owner).some(
        (event) =>
          (event.action === "student.created" || event.action === "user.created") &&
          event.metadata?.personId === person.id,
      ),
    ).toBe(false);
    expect(JSON.stringify(imported[0]!.metadata)).not.toContain(String(rows[1]![COL.documento]));
  });

  test("re-importing the same file skips existing students instead of duplicating them", async () => {
    runner = createTrackedImportRunner();
    const rows = [goodRow(), goodRow({ grado: "" })];
    const file = await xlsx(rows);
    const first = await start(file);
    await runner.settled();
    expect(await getJob(first.jobId)).toMatchObject({ status: "done", imported: 2, skipped: 0 });
    const after = await counts();

    const again = await errorOf(start(file));
    expect(again?.message).toBe("El archivo no contiene filas válidas para importar.");
    expect((await preview(file)).errors.map((error) => error.message)).toEqual([
      "Fila 2: Ya existe un estudiante con este documento.",
      "Fila 3: Ya existe un estudiante con este documento.",
    ]);
    expect((await counts()).students).toBe(after.students);
  });

  test("a row that fails while the job runs is skipped with its message; the rest import", async () => {
    const deferred = deferredRunner();
    const rows = [goodRow(), goodRow(), goodRow()];
    const { jobId } = await call(
      studentRouter.importStart,
      { file: await xlsx(rows) },
      { context: { ...owner, importRunner: deferred } },
    );
    // Between validation and execution another path takes row 3's document.
    await seedStudent(fx, tenant, mainCampusId, {
      documentNumber: String(rows[1]![COL.documento]),
    });
    await deferred.release();

    const job = await getJob(jobId);
    expect(job).toMatchObject({ status: "done", processed: 3, imported: 2, skipped: 1 });
    expect(job.errors).toEqual([
      { row: 3, message: "Fila 3: Ya existe un usuario con este documento." },
    ]);
    // The failed row left no second person behind (the admission is one transaction).
    const people = await fx.db
      .select()
      .from(schema.person)
      .where(
        and(
          eq(schema.person.organizationId, tenant.orgId),
          inArray(schema.person.documentNumber, [String(rows[1]![COL.documento])]),
        ),
      );
    expect(people).toHaveLength(1);
  });

  test("a second student import while one runs is a CONFLICT; a user import is independent", async () => {
    const deferred = deferredRunner();
    const held = { ...owner, importRunner: deferred };
    const first = await call(
      studentRouter.importStart,
      { file: await xlsx([goodRow()]) },
      {
        context: held,
      },
    );
    const second = await errorOf(
      call(studentRouter.importStart, { file: await xlsx([goodRow()]) }, { context: held }),
    );
    expect([second?.code, second?.status, second?.message]).toEqual([
      "CONFLICT",
      409,
      "Ya hay una importación en curso.",
    ]);

    // D7/USR-R12: the running-job rule is per kind, so a user import may start meanwhile.
    const userFile = new ExcelJS.Workbook();
    userFile.addWorksheet("Usuarios").addRows([
      ["nombres", "apellidos", "tipo_documento", "documento", "rol"],
      ["Pedro", "Gil", "CC", documentNo(), "profesor"],
    ]);
    const users = await call(
      userRouter.importStart,
      { file: new File([await userFile.xlsx.writeBuffer()], "u.xlsx") },
      { context: held },
    );
    expect(users.jobId).toBeString();

    await deferred.release();
    expect((await getJob(first.jobId)).status).toBe("done");
    expect((await getJob(users.jobId)).status).toBe("done");
  });

  test("importJob.get: a student:import holder sees students jobs, not other users jobs", async () => {
    runner = createTrackedImportRunner();
    const { jobId } = await start(await xlsx([goodRow()]));
    await runner.settled();
    // The coordinator holds student:import (not user:import) and did not create the job.
    expect((await getJob(jobId, coordinator)).status).toBe("done");

    const [usersJob] = await fx.db
      .insert(schema.importJob)
      .values({
        organizationId: tenant.orgId,
        kind: "users",
        status: "done",
        createdBy: tenant.people.owner!.personId,
      })
      .returning();
    const hidden = await errorOf(getJob(usersJob!.id, coordinator));
    expect(hidden?.code).toBe("NOT_FOUND");
  });

  test("a coordinator can import students (student:import)", async () => {
    runner = createTrackedImportRunner();
    const rows = [goodRow()];
    const { jobId } = await start(await xlsx(rows), coordinator);
    await runner.settled();
    expect(await getJob(jobId, coordinator)).toMatchObject({ status: "done", imported: 1 });
    const imported = events(coordinator).filter((event) => event.action === "student.imported");
    expect(imported.at(-1)).toMatchObject({
      targetId: jobId,
      actorUserId: tenant.people.coordinator!.userId,
    });
  });
});

await testPermissionMatrix({
  name: "student import",
  procedures: [
    {
      name: "student.importPreview",
      permissions: { student: ["import"] },
      run: async (context) =>
        call(studentRouter.importPreview, { file: await xlsx([]) }, { context }),
    },
    {
      name: "student.importStart",
      permissions: { student: ["import"] },
      // No valid row: an allowed caller is refused with a domain error before any job exists.
      run: async (context) =>
        call(studentRouter.importStart, { file: await xlsx([]) }, { context }),
    },
    {
      name: "student.importTemplate",
      permissions: { student: ["import"] },
      run: (context) => call(studentRouter.importTemplate, undefined, { context }),
    },
  ],
});

await testTenantIsolation({
  name: "student import",
  cases: [
    isolationCase({
      name: "importPreview never reports a foreign document as existing",
      seed: async (tenant, fixture) => {
        const campus = await seedCampus(fixture, tenant, { isMain: true });
        const student = await seedStudent(fixture, tenant, campus.id, {
          documentNumber: documentNo(),
        });
        return { student, owner: tenant.people.owner! };
      },
      run: async ({ context, foreign }) => {
        const result = await call(
          studentRouter.importPreview,
          {
            file: await xlsx([
              goodRow({ documento: foreign.student.person.documentNumber, grado: "" }),
              goodRow({ documento: foreign.owner.documentNumber, grado: "" }),
            ]),
          },
          { context },
        );
        expect(result.errors.map((error) => error.message)).not.toContain(
          "Fila 2: Ya existe un estudiante con este documento.",
        );
        expect(result.errors.map((error) => error.message)).not.toContain(
          "Fila 3: Ya existe un usuario con este documento.",
        );
        return { valid: result.valid, invalid: result.invalid, errors: result.errors };
      },
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.student.id, foreign.owner.personId],
    }),
    isolationCase({
      name: "importPreview never resolves a foreign course or campus",
      seed: async (tenant, fixture) => {
        const campus = await seedCampus(fixture, tenant, {
          name: `Ajena ${crypto.randomUUID().slice(0, 6)}`,
        });
        const course = await seedCourse(fixture, tenant, campus.id, {
          name: `F-${crypto.randomUUID().slice(0, 6)}`,
        });
        return { campus, course };
      },
      run: async ({ context, foreign }) => {
        const result = await call(
          studentRouter.importPreview,
          {
            file: await xlsx([
              goodRow({ grado: foreign.course.name, sede: "" }),
              goodRow({ grado: "", sede: foreign.campus.name }),
            ]),
          },
          { context },
        );
        expect(result.errors.map((error) => error.message)).toEqual([
          `Fila 2: El grado "${foreign.course.name}" no existe.`,
          `Fila 3: La sede "${foreign.campus.name}" no existe.`,
        ]);
        return { valid: result.valid, invalid: result.invalid, errors: result.errors };
      },
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.campus.id, foreign.course.id],
    }),
  ],
});

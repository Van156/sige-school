import type { RecordingAuditLogger } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { call, ORPCError } from "@orpc/server";
import { verifyPassword } from "better-auth/crypto";
import ExcelJS from "exceljs";
import { and, count, eq } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import {
  createTrackedImportRunner,
  isolationCase,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { TestTenant } from "../../sige/testing";
import { importJobRouter, userRouter } from "./user";

/** USR-04 API (sige/03 §3.3, USR-R11/R12): preview, template, start, job status. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const HEADER = ["nombres", "apellidos", "tipo_documento", "documento", "rol", "correo", "telefono"];

async function xlsx(rows: unknown[][], name = "usuarios.xlsx"): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Usuarios");
  sheet.addRow(HEADER);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return new File([await workbook.xlsx.writeBuffer()], name);
}

let seq = 0;
const stamp = String(Date.now() % 1_000_000).padStart(6, "0");
const documentNo = () => `8${stamp}${String(seq++).padStart(5, "0")}`;
const goodRow = (role = "profesor", extra: Partial<Record<number, unknown>> = {}) => {
  const document = documentNo();
  const row: unknown[] = ["María", `Prueba${seq}`, "CC", document, role, "", "3001234567"];
  for (const [index, value] of Object.entries(extra)) {
    row[Number(index)] = value;
  }
  return row;
};

/** 100 data rows: 94 good, 6 bad in rows 5, 20, 33, 47, 60 and 90 (Excel numbering). */
function hundredRows() {
  const rows = Array.from({ length: 100 }, () => goodRow());
  rows[3] = goodRow("profesor", { 3: "" }); // row 5: missing document
  rows[18] = goodRow("director"); // row 20: invalid role
  rows[31] = goodRow("profesor", { 5: "no-es-correo" }); // row 33: bad email
  rows[45] = goodRow("profesor", { 2: "XX" }); // row 47: bad document type
  rows[58] = goodRow("profesor", { 0: "" }); // row 60: missing name
  rows[88] = [...rows[0]!]; // row 90: same document as row 2
  return rows;
}
const BAD_ROWS = [5, 20, 33, 47, 60, 90];

await sigeSuite("user import (API)", (fx) => {
  let tenant: TestTenant;
  let other: TestTenant;
  let owner: Context;
  let admin: Context;
  let runner = createTrackedImportRunner();

  const ctx = (context: Context): Context => ({ ...context, importRunner: runner });
  const preview = (file: File, context = owner) =>
    call(userRouter.importPreview, { file }, { context: ctx(context) });
  const start = (file: File, context = owner) =>
    call(userRouter.importStart, { file }, { context: ctx(context) });
  const getJob = (jobId: string, context = owner) =>
    call(importJobRouter.get, { jobId }, { context: ctx(context) });
  const events = (context: Context) => (context.auditLogger as RecordingAuditLogger).events;
  const people = async (organizationId: string) =>
    (
      await fx.db
        .select({ n: count() })
        .from(schema.person)
        .where(eq(schema.person.organizationId, organizationId))
    )[0]!.n;
  const jobs = async () => (await fx.db.select({ n: count() }).from(schema.importJob))[0]!.n;

  test("provisions tenants", async () => {
    tenant = await fx.provisionTenant("Importar", ["owner", "admin"]);
    other = await fx.provisionTenant("OtraImp", ["owner"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    admin = await fx.contextFor(tenant.people.admin!, tenant);
  });

  test("a 100-row preview reports the 6 bad rows with Excel row numbers and writes nothing", async () => {
    const before = {
      people: await people(tenant.orgId),
      jobs: await jobs(),
      events: events(owner).length,
    };
    const result = await preview(await xlsx(hundredRows()));
    expect(result).toMatchObject({ total: 100, valid: 94, invalid: 6 });
    expect(result.errors.map((error) => error.row)).toEqual(BAD_ROWS);
    expect(result.errors[0]!.message).toBe("Fila 5: Falta el documento.");
    expect(result.errors[1]!.message).toBe('Fila 20: Rol inválido "director".');
    expect(result.errors.at(-1)!.message).toMatch(
      /^Fila 90: El documento ".+" está repetido en el archivo\.$/,
    );
    expect(result.rows).toHaveLength(50);
    expect(result.rows[0]).toMatchObject({ row: 2, valid: true, message: null, rol: "profesor" });
    expect(result.rows.find((row) => row.row === 5)).toMatchObject({
      valid: false,
      message: "Fila 5: Falta el documento.",
    });
    expect(await people(tenant.orgId)).toBe(before.people);
    expect(await jobs()).toBe(before.jobs);
    expect(events(owner).length).toBe(before.events);
  });

  test("preview caps the error list at 200 while invalid stays exact", async () => {
    const rows = Array.from({ length: 300 }, () => goodRow("director"));
    const result = await preview(await xlsx(rows));
    expect(result).toMatchObject({ total: 300, valid: 0, invalid: 300 });
    expect(result.errors).toHaveLength(200);
    expect(result.rows).toHaveLength(50);
  });

  test("preview flags documents and emails that already exist", async () => {
    const taken = tenant.people.owner!;
    const ownerEmail = (
      await fx.db.select().from(schema.user).where(eq(schema.user.id, taken.userId))
    )[0]!.email;
    const rows = [
      goodRow("profesor", { 3: taken.documentNumber }),
      goodRow("profesor", { 5: ownerEmail.toUpperCase() }),
      goodRow(),
    ];
    const result = await preview(await xlsx(rows));
    expect(result).toMatchObject({ total: 3, valid: 1, invalid: 2 });
    expect(result.errors[0]!.message).toBe(
      `Fila 2: El documento "${taken.documentNumber}" ya existe.`,
    );
    expect(result.errors[1]!.message).toBe(`Fila 3: El correo "${ownerEmail}" ya está en uso.`);
  });

  test("a document of another institution is not reported as existing", async () => {
    const foreign = other.people.owner!;
    const result = await preview(await xlsx([goodRow("profesor", { 3: foreign.documentNumber })]));
    expect(result).toMatchObject({ valid: 1, invalid: 0 });
  });

  test("file limits: wrong extension, over 10 MB, over 2,000 rows", async () => {
    const csv = await errorOf(preview(new File(["a,b"], "usuarios.csv")));
    expect([csv?.code, csv?.message]).toEqual([
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
    // importStart enforces the same gate and creates no job.
    const refused = await errorOf(start(await xlsx(rows)));
    expect(refused?.code).toBe("BAD_REQUEST");
    expect(await jobs()).toBe(0);
  });

  test("importTemplate downloads plantilla-usuarios.xlsx that previews as valid", async () => {
    const file = await call(userRouter.importTemplate, undefined, { context: ctx(owner) });
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("plantilla-usuarios.xlsx");
    const result = await preview(file);
    expect(result).toMatchObject({ total: 1, valid: 1, invalid: 0 });
  });

  test("importStart with no valid rows is refused and creates no job", async () => {
    const error = await errorOf(start(await xlsx([goodRow("director")])));
    expect([error?.code, error?.message]).toEqual([
      "BAD_REQUEST",
      "El archivo no contiene filas válidas para importar.",
    ]);
    expect(await jobs()).toBe(0);
  });

  test("importStart imports the valid rows in the background through the shared service", async () => {
    const before = await people(tenant.orgId);
    const rows = hundredRows();
    const { jobId } = await start(await xlsx(rows));
    const started = await getJob(jobId);
    expect(started).toMatchObject({ kind: "users", total: 100 });
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
    expect(await people(tenant.orgId)).toBe(before + 94);

    // The initial password is the document and the forced change is armed (shared createUser).
    const created = (
      await fx.db
        .select()
        .from(schema.person)
        .where(
          and(
            eq(schema.person.organizationId, tenant.orgId),
            eq(schema.person.documentNumber, String(rows[0]![3])),
          ),
        )
    )[0]!;
    expect(created.mustChangePassword).toBe(true);
    const [account] = await fx.db
      .select()
      .from(schema.account)
      .where(
        and(eq(schema.account.userId, created.userId), eq(schema.account.providerId, "credential")),
      );
    expect(await verifyPassword({ hash: account!.password!, password: String(rows[0]![3]) })).toBe(
      true,
    );

    // One event per job, no per-user rows, no secret (sige/03 §3.5).
    const imported = events(owner).filter((event) => event.action === "user.imported");
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      targetId: jobId,
      actorUserId: tenant.people.owner!.userId,
      metadata: { jobId, total: 100, imported: 94, skipped: 6, byRole: { teacher: 94 } },
    });
    expect(
      events(owner).some(
        (event) =>
          event.action === "user.created" &&
          event.metadata?.role === "teacher" &&
          event.targetId === created.userId,
      ),
    ).toBe(false);
    expect(JSON.stringify(imported[0]!.metadata)).not.toContain(String(rows[0]![3]));
  });

  test("re-importing the same file skips the existing documents instead of duplicating them", async () => {
    const rows = [goodRow(), goodRow("estudiante")];
    const file = await xlsx(rows);
    const first = await start(file);
    await runner.settled();
    expect(await getJob(first.jobId)).toMatchObject({ status: "done", imported: 2, skipped: 0 });
    const after = await people(tenant.orgId);

    const again = await errorOf(start(file));
    expect(again?.message).toBe("El archivo no contiene filas válidas para importar.");
    expect(await people(tenant.orgId)).toBe(after);
    const dry = await preview(file);
    expect(dry.errors.map((error) => error.message)).toEqual([
      `Fila 2: El documento "${rows[0]![3]}" ya existe.`,
      `Fila 3: El documento "${rows[1]![3]}" ya existe.`,
    ]);
  });

  test("a second start while a job runs is a CONFLICT; exactly one of two concurrent starts wins", async () => {
    runner = createTrackedImportRunner();
    const first = await start(await xlsx([goodRow()]));
    const second = await errorOf(start(await xlsx([goodRow()])));
    expect([second?.code, second?.status, second?.message]).toEqual([
      "CONFLICT",
      409,
      "Ya hay una importación en curso.",
    ]);
    await runner.settled();
    expect((await getJob(first.jobId)).status).toBe("done");

    const files = [await xlsx([goodRow()]), await xlsx([goodRow()])];
    const results = await Promise.allSettled(files.map((file) => start(file)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult;
    expect((rejected.reason as ORPCError<string, unknown>).message).toBe(
      "Ya hay una importación en curso.",
    );
    await runner.settled();
  });

  test("admin and owner roles are not importable (D11); nothing is created for them", async () => {
    const before = await people(tenant.orgId);
    const result = await preview(
      await xlsx([goodRow("admin"), goodRow("owner"), goodRow("administrador")]),
    );
    expect(result).toMatchObject({ valid: 0, invalid: 3 });
    expect(result.errors[0]!.message).toBe('Fila 2: Rol inválido "admin".');
    expect(await people(tenant.orgId)).toBe(before);
  });

  test("importJob.get: any user:import holder sees the job; unknown ids are NOT_FOUND", async () => {
    runner = createTrackedImportRunner();
    const { jobId } = await start(await xlsx([goodRow()]));
    await runner.settled();
    expect((await getJob(jobId, admin)).status).toBe("done");
    const missing = await errorOf(getJob("00000000-0000-0000-0000-000000000000"));
    expect(missing?.code).toBe("NOT_FOUND");
  });
});

await testPermissionMatrix({
  name: "user import",
  procedures: [
    {
      name: "user.importPreview",
      permissions: { user: ["import"] },
      run: async (context) => call(userRouter.importPreview, { file: await xlsx([]) }, { context }),
    },
    {
      name: "user.importStart",
      permissions: { user: ["import"] },
      // No valid row: an allowed caller is refused with a domain error before any job exists.
      run: async (context) => call(userRouter.importStart, { file: await xlsx([]) }, { context }),
    },
    {
      name: "user.importTemplate",
      permissions: { user: ["import"] },
      run: (context) => call(userRouter.importTemplate, undefined, { context }),
    },
    {
      name: "importJob.get",
      permissions: null,
      anyOf: [{ user: ["import"] }, { student: ["import"] }],
      run: (context) => call(importJobRouter.get, { jobId: "missing" }, { context }),
    },
  ],
});

const seedJob = async (
  tenant: TestTenant,
  fixture: Parameters<NonNullable<Parameters<typeof isolationCase>[0]["seed"]>>[1],
) => {
  const [job] = await fixture.db
    .insert(schema.importJob)
    .values({
      organizationId: tenant.orgId,
      kind: "users",
      status: "done",
      total: 1,
      processed: 1,
      imported: 1,
      createdBy: tenant.people.owner!.personId,
    })
    .returning();
  return { jobId: job!.id, owner: tenant.people.owner! };
};

await testTenantIsolation({
  name: "user import",
  cases: [
    isolationCase({
      name: "importJob.get of a foreign job is NOT_FOUND",
      seed: seedJob,
      run: ({ context, foreign }) =>
        call(importJobRouter.get, { jobId: foreign.jobId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "importPreview never reports a foreign document as existing",
      seed: seedJob,
      run: async ({ context, foreign }) => {
        const result = await call(
          userRouter.importPreview,
          { file: await xlsx([goodRow("profesor", { 3: foreign.owner.documentNumber })]) },
          { context },
        );
        expect(result).toMatchObject({ valid: 1, invalid: 0 });
        // The echoed `rows` carry the caller's own input; what must not leak is what the server adds.
        return { valid: result.valid, invalid: result.invalid, errors: result.errors };
      },
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.owner.username, foreign.owner.personId],
    }),
  ],
});

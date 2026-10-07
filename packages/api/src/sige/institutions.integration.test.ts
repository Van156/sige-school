import {
  RecordingAuditLogger,
  resolveTestDatabaseUrl,
  truncateAllTables,
} from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createInstitution } from "./create-institution";
import type { CreateInstitutionInput } from "./create-institution";
import { listInstitutions } from "./list-institutions";

/**
 * Institution creation races and the INS-01 list query (sige/02 §3.1) against a real Postgres.
 */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "institutions (INS-01/02)");

describe.skipIf(!reachable)("institutions (INS-01/02)", () => {
  let handle: TestDatabaseHandle;
  const auditLogger = new RecordingAuditLogger();
  let seq = 0;

  beforeAll(() => {
    handle = createTestDatabase(url);
  });
  afterAll(async () => {
    await truncateAllTables(handle.db);
    await handle.close();
  });
  beforeEach(async () => {
    await truncateAllTables(handle.db);
    auditLogger.reset();
  });

  function rectorFor(): CreateInstitutionInput["rector"] {
    seq += 1;
    return {
      firstName: "Marta",
      lastName: "Gomez",
      documentType: "CC",
      documentNumber: `5${String(seq).padStart(7, "0")}`,
      email: `rector${seq}@colegio.example.com`,
    };
  }

  const create = (name: string) =>
    createInstitution(
      { database: handle.db, auditLogger },
      { name, rector: rectorFor(), actor: { userId: "root" } },
    );

  test("concurrent creates with the same name each get a distinct slug", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => create("Colegio Sol")),
    );
    const failures = results.filter((result) => result.status === "rejected");
    expect(failures.map((failure) => String((failure as PromiseRejectedResult).reason))).toEqual(
      [],
    );
    const slugs = results.map(
      (result) =>
        (result as PromiseFulfilledResult<{ institution: { slug: string } }>).value.institution
          .slug,
    );
    expect(new Set(slugs).size).toBe(5);
    expect(slugs.every((slug) => slug.startsWith("colegio-sol"))).toBe(true);
  });

  test("list returns one row per institution with the oldest owner as rector", async () => {
    const first = await create("Colegio Uno");
    const later = await create("Colegio Dos");
    // Make Dos's rector a newer second owner of Uno.
    await handle.db.insert(schema.member).values({
      id: crypto.randomUUID(),
      organizationId: first.institution.id,
      userId: later.rector.userId,
      role: "owner",
      createdAt: new Date(Date.now() + 60_000),
    });

    const rows = await listInstitutions(handle.db);
    const uno = rows.find((row) => row.id === first.institution.id);
    expect(rows).toHaveLength(2);
    expect(uno?.rector?.userId).toBe(first.rector.userId);
  });

  test("the limit applies to institutions, not to joined owner rows", async () => {
    const created = [];
    for (const name of ["Alfa", "Beta", "Gamma"]) {
      created.push(await create(name));
    }
    // Two extra owners on every institution: the join yields 3 rows per institution.
    for (const institution of created) {
      for (const owner of created) {
        if (owner.institution.id === institution.institution.id) continue;
        await handle.db.insert(schema.member).values({
          id: crypto.randomUUID(),
          organizationId: institution.institution.id,
          userId: owner.rector.userId,
          role: "owner",
        });
      }
    }
    const rows = await listInstitutions(handle.db, 2);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.rector !== null)).toBe(true);
  });
});

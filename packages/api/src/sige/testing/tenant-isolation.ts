import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import { sigeSuite } from "./fixture";
import type { SigeTestFixture, SigeTestRole, TestTenant } from "./fixture";

export type TenantIsolationArgs<Seed> = {
  /** Context of the caller in tenant A. */
  context: Context;
  tenant: TestTenant;
  /** Tenant B, whose ids the caller must never reach. */
  foreignTenant: TestTenant;
  own: Seed;
  foreign: Seed;
  fixture: SigeTestFixture;
};

export type TenantIsolationCase<Seed = undefined> = {
  name: string;
  /** Role of the tenant A caller; defaults to `owner` (the widest scope). */
  as?: SigeTestRole;
  /** Seeds module rows in a tenant; called once for each tenant, before `run`. */
  seed?: (tenant: TestTenant, fixture: SigeTestFixture) => Promise<Seed>;
  /** Calls the procedure as tenant A's caller, aiming at tenant B's ids where it takes any. */
  run: (args: TenantIsolationArgs<Seed>) => Promise<unknown>;
  /**
   * `notFound`: the call must fail with `NOT_FOUND` (get/update/delete by id, R1.15).
   * `noLeak`: the call may succeed or fail, but its result must contain no tenant B identifier
   * (lists, counts, searches).
   */
  expectation: "notFound" | "noLeak";
  /** Extra tenant B identifiers (seeded row ids, names) that must never appear in the result. */
  foreignIds?: (foreign: Seed) => string[];
  /** Extra check that tenant B's rows are untouched after a mutation attempt. */
  verifyForeignUnchanged?: (foreign: Seed, fixture: SigeTestFixture) => Promise<void>;
  /** Self-test hook: the case is expected to be reported as a failure, and this inspects it. */
  expectFailure?: (error: unknown) => void;
};

/** A case with its seed type erased, so cases with different seeds share one `cases` array. */
export type ErasedTenantIsolationCase = TenantIsolationCase<unknown> & { readonly erased: true };

/** Declares a case; infers the seed type from `seed` so `run` and `foreignIds` stay typed. */
export function isolationCase<Seed = undefined>(
  testCase: TenantIsolationCase<Seed>,
): ErasedTenantIsolationCase {
  return testCase as unknown as ErasedTenantIsolationCase;
}

export type TenantIsolationConfig = {
  name: string;
  cases: readonly ErasedTenantIsolationCase[];
};

/** Core tenant B identifiers every case is checked against. */
function foreignIdentifiers(tenant: TestTenant): string[] {
  return [
    tenant.orgId,
    tenant.slug,
    ...Object.values(tenant.people).flatMap((person) =>
      person ? [person.userId, person.personId, person.username, person.documentNumber] : [],
    ),
  ];
}

/** Snapshot of tenant B's core rows, to prove a call changed nothing there. */
async function snapshotTenant(fixture: SigeTestFixture, tenant: TestTenant): Promise<string> {
  const [people, members] = await Promise.all([
    fixture.db.select().from(schema.person).where(eq(schema.person.organizationId, tenant.orgId)),
    fixture.db.select().from(schema.member).where(eq(schema.member.organizationId, tenant.orgId)),
  ]);
  return JSON.stringify({ people, members });
}

/**
 * Tenant-isolation harness (sige/00 R3.3): provisions two institutions through `provisionUser`
 * and runs each case as a caller of tenant A against tenant B. A case fails when it reaches B's
 * data (a `noLeak` result containing a B identifier, or a `notFound` call that succeeds) or when
 * B's rows change. One call per router; each case is one procedure.
 */
export async function testTenantIsolation(config: TenantIsolationConfig): Promise<void> {
  await sigeSuite(`tenant isolation: ${config.name}`, (fixture) => {
    let tenantA: TestTenant;
    let tenantB: TestTenant;

    test("provisions two institutions", async () => {
      tenantA = await fixture.provisionTenant("Alfa", ["owner", "teacher"]);
      tenantB = await fixture.provisionTenant("Beta", ["owner", "teacher"]);
      expect(tenantA.orgId).not.toBe(tenantB.orgId);
    });

    for (const raw of config.cases) {
      const testCase: TenantIsolationCase<unknown> = raw;
      test(testCase.name, async () => {
        const check = async () => {
          const own = await testCase.seed?.(tenantA, fixture);
          const foreign = await testCase.seed?.(tenantB, fixture);
          const caller = tenantA.people[testCase.as ?? "owner"];
          if (!caller) {
            throw new Error(`Tenant A has no ${testCase.as ?? "owner"} caller.`);
          }
          const context = await fixture.contextFor(caller, tenantA);
          const before = await snapshotTenant(fixture, tenantB);

          let result: unknown;
          let code: string | null = null;
          try {
            result = await testCase.run({
              context,
              tenant: tenantA,
              foreignTenant: tenantB,
              own,
              foreign,
              fixture,
            });
          } catch (error) {
            code = error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
          }

          if (testCase.expectation === "notFound") {
            expect(code, "a foreign id must be NOT_FOUND (R1.15)").toBe("NOT_FOUND");
          } else {
            expect(code === null || code === "NOT_FOUND" || code === "FORBIDDEN").toBe(true);
            const serialized = JSON.stringify(result ?? null);
            const needles = [
              ...foreignIdentifiers(tenantB),
              ...(testCase.foreignIds?.(foreign) ?? []),
            ];
            const leaked = needles.filter((needle) => serialized.includes(needle));
            if (leaked.length > 0) {
              throw new Error(
                `Tenant leak: result leaked tenant B identifiers ${leaked.join(", ")}`,
              );
            }
          }

          expect(await snapshotTenant(fixture, tenantB)).toBe(before);
          await testCase.verifyForeignUnchanged?.(foreign, fixture);
        };

        if (testCase.expectFailure) {
          const failure = await check().then(
            () => null,
            (error: unknown) => error,
          );
          expect(failure, "the harness should have reported a failure").not.toBeNull();
          testCase.expectFailure(failure);
          return;
        }
        await check();
      });
    }
  });
}

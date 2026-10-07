import { grantedActions } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { expect, test } from "bun:test";

import type { OrgPermissions } from "../../authorization";
import type { Context } from "../../context";
import { sigeSuite, SIGE_TEST_ROLES } from "./fixture";
import type { SigeTestRole, TestPerson, TestTenant } from "./fixture";

export type PermissionMatrixProcedure = {
  name: string;
  /** What the procedure's `requirePermission` demands; `null` = any member (no permission check). */
  permissions: OrgPermissions | null;
  /** Calls the procedure as the caller of `context`, with valid input for an allowed caller. */
  run: (context: Context) => Promise<unknown>;
};

export type PermissionMatrixConfig = {
  name: string;
  procedures: readonly PermissionMatrixProcedure[];
  /** Roles to cover; defaults to every SIGE built-in role. */
  roles?: readonly SigeTestRole[];
};

/**
 * Domain errors a handler may raise once the gate let the caller through. Anything else (an
 * unexpected error, `INTERNAL_SERVER_ERROR`, a non-oRPC throw) is a failure, never "allowed".
 */
const EXPECTED_DOMAIN_CODES = new Set(["NOT_FOUND", "BAD_REQUEST", "CONFLICT"]);

/** Whether an outcome (`null` = success) shows the caller got past the gate (R1.13). */
export function passedGate(code: string | null): boolean {
  return code === null || EXPECTED_DOMAIN_CODES.has(code);
}

/** Expected verdict from the sige-core grant table (the single source of the role grants). */
export function isGranted(role: string, permissions: OrgPermissions | null): boolean {
  if (permissions === null) {
    return true;
  }
  return Object.entries(permissions).every(([feature, actions]) =>
    (actions ?? []).every((action) => grantedActions(role, feature).includes(action)),
  );
}

async function outcomeCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
  }
}

/**
 * Permission-matrix harness (sige/00 R1.13): one test per SIGE role x procedure. A role holding
 * every required permission per the T1 grant table must get past the gate; any other role must be
 * `FORBIDDEN`. Runs against real better-auth roles, so it also catches drift between the table
 * and the wired statements. One call per router.
 */
export async function testPermissionMatrix(config: PermissionMatrixConfig): Promise<void> {
  const roles = config.roles ?? SIGE_TEST_ROLES;
  await sigeSuite(`permission matrix: ${config.name}`, (fixture) => {
    let tenant: TestTenant;
    const contexts = new Map<SigeTestRole, Context>();

    test("provisions one caller per role", async () => {
      tenant = await fixture.provisionTenant("Matriz", roles);
      for (const role of roles) {
        contexts.set(role, await fixture.contextFor(tenant.people[role] as TestPerson, tenant));
      }
      expect(contexts.size).toBe(roles.length);
    });

    for (const procedure of config.procedures) {
      for (const role of roles) {
        const allowed = isGranted(role, procedure.permissions);
        test(`${procedure.name} as ${role}: ${allowed ? "allowed" : "FORBIDDEN"}`, async () => {
          const context = contexts.get(role);
          if (!context) {
            throw new Error("Caller context missing: the provisioning test did not run.");
          }
          const code = await outcomeCode(procedure.run(context));
          if (allowed) {
            expect(passedGate(code), `got ${code}`).toBe(true);
          } else {
            expect(code).toBe("FORBIDDEN");
          }
        });
      }
    }
  });
}

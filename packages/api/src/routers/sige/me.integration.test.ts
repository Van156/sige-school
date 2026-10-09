import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import {
  isolationCase,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import { meRouter } from "./me";

/** Pilot router (sige/01 `me.get`): proves the harnesses and the `sigeProcedure` gate matrix. */
await testPermissionMatrix({
  name: "me",
  procedures: [
    {
      name: "me.get",
      permissions: null,
      run: (context) => call(meRouter.get, undefined, { context }),
    },
  ],
});

await testTenantIsolation({
  name: "me",
  cases: [
    isolationCase({
      name: "me.get returns only the caller's own identity",
      run: ({ context }) => call(meRouter.get, undefined, { context }),
      expectation: "noLeak",
    }),
  ],
});

await sigeSuite("me.get gate and shape", (fx) => {
  const code = async (promise: Promise<unknown>) =>
    promise.then(
      () => undefined,
      (error: unknown) => (error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR"),
    );

  test("returns the caller's identity, kind and organization", async () => {
    const tenant = await fx.provisionTenant("Alfa", ["teacher"]);
    const teacher = tenant.people.teacher!;
    const me = await call(meRouter.get, undefined, {
      context: await fx.contextFor(teacher, tenant),
    });
    expect(me.kind).toBe("teacher");
    expect(me.roleName).toBe("teacher");
    expect(me.org.id).toBe(tenant.orgId);
    expect(me.person.id).toBe(teacher.personId);
    expect(me.user.username).toBe(teacher.username);
    expect(me.user.email).toBeNull();
    expect(me.impersonating).toBe(false);
  });

  describe("sigeProcedure gate", () => {
    test("a member without a person row is rejected with NO_PERSON", async () => {
      const tenant = await fx.provisionTenant("Beta", ["viewer"]);
      const viewer = tenant.people.viewer!;
      await fx.db.delete(schema.person).where(eq(schema.person.id, viewer.personId));
      const context = await fx.contextFor(viewer, tenant);
      expect(await code(call(meRouter.get, undefined, { context }))).toBe("NO_PERSON");
    });

    test("an inactive person is rejected with ACCOUNT_DISABLED", async () => {
      const tenant = await fx.provisionTenant("Gamma", ["viewer"]);
      const viewer = tenant.people.viewer!;
      // The session is issued first (the session guard refuses new ones for inactive people);
      // deactivating afterwards proves the procedure gate still stops an already-open session.
      const context = await fx.contextFor(viewer, tenant);
      await fx.db
        .update(schema.person)
        .set({ isActive: false })
        .where(eq(schema.person.id, viewer.personId));
      expect(await code(call(meRouter.get, undefined, { context }))).toBe("ACCOUNT_DISABLED");
    });

    test("must-change-password blocks every procedure except me.get", async () => {
      const tenant = await fx.provisionTenant("Delta", ["viewer"], { mustChangePassword: true });
      const viewer = tenant.people.viewer!;
      const context = await fx.contextFor(viewer, tenant);

      const me = await call(meRouter.get, undefined, { context });
      expect(me.person.mustChangePassword).toBe(true);

      const { sigeProcedure } = await import("../../sige/procedure");
      const gated = sigeProcedure.handler(() => "reached");
      expect(await code(call(gated, undefined, { context }))).toBe("PASSWORD_CHANGE_REQUIRED");
    });

    test("an active person with the flag cleared passes", async () => {
      const tenant = await fx.provisionTenant("Epsilon", ["viewer"]);
      const viewer = tenant.people.viewer!;
      const context = await fx.contextFor(viewer, tenant);
      const { sigeProcedure } = await import("../../sige/procedure");
      const gated = sigeProcedure.handler(({ context: c }) => c.scope.kind);
      expect(await call(gated, undefined, { context })).toBe("viewer");
    });
  });
});

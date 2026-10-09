import { call } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import { eq } from "drizzle-orm";
import { expect } from "bun:test";

import { requirePermission } from "../../index";
import { sigeProcedure } from "../procedure";
import { isolationCase, testPermissionMatrix, testTenantIsolation } from "./index";

/**
 * Self-test of the reusable SIGE harnesses (sige/00 R1.13, R3.3) with throwaway routers: one
 * permissioned read, one tenant-scoped read and one deliberately leaky read that the isolation
 * harness must catch.
 */
const probe = {
  institutionRead: sigeProcedure
    .use(requirePermission({ institution: ["read"] }))
    .handler(() => "ok"),
  userCreate: sigeProcedure.use(requirePermission({ user: ["create"] })).handler(() => "ok"),
  portalReadSelf: sigeProcedure
    .use(requirePermission({ portal: ["read_self"] }))
    .handler(() => "ok"),
  /** Correct tenant scoping: people of the caller's organization only. */
  listPeople: sigeProcedure.handler(async ({ context }) =>
    context.db
      .select({ id: schema.person.id })
      .from(schema.person)
      .where(eq(schema.person.organizationId, context.org.id)),
  ),
  /** Broken on purpose: forgets the organization filter. */
  listPeopleLeaky: sigeProcedure.handler(async ({ context }) =>
    context.db.select({ id: schema.person.id }).from(schema.person),
  ),
};

await testPermissionMatrix({
  name: "harness probe",
  procedures: [
    {
      name: "institutionRead",
      permissions: { institution: ["read"] },
      run: (context) => call(probe.institutionRead, undefined, { context }),
    },
    {
      name: "userCreate",
      permissions: { user: ["create"] },
      run: (context) => call(probe.userCreate, undefined, { context }),
    },
    {
      name: "portalReadSelf",
      permissions: { portal: ["read_self"] },
      run: (context) => call(probe.portalReadSelf, undefined, { context }),
    },
    {
      name: "listPeople (no permission)",
      permissions: null,
      run: (context) => call(probe.listPeople, undefined, { context }),
    },
  ],
});

await testTenantIsolation({
  name: "harness probe",
  cases: [
    isolationCase({
      name: "listPeople never returns the other tenant's rows",
      run: ({ context }) => call(probe.listPeople, undefined, { context }),
      expectation: "noLeak",
    }),
  ],
});

await testTenantIsolation({
  name: "harness probe (the harness itself catches a leak)",
  cases: [
    isolationCase({
      name: "listPeopleLeaky is reported as a leak",
      run: ({ context }) => call(probe.listPeopleLeaky, undefined, { context }),
      expectation: "noLeak",
      expectFailure: (error) => expect(String(error)).toContain("leaked"),
    }),
  ],
});

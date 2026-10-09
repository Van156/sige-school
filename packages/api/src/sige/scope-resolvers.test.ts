import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, test } from "bun:test";
import { ORPCError } from "@orpc/server";

import { createScopePolicy } from "./scope";
import { createSigeScopeResolvers, TEACHER_SCOPE_STATUSES } from "./scope-resolvers";

const dialect = new PgDialect();
const subject = (kind: Parameters<typeof createScopePolicy>[0]["kind"]) => ({
  kind,
  organizationId: "org-1",
  personId: "person-1",
});

/** `offeringWhere`/`assertOffering` never touch the db for predicates; visibility is mocked. */
function resolvers(visible = true) {
  const base = createSigeScopeResolvers({ select: () => ({}) } as never);
  return { ...base, offeringVisible: async () => visible };
}

describe("offering scope resolvers (sige/00 §4.3, D3)", () => {
  test("a teacher is limited to own offerings with an activo or temporal assignment", () => {
    const query = dialect.sqlToQuery(
      createScopePolicy(subject("teacher"), resolvers()).offeringWhere()!,
    );
    expect(TEACHER_SCOPE_STATUSES).toEqual(["activo", "temporal"]);
    expect(query.sql).toContain('"offering"."teacher_person_id" = $1');
    expect(query.sql).toContain('from "teacher_assignment"');
    expect(query.sql).toContain('"teacher_assignment"."offering_id" = "offering"."id"');
    expect(query.sql).toContain('"teacher_assignment"."status" in ($2, $3)');
    expect(query.params).toEqual(["person-1", "activo", "temporal"]);
  });

  test.each(["owner", "admin", "coordinator", "viewer", "custom"] as const)(
    "%s sees the whole tenant (no predicate)",
    (kind) => {
      expect(createScopePolicy(subject(kind), resolvers()).offeringWhere()).toBeUndefined();
    },
  );

  test.each(["student", "parent"] as const)("%s fails closed until P4", (kind) => {
    const policy = createScopePolicy(subject(kind), resolvers());
    expect(dialect.sqlToQuery(policy.offeringWhere()!).sql).toBe("false");
  });

  test("student resolvers stay fail-closed in P3", () => {
    const policy = createScopePolicy(subject("teacher"), resolvers());
    expect(dialect.sqlToQuery(policy.studentWhere()!).sql).toBe("false");
  });

  test("assertOffering throws NOT_FOUND when the offering is not visible", async () => {
    const policy = createScopePolicy(subject("teacher"), resolvers(false));
    await expect(policy.assertOffering("o-1")).rejects.toBeInstanceOf(ORPCError);
    await expect(
      createScopePolicy(subject("teacher"), resolvers(true)).assertOffering("o-1"),
    ).resolves.toBeUndefined();
  });
});

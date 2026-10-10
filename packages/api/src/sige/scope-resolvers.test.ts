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

  test("a student sees the offerings of their own current course", () => {
    const query = dialect.sqlToQuery(
      createScopePolicy(subject("student"), resolvers()).offeringWhere()!,
    );
    expect(query.sql).toContain('from "student"');
    expect(query.sql).toContain('"student"."course_id" = "offering"."course_id"');
    expect(query.sql).toContain('"student"."person_id" = $1');
    expect(query.params).toEqual(["person-1"]);
  });

  test("a parent sees the offerings of their linked children's courses", () => {
    const query = dialect.sqlToQuery(
      createScopePolicy(subject("parent"), resolvers()).offeringWhere()!,
    );
    expect(query.sql).toContain('from "student_guardian"');
    expect(query.sql).toContain('"student"."course_id" = "offering"."course_id"');
    expect(query.sql).toContain('"student_guardian"."guardian_person_id" = $1');
    expect(query.params).toEqual(["person-1"]);
  });

  test("assertOffering throws NOT_FOUND when the offering is not visible", async () => {
    const policy = createScopePolicy(subject("teacher"), resolvers(false));
    const error = await policy.assertOffering("o-1").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).code).toBe("NOT_FOUND");
    await expect(
      createScopePolicy(subject("teacher"), resolvers(true)).assertOffering("o-1"),
    ).resolves.toBeUndefined();
  });
});

describe("student scope resolvers (sige/00 §4.3, sige/05 STU-R1, D2)", () => {
  const where = (kind: Parameters<typeof createScopePolicy>[0]["kind"]) =>
    dialect.sqlToQuery(createScopePolicy(subject(kind), resolvers()).studentWhere()!);

  test("a teacher sees students of courses with an activo/temporal offering or directed", () => {
    const query = where("teacher");
    expect(query.sql).toContain('"offering"."course_id" = "student"."course_id"');
    expect(query.sql).toContain('from "teacher_assignment"');
    expect(query.sql).toContain('"course"."director_person_id" = $');
    expect(query.params).toEqual(["person-1", "activo", "temporal", "person-1"]);
  });

  test("a student sees only their own row", () => {
    const query = where("student");
    expect(query.sql).toBe('"student"."person_id" = $1');
    expect(query.params).toEqual(["person-1"]);
  });

  test("a parent sees only linked children", () => {
    const query = where("parent");
    expect(query.sql).toContain('from "student_guardian"');
    expect(query.sql).toContain('"student_guardian"."student_id" = "student"."id"');
    expect(query.params).toEqual(["person-1"]);
  });

  test.each(["owner", "admin", "coordinator", "viewer", "custom"] as const)(
    "%s sees every student of the tenant (no predicate)",
    (kind) => {
      expect(createScopePolicy(subject(kind), resolvers()).studentWhere()).toBeUndefined();
    },
  );
});

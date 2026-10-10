import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, test } from "bun:test";
import { ORPCError } from "@orpc/server";
import { attendanceRecord, observation, person } from "@base-template/db/schema";
import { sql } from "drizzle-orm";

import { createScopePolicy, DEFAULT_SCOPE_RESOLVERS } from "./scope";
import type { ScopeResolvers } from "./scope";

const dialect = new PgDialect();
const render = (fragment: ReturnType<typeof sql> | undefined) =>
  fragment ? dialect.sqlToQuery(fragment).sql : undefined;

const subject = (kind: Parameters<typeof createScopePolicy>[0]["kind"]) => ({
  kind,
  organizationId: "org-1",
  personId: "person-1",
});

describe("createScopePolicy", () => {
  test.each(["owner", "admin", "coordinator", "viewer", "custom"] as const)(
    "%s is unrestricted: no row predicate",
    (kind) => {
      const policy = createScopePolicy(subject(kind));
      expect(policy.unrestricted).toBe(true);
      expect(policy.studentWhere()).toBeUndefined();
      expect(policy.offeringWhere()).toBeUndefined();
    },
  );

  test.each(["teacher", "student", "parent"] as const)(
    "%s is restricted and fails closed until its resolver exists",
    (kind) => {
      const policy = createScopePolicy(subject(kind));
      expect(policy.unrestricted).toBe(false);
      expect(render(policy.studentWhere())).toBe("false");
      expect(render(policy.offeringWhere())).toBe("false");
    },
  );

  test("uses the module-provided resolver for the caller's kind only", () => {
    const resolvers: ScopeResolvers = {
      ...DEFAULT_SCOPE_RESOLVERS,
      studentWhere: { teacher: (s) => sql`teacher_person_id = ${s.personId}` },
    };
    expect(render(createScopePolicy(subject("teacher"), resolvers).studentWhere())).toBe(
      "teacher_person_id = $1",
    );
    expect(render(createScopePolicy(subject("parent"), resolvers).studentWhere())).toBe("false");
  });

  test("isSelf only matches the caller's own person", () => {
    const policy = createScopePolicy(subject("student"));
    expect(policy.isSelf("person-1")).toBe(true);
    expect(policy.isSelf("person-2")).toBe(false);
  });

  test("inTenant pins a column to the caller's organization", () => {
    const policy = createScopePolicy(subject("teacher"));
    const query = dialect.sqlToQuery(policy.inTenant(person.organizationId));
    expect(query.sql).toBe('"person"."organization_id" = $1');
    expect(query.params).toEqual(["org-1"]);
  });

  test("assert* throws NOT_FOUND (never FORBIDDEN) when the row is not visible", async () => {
    const policy = createScopePolicy(subject("owner"));
    for (const assertion of [policy.assertStudent("s-1"), policy.assertOffering("o-1")]) {
      const error = await assertion.catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe("NOT_FOUND");
    }
  });

  test("assert* resolves when the module resolver reports the row visible, passing the scope predicate", async () => {
    const seen: Array<string | undefined> = [];
    const resolvers: ScopeResolvers = {
      ...DEFAULT_SCOPE_RESOLVERS,
      studentVisible: async (_subject, studentId, scopeWhere) => {
        seen.push(render(scopeWhere));
        return studentId === "s-1";
      },
    };
    const teacher = createScopePolicy(subject("teacher"), resolvers);
    await teacher.assertStudent("s-1");
    expect(seen).toEqual(["false"]);
    await expect(teacher.assertStudent("s-2")).rejects.toThrow();
  });
});

describe("row predicates lifted onto another table (D4)", () => {
  test.each(["owner", "admin", "coordinator", "viewer", "custom"] as const)(
    "%s gets no row predicate, so the module query stays unfiltered",
    (kind) => {
      const policy = createScopePolicy(subject(kind));
      expect(policy.offeringRowWhere(attendanceRecord.offeringId)).toBeUndefined();
      expect(policy.studentRowWhere(observation.studentId)).toBeUndefined();
    },
  );

  test.each(["teacher", "student", "parent"] as const)(
    "%s fails closed until a module provides the lift",
    (kind) => {
      const policy = createScopePolicy(subject(kind));
      expect(render(policy.offeringRowWhere(attendanceRecord.offeringId))).toBe("false");
      expect(render(policy.studentRowWhere(observation.studentId))).toBe("false");
    },
  );

  test("the lift receives the caller's own scope predicate and the row's column", () => {
    const resolvers: ScopeResolvers = {
      ...DEFAULT_SCOPE_RESOLVERS,
      offeringWhere: { teacher: () => sql`own_offering` },
      offeringRowWhere: (subjectIn, scopeWhere, idColumn) =>
        sql`${idColumn} in (${subjectIn.organizationId}) and ${scopeWhere}`,
    };
    const policy = createScopePolicy(subject("teacher"), resolvers);
    expect(render(policy.offeringRowWhere(attendanceRecord.offeringId))).toBe(
      '"attendance_record"."offering_id" in ($1) and own_offering',
    );
  });
});

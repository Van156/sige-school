import { RecordingAuditLogger } from "@base-template/auth/testing";
import { describe, expect, test } from "bun:test";

import { changedFields, recordAudit } from "./audit";

const base = (impersonatedBy?: string | null) => {
  const auditLogger = new RecordingAuditLogger();
  return {
    auditLogger,
    context: {
      auditLogger,
      org: { id: "org-1" },
      session: { user: { id: "user-1" }, session: { impersonatedBy } },
    },
  };
};

describe("changedFields", () => {
  test("keeps only the fields whose value changed, as from/to pairs", () => {
    expect(
      changedFields(
        { name: "Norte", code: "N1", active: true },
        { name: "Norte", code: "N2", active: false },
      ),
    ).toEqual({ code: { from: "N1", to: "N2" }, active: { from: true, to: false } });
  });
  test("treats null and undefined alike and compares dates by value", () => {
    expect(
      changedFields(
        { code: null, at: new Date("2026-01-01") },
        { code: undefined, at: new Date("2026-01-01") },
      ),
    ).toEqual({});
  });
  test("only considers fields present in the update", () => {
    expect(changedFields({ name: "A", code: "X" }, { name: "B" })).toEqual({
      name: { from: "A", to: "B" },
    });
  });
});

describe("recordAudit", () => {
  test("records exactly one organization-scoped event with actor and tenant from context", async () => {
    const { auditLogger, context } = base();
    await recordAudit(context, {
      action: "campus.updated",
      targetType: "campus",
      targetId: "c1",
      metadata: { name: "Norte", changes: { code: { from: "a", to: "b" } } },
    });
    expect(auditLogger.events).toHaveLength(1);
    expect(auditLogger.events[0]).toMatchObject({
      scope: "organization",
      organizationId: "org-1",
      actorUserId: "user-1",
      impersonatorUserId: null,
      action: "campus.updated",
      targetType: "campus",
      targetId: "c1",
      metadata: { name: "Norte", changes: { code: { from: "a", to: "b" } } },
    });
  });
  test("includes the impersonator when the session is impersonated", async () => {
    const { auditLogger, context } = base("root-1");
    await recordAudit(context, { action: "campus.created", targetType: "campus", targetId: "c1" });
    expect(auditLogger.events[0]).toMatchObject({ impersonatorUserId: "root-1" });
  });
  test("never records secret-looking keys", async () => {
    const { auditLogger, context } = base();
    await recordAudit(context, {
      action: "campus.created",
      targetType: "campus",
      targetId: "c1",
      metadata: { name: "x", password: "p", nested: { apiToken: "t", ok: 1 } },
    });
    expect(auditLogger.events[0]?.metadata).toEqual({ name: "x", nested: { ok: 1 } });
  });
  test("rejects a missing session", async () => {
    const { context } = base();
    await expect(
      recordAudit(
        { ...context, session: null },
        { action: "campus.created", targetType: "campus", targetId: "c1" },
      ),
    ).rejects.toThrow();
  });
});

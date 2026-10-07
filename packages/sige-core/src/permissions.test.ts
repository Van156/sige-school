import { describe, expect, test } from "bun:test";

import {
  SIGE_PLATFORM_GRANTS,
  SIGE_PLATFORM_STATEMENTS,
  SIGE_ROLE_GRANTS,
  SIGE_ROLES,
  SIGE_STATEMENTS,
  grantedActions,
  isSigeRole,
  type SigeRole,
} from "./permissions";

const CRUD = ["read", "create", "update", "delete"] as const;

/** Spec §4.2 "Role grants" table, written out independently of the implementation. */
const ADMIN_GRANTS = {
  institution: ["read", "update"],
  campus: [...CRUD],
  level: [...CRUD],
  course: [...CRUD],
  period: [...CRUD],
  subject: [...CRUD],
  criterion: [...CRUD],
  user: ["read", "create", "update", "delete", "import", "reset_password"],
  student: ["read", "create", "update", "delete", "import", "guardians"],
  offering: [...CRUD],
  enrollment: [...CRUD],
  classroom: [...CRUD],
  time_block: [...CRUD],
  schedule: ["read", "generate", "update"],
  grade: ["read", "write", "lock", "import", "recalculate", "manage_locks"],
  attendance: ["read", "record"],
  observation: ["read", "create", "update", "delete", "notify", "export"],
  report_card: ["read", "generate", "update", "deliver", "delete"],
  metric: ["read", "export"],
  achievement: ["read", "award", "run_engine"],
  alert: ["read", "resolve", "run_engine"],
  qr: ["monitor", "manage_readers"],
  overview: ["read"],
} as const;

const EXPECTED: Record<SigeRole | "owner" | "admin", Record<string, readonly string[]>> = {
  owner: ADMIN_GRANTS,
  admin: ADMIN_GRANTS,
  coordinator: {
    institution: ["read"],
    campus: ["read"],
    level: ["read"],
    course: ["read"],
    period: ["read"],
    subject: ["read"],
    criterion: ["read"],
    student: ADMIN_GRANTS.student,
    offering: [...CRUD],
    enrollment: [...CRUD],
    classroom: [...CRUD],
    time_block: [...CRUD],
    schedule: ["read", "generate", "update"],
    grade: ADMIN_GRANTS.grade,
    attendance: ["read", "record"],
    observation: ADMIN_GRANTS.observation,
    report_card: ADMIN_GRANTS.report_card,
    metric: ["read", "export"],
    achievement: ADMIN_GRANTS.achievement,
    alert: ADMIN_GRANTS.alert,
    qr: ["monitor"],
    overview: ["read"],
  },
  teacher: {
    institution: ["read"],
    subject: ["read"],
    criterion: ["read"],
    student: ["read"],
    schedule: ["read"],
    grade: ["read", "write", "lock", "import"],
    attendance: ["read", "record"],
    observation: ["read", "create", "update", "notify"],
    report_card: ["read", "generate"],
    metric: ["read_own"],
    achievement: ["read"],
  },
  student: { period: ["read"], schedule: ["read"], portal: ["read_self"] },
  parent: { period: ["read"], portal: ["read_child"] },
  viewer: { institution: ["read"], overview: ["read"] },
};

const sorted = (record: Record<string, readonly string[]>) =>
  Object.fromEntries(
    Object.entries(record)
      .map(([feature, actions]) => [feature, [...actions].sort()] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

describe("SIGE_ROLE_GRANTS (spec §4.2)", () => {
  for (const [role, expected] of Object.entries(EXPECTED)) {
    test(`${role} grants match the spec table exactly`, () => {
      const granted = SIGE_ROLE_GRANTS[role as keyof typeof SIGE_ROLE_GRANTS];
      expect(sorted(granted)).toEqual(sorted(expected));
    });
  }

  test("covers exactly owner, admin and the five new SIGE roles", () => {
    expect(Object.keys(SIGE_ROLE_GRANTS).sort()).toEqual(
      ["admin", "coordinator", "owner", "parent", "student", "teacher", "viewer"].sort(),
    );
    expect([...SIGE_ROLES]).toEqual(["coordinator", "teacher", "student", "parent", "viewer"]);
  });

  test("every grant is an action of the catalog (no orphan permissions)", () => {
    for (const grants of Object.values(SIGE_ROLE_GRANTS)) {
      for (const [feature, actions] of Object.entries(grants)) {
        const catalog = (SIGE_STATEMENTS as Record<string, readonly string[]>)[feature];
        expect(catalog).toBeDefined();
        for (const action of actions) {
          expect(catalog).toContain(action);
        }
      }
    }
  });

  test("owner and admin are identical", () => {
    expect(SIGE_ROLE_GRANTS.owner).toEqual(SIGE_ROLE_GRANTS.admin);
  });

  test("only owner/admin hold user and qr:manage_readers; teachers cannot export or delete observations", () => {
    expect(grantedActions("coordinator", "user")).toEqual([]);
    expect(grantedActions("coordinator", "qr")).toEqual(["monitor"]);
    expect(grantedActions("teacher", "observation")).not.toContain("export");
    expect(grantedActions("teacher", "observation")).not.toContain("delete");
  });
});

describe("SIGE_STATEMENTS", () => {
  test("lists every §4.2 feature with its actions", () => {
    expect(sorted(SIGE_STATEMENTS)).toEqual(
      sorted({
        ...ADMIN_GRANTS,
        metric: ["read", "read_own", "export"],
        portal: ["read_self", "read_child"],
      }),
    );
  });
});

describe("platform catalog", () => {
  test("superadmin gains institution and qr:simulate", () => {
    expect(SIGE_PLATFORM_STATEMENTS.institution).toEqual([
      "read",
      "create",
      "update",
      "delete",
      "manage_users",
    ]);
    expect(SIGE_PLATFORM_STATEMENTS.qr).toEqual(["simulate"]);
    expect(SIGE_PLATFORM_GRANTS).toEqual(SIGE_PLATFORM_STATEMENTS);
  });
});

describe("isSigeRole / grantedActions", () => {
  test("recognizes SIGE roles only", () => {
    expect(isSigeRole("teacher")).toBe(true);
    expect(isSigeRole("owner")).toBe(false);
    expect(isSigeRole("root")).toBe(false);
  });

  test("unknown roles and features get nothing", () => {
    expect(grantedActions("janitor", "grade")).toEqual([]);
    expect(grantedActions("teacher", "nope")).toEqual([]);
    expect(grantedActions("__proto__", "grade")).toEqual([]);
    expect(grantedActions("constructor", "grade")).toEqual([]);
  });
});

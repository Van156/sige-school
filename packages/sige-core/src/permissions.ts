/**
 * SIGE permission catalog and role grants (spec `docs/specs/sige/00-foundation.md` §4.2).
 *
 * Pure data: no better-auth, drizzle or React import, so `packages/auth` (statements and roles),
 * `packages/api` and the browser can all depend on it. Roles are wired into better-auth in
 * `packages/auth/src/permissions/org.ts`; this module only owns the catalog and the grant table.
 */

const CRUD = ["read", "create", "update", "delete"] as const;

/** Org-scoped SIGE features and their actions, added to `orgStatements` (spec §4.2). */
export const SIGE_STATEMENTS = {
  institution: ["read", "update"],
  campus: CRUD,
  level: CRUD,
  course: CRUD,
  period: CRUD,
  subject: CRUD,
  criterion: CRUD,
  user: ["read", "create", "update", "delete", "import", "reset_password"],
  student: ["read", "create", "update", "delete", "import", "guardians"],
  offering: CRUD,
  enrollment: CRUD,
  classroom: CRUD,
  time_block: CRUD,
  schedule: ["read", "generate", "update"],
  grade: ["read", "write", "lock", "import", "recalculate", "manage_locks"],
  attendance: ["read", "record"],
  observation: ["read", "create", "update", "delete", "notify", "export"],
  report_card: ["read", "generate", "update", "deliver", "delete"],
  metric: ["read", "read_own", "export"],
  achievement: ["read", "award", "run_engine"],
  alert: ["read", "resolve", "run_engine"],
  qr: ["monitor", "manage_readers"],
  overview: ["read"],
  portal: ["read_self", "read_child"],
} as const;

export type SigeFeature = keyof typeof SIGE_STATEMENTS;
export type SigeGrants = {
  readonly [F in SigeFeature]?: readonly (typeof SIGE_STATEMENTS)[F][number][];
};

/** New built-in org roles (R1.4). `owner` and `admin` already exist in the platform template. */
export const SIGE_ROLES = ["coordinator", "teacher", "student", "parent", "viewer"] as const;
export type SigeRole = (typeof SIGE_ROLES)[number];

/** Every SIGE kind a member can hold: the two platform-template roles plus `SIGE_ROLES`. */
export const SIGE_KINDS = ["owner", "admin", ...SIGE_ROLES] as const;
export type SigeKind = (typeof SIGE_KINDS)[number];

/** Spec §4.2 column "A": owner and admin share the same SIGE permissions (R1.3). */
const ADMIN_GRANTS = {
  institution: ["read", "update"],
  campus: CRUD,
  level: CRUD,
  course: CRUD,
  period: CRUD,
  subject: CRUD,
  criterion: CRUD,
  user: SIGE_STATEMENTS.user,
  student: SIGE_STATEMENTS.student,
  offering: CRUD,
  enrollment: CRUD,
  classroom: CRUD,
  time_block: CRUD,
  schedule: SIGE_STATEMENTS.schedule,
  grade: SIGE_STATEMENTS.grade,
  attendance: SIGE_STATEMENTS.attendance,
  observation: SIGE_STATEMENTS.observation,
  report_card: SIGE_STATEMENTS.report_card,
  metric: ["read", "export"],
  achievement: SIGE_STATEMENTS.achievement,
  alert: SIGE_STATEMENTS.alert,
  qr: SIGE_STATEMENTS.qr,
  overview: ["read"],
} as const satisfies SigeGrants;

/**
 * Role to SIGE permission grants. Row-level scope ("own courses", "own offerings", S own, P own
 * children) is NOT expressed here: it is resolved by `ScopePolicy` (spec §4.3, task T3).
 */
export const SIGE_ROLE_GRANTS = {
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
    student: SIGE_STATEMENTS.student,
    offering: CRUD,
    enrollment: CRUD,
    classroom: CRUD,
    time_block: CRUD,
    schedule: SIGE_STATEMENTS.schedule,
    grade: SIGE_STATEMENTS.grade, // OD-5
    attendance: SIGE_STATEMENTS.attendance,
    observation: SIGE_STATEMENTS.observation, // incl. export (G-OBS-2)
    report_card: SIGE_STATEMENTS.report_card,
    metric: ["read", "export"],
    achievement: SIGE_STATEMENTS.achievement,
    alert: SIGE_STATEMENTS.alert,
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
    attendance: SIGE_STATEMENTS.attendance,
    observation: ["read", "create", "update", "notify"],
    report_card: ["read", "generate"],
    metric: ["read_own"],
    achievement: ["read"],
  },
  student: { period: ["read"], schedule: ["read"], portal: ["read_self"] },
  parent: { period: ["read"], portal: ["read_child"] },
  viewer: { institution: ["read"], overview: ["read"] },
} as const satisfies Record<"owner" | "admin" | SigeRole, SigeGrants>;

export type SigeGrantedRole = keyof typeof SIGE_ROLE_GRANTS;

/** Platform catalog additions for `superadmin` (spec §4.2): INS-01..05 and QR-02. */
export const SIGE_PLATFORM_STATEMENTS = {
  institution: ["read", "create", "update", "delete", "manage_users"],
  qr: ["simulate"],
} as const;

/** `superadmin` holds every platform SIGE action. */
export const SIGE_PLATFORM_GRANTS = SIGE_PLATFORM_STATEMENTS;

export function isSigeRole(name: string): name is SigeRole {
  return (SIGE_ROLES as readonly string[]).includes(name);
}

/** Actions `role` holds on `feature`. Unknown roles or features grant nothing (fail closed). */
export function grantedActions(role: string, feature: string): readonly string[] {
  if (!Object.hasOwn(SIGE_ROLE_GRANTS, role)) {
    return [];
  }
  const grants = SIGE_ROLE_GRANTS[role as SigeGrantedRole] as Record<string, readonly string[]>;
  return Object.hasOwn(grants, feature) ? (grants[feature] ?? []) : [];
}

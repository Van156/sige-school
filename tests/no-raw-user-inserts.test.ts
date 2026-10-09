import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * USR-R1 (sige/03): every login-bearing person is created through the shared `provisionUser`
 * path (via `createUser`/`createInstitution`/the import), never by inserting into `user`,
 * `member` or `person` directly. Those inserts would skip the username, role, owner and audit
 * rules. oxlint cannot express "this table from outside this module", so this scans the source.
 *
 * Detected: `.insert(user)` and member access on any identifier chain ending in the table name
 * (`schema.user`, `tables.member`, ...), plus raw SQL `insert into`. Known limit: a table held in
 * a local variable (`const t = schema.user; db.insert(t)`) or an aliased import
 * (`import { user as u }`) is not detected. Test files are excluded by filename only, so helper
 * modules (including `testing/` directories) are scanned.
 */
const repoRoot = join(import.meta.dir, "..");
const SCAN_ROOTS = ["apps", "packages"];
const SKIPPED_DIRS = new Set(["node_modules", "dist", "migrations", ".turbo"]);

/**
 * The only non-test source files allowed to insert into those tables, each with the reason.
 * Add to this list only with a review: the point is that it stays this short.
 */
export const ALLOWLIST: Record<string, string> = {
  "packages/auth/src/provision-user.ts": "the shared service itself (USR-R1)",
  "packages/api/src/sige/seed.ts":
    "the seed's root platform account: a superadmin outside any institution, so it has no member/person row",
};

const TABLES = "user|member|person";
const DRIZZLE_INSERT = new RegExp(`\\.insert\\(\\s*(?:[\\w$]+\\.)*(${TABLES})\\s*,?\\s*\\)`, "g");
const SQL_INSERT = new RegExp(`insert\\s+into\\s+"?(?:public"?\\."?)?(${TABLES})"?(?![\\w])`, "gi");

/** Table names a source text inserts into directly (drizzle builder or raw SQL). */
export function rawInsertTargets(source: string): string[] {
  return [...source.matchAll(DRIZZLE_INSERT), ...source.matchAll(SQL_INSERT)].map((match) =>
    (match[1] as string).toLowerCase(),
  );
}

function isTestFile(name: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(name) || /\.stories\.tsx?$/.test(name);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return SKIPPED_DIRS.has(entry) ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) && !isTestFile(entry) ? [path] : [];
  });
}

describe("rawInsertTargets", () => {
  test("finds drizzle and raw SQL inserts into the guarded tables", () => {
    const source = [
      `await tx.insert(schema.user).values(row);`,
      `await db.insert(\n  member,\n).values(row);`,
      `await db.insert(person).values(row);`,
      `await sql\`insert into "person" (id) values (1)\`;`,
      `INSERT INTO member (id) VALUES (1);`,
    ].join("\n");
    expect(rawInsertTargets(source).toSorted()).toEqual([
      "member",
      "member",
      "person",
      "person",
      "user",
    ]);
  });

  test("finds inserts through any identifier ending in the table name", () => {
    const source = [
      `await db.insert(tables.user).values(row);`,
      `await db.insert(s.member).values(row);`,
      `await db.insert(a.b.person).values(row);`,
    ].join("\n");
    expect(rawInsertTargets(source).toSorted()).toEqual(["member", "person", "user"]);
  });

  test("ignores other tables and look-alike names", () => {
    const source = [
      `await tx.insert(schema.account).values(row);`,
      `await tx.insert(schema.userPreference).values(row);`,
      `await tx.insert(schema.personContact).values(row);`,
      `await tx.insert(tables.userPreference).values(row);`,
      `await tx.insert(tables.users).values(row);`,
      `insert into member_invite (id) values (1);`,
    ].join("\n");
    expect(rawInsertTargets(source)).toEqual([]);
  });
});

describe("USR-R1: no raw inserts into user, member or person", () => {
  const files = SCAN_ROOTS.flatMap((root) => sourceFiles(join(repoRoot, root)));

  test("there is source to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  test("every allowlisted file still exists and still needs its entry", () => {
    for (const path of Object.keys(ALLOWLIST)) {
      const source = readFileSync(join(repoRoot, path), "utf8");
      expect(
        rawInsertTargets(source).length,
        `${path} is allowlisted but no longer inserts into user/member/person: remove it from ALLOWLIST in tests/no-raw-user-inserts.test.ts.`,
      ).toBeGreaterThan(0);
    }
  });

  test("only the shared service modules insert into those tables", () => {
    const offenders = files
      .map((file) => ({ path: relative(repoRoot, file), file }))
      .filter(({ path }) => !(path in ALLOWLIST))
      .map(({ path, file }) => ({ path, targets: rawInsertTargets(readFileSync(file, "utf8")) }))
      .filter(({ targets }) => targets.length > 0);
    expect(
      offenders,
      [
        "Raw insert into user/member/person outside the shared user service (USR-R1):",
        ...offenders.map(
          ({ path, targets }) => `  - ${path} (${[...new Set(targets)].join(", ")})`,
        ),
        "Create users through createUser / provisionUser (packages/api/src/sige/user-service.ts,",
        "packages/auth/src/provision-user.ts) so username, role, owner and audit rules apply.",
        "Test fixtures belong in *.test.ts files. If this file truly must insert directly,",
        "add it to ALLOWLIST in tests/no-raw-user-inserts.test.ts with the reason, in review.",
      ].join("\n"),
    ).toEqual([]);
  });
});

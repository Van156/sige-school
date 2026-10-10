// SIGE demo seed (sige/00 §9, R4): root platform admin, the demo institution "Colegio San José" and
// one login per SIGE kind, the 12 teachers, the P3 offering/schedule dataset and the P4 students and
// guardians. Idempotent. Usage: `pnpm db:seed:sige`.
//
// The logic lives in `@base-template/api/sige/seed` so it is testable against a real database.
// Root credentials come from SEED_ROOT_EMAIL / SEED_ROOT_PASSWORD; the built-in demo password is
// allowed only in development/test or with `--force-demo` (see `resolveSeedRoot`). Refuses
// NODE_ENV=production unless `--force-demo` is passed (R4.6).
import { resolveSeedRoot, seedSige } from "@base-template/api/sige/seed";

import { ENV } from "../src/env.server";
import { auditLogger, db } from "../src/services";

async function main(): Promise<void> {
  const forceDemo = process.argv.includes("--force-demo");
  if (ENV.NODE_ENV === "production" && !forceDemo) {
    console.error("[seed-sige] refusing to seed demo data in production (pass --force-demo).");
    process.exitCode = 1;
    return;
  }
  let resolved;
  try {
    resolved = resolveSeedRoot({ env: process.env, nodeEnv: ENV.NODE_ENV, forceDemo });
  } catch (error) {
    console.error(`[seed-sige] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }
  const { root, passwordSource } = resolved;
  const result = await seedSige({ database: db, auditLogger }, { root });
  console.log(
    `[seed-sige] root ${root.email} ${result.rootCreated ? "created" : "already present"}.`,
  );
  console.log("[seed-sige] demo logins (username / initial password = document number):");
  // An existing root keeps its password: the seed never rewrites credentials.
  const rootPassword = !result.rootCreated
    ? "(existing account, password unchanged)"
    : passwordSource === "env"
      ? "(password set from SEED_ROOT_PASSWORD)"
      : `${root.password}  (built-in DEMO password)`;
  console.log(`  ${"root".padEnd(12)} ${root.email} / ${rootPassword}`);
  for (const login of result.logins) {
    console.log(
      `  ${login.kind.padEnd(12)} ${login.username.padEnd(16)} / ${login.password}  (${login.fullName})`,
    );
  }
  console.log(
    result.schedule
      ? `[seed-sige] schedule generated: ${result.schedule.assigned} slots, ${result.schedule.conflicts} conflicts, ${result.schedule.skipped.length} courses skipped.`
      : "[seed-sige] schedule already present (not regenerated).",
  );
}

try {
  await main();
} finally {
  await db.$client.end();
}

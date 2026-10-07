// SIGE P0 seed (sige/00 §9, R4): root platform admin, the demo institution "Colegio San José" and
// one login per SIGE kind. Idempotent. Usage: `pnpm db:seed:sige`.
//
// The logic lives in `@base-template/api/sige/seed` so it is testable against a real database.
// Root credentials come from SEED_ROOT_EMAIL / SEED_ROOT_PASSWORD (demo defaults below, local use
// only). Refuses NODE_ENV=production unless `--force-demo` is passed (R4.6).
import { seedSige } from "@base-template/api/sige/seed";

import { ENV } from "../src/env.server";
import { auditLogger, db } from "../src/services";

const DEMO_ROOT = {
  email: process.env.SEED_ROOT_EMAIL?.trim() || "root@sige.local",
  password: process.env.SEED_ROOT_PASSWORD || "Root-Demo-2026!",
  name: "Administrador SIGE",
};

async function main(): Promise<void> {
  if (ENV.NODE_ENV === "production" && !process.argv.includes("--force-demo")) {
    console.error("[seed-sige] refusing to seed demo data in production (pass --force-demo).");
    process.exitCode = 1;
    return;
  }
  const result = await seedSige({ database: db, auditLogger }, { root: DEMO_ROOT });
  console.log(
    `[seed-sige] root ${DEMO_ROOT.email} ${result.rootCreated ? "created" : "already present"}.`,
  );
  console.log("[seed-sige] demo logins (username / initial password = document number):");
  console.log(`  ${"root".padEnd(12)} ${DEMO_ROOT.email} / ${DEMO_ROOT.password}`);
  for (const login of result.logins) {
    console.log(
      `  ${login.kind.padEnd(12)} ${login.username.padEnd(16)} / ${login.password}  (${login.fullName})`,
    );
  }
}

try {
  await main();
} finally {
  await db.$client.end();
}

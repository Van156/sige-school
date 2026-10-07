import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { auditRouter } from "./audit";
import { membersRouter } from "./members";
import { meRouter } from "./sige/me";
import { organizationRouter } from "./organization";
import { platformRouter } from "./platform";
import { projectRouter } from "./project";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  // Template examples demonstrating orgProcedure/requirePermission and
  // platformProcedure (docs/specs/auth-multitenant-rbac.md §4.5).
  project: projectRouter,
  platform: platformRouter,
  // Audit activity log (R7.4, R7.5): audit.list (org, audit:read) and
  // audit.listPlatform (platform, superadmin-only).
  audit: auditRouter,
  // Organization members list (name/email search, role filter, sorts), scoped to the active org.
  members: membersRouter,
  // Organization lifecycle: organization.transferOwnership (spec account-and-org-settings §6.5).
  organization: organizationRouter,
  // SIGE (sige/00 R3.1): routers under ./sige build on `sigeProcedure`.
  me: meRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;

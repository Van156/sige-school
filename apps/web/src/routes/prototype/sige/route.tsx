import { Outlet, createFileRoute } from "@tanstack/react-router";

import type { Role } from "./-mock/types";
import { parseRole } from "./-lib/roles";

/**
 * SIGE prototype root. Holds the active role in `?role=` (default admin) so every nested route and
 * link can read it; the shell and the auth/error pages are siblings below this layout.
 */
export const Route = createFileRoute("/prototype/sige")({
  validateSearch: (search: Record<string, unknown>): { role: Role } => ({
    role: parseRole(search.role),
  }),
  head: () => ({ meta: [{ title: "SIGE" }] }),
  component: Outlet,
});

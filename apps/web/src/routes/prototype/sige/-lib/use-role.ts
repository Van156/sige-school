import { useRouterState, useSearch } from "@tanstack/react-router";

import type { Role } from "../-mock/types";
import { matchScreen, type ScreenDef } from "../-screens";

/** Active role, held in the `?role=` search param of the `/prototype/sige` layout. */
export function useRole(): Role {
  return useSearch({ from: "/prototype/sige", select: (search) => search.role });
}

/** The screen rendered at the current URL, resolved through the screen registry. */
export function useCurrentScreen(): ScreenDef | undefined {
  const role = useRole();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return matchScreen(pathname, role);
}

/** Raw `?rol=` filter used by the user-list nav items (not part of the validated search). */
export function useRoleFilter(): string | undefined {
  return useRouterState({
    select: (state) => {
      const value = (state.location.search as Record<string, unknown>).rol;
      return typeof value === "string" ? value : undefined;
    },
  });
}

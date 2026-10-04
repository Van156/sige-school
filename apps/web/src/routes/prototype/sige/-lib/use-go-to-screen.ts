import { useNavigate } from "@tanstack/react-router";

import { hrefFor, screenById } from "../-screens";
import { useRole } from "./use-role";

/** Imperative navigation to a screen by id, keeping the active `?role=` (form submit, delete). */
export function useGoToScreen() {
  const role = useRole();
  const navigate = useNavigate();

  return (screenId: string, search?: Record<string, string | undefined>) => {
    const screen = screenById.get(screenId);
    if (!screen) return;
    const href = hrefFor(screen);
    void navigate({
      to: href.to as never,
      params: href.params as never,
      search: { ...search, role: href.asRole ?? role } as never,
    });
  };
}

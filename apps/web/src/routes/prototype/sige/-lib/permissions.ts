import { screenById } from "../-screens";
import { useRole } from "./use-role";

/** Whether the active role may open a screen, per the roles declared in `-screens.ts`. */
export function useCan(screenId: string): boolean {
  const role = useRole();
  return screenById.get(screenId)?.roles.includes(role) ?? false;
}

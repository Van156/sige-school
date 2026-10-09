import { useCan } from "@/features/access-control";

/**
 * INS-R1 `canManage`: whether the caller may create (and so edit and delete) `feature` rows.
 * Coordinators and teachers get read-only lists. UX only; procedures re-check. Pending and failed
 * checks read as `false` so actions never flash before the permission resolves.
 */
export function useCanManage(feature: string): boolean {
  return useCan(`${feature}:create`).can;
}

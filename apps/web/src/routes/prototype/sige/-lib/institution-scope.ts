import {
  INSTITUTION_ID,
  institutionStore,
  useActiveInstitutionId,
  useMockCollection,
} from "../-mock";
import type { Institution } from "../-mock/types";
import { useRole } from "./use-role";

/**
 * Institution every institution-scoped screen works in: the user's own one, or for root the active
 * institution chosen in INS-03 (`undefined` until chosen).
 */
export function useScopeInstitution(): Institution | undefined {
  const role = useRole();
  const activeId = useActiveInstitutionId();
  const institutions = useMockCollection(institutionStore);
  const id = role === "root" ? activeId : INSTITUTION_ID;
  return institutions.find((entry) => entry.id === id);
}

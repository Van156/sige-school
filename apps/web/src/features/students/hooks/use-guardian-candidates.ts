import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

import { candidatesStatus } from "../lib/student-guardians";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MAX_LENGTH = 100;
const RESULT_LIMIT = 20;

/**
 * STU-04 "Seleccionar Acudiente" source: `guardian.candidates` of the student for `search`,
 * debounced; a blank search lists the first page. The previous results stay on screen while a new
 * search loads. `term` is the debounced search the query ran with.
 */
export function useGuardianCandidates(studentId: string, search: string) {
  const term = useDebouncedValue(search.trim().slice(0, SEARCH_MAX_LENGTH), SEARCH_DEBOUNCE_MS);
  const query = useQuery({
    ...orpc.guardian.candidates.queryOptions({
      input: { studentId, search: term === "" ? undefined : term, limit: RESULT_LIMIT },
    }),
    placeholderData: keepPreviousData,
  });
  return {
    candidates: query.data ?? [],
    status: candidatesStatus(query, term),
    term,
  };
}

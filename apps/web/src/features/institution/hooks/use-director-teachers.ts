import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MAX_LENGTH = 100;
const RESULT_LIMIT = 20;

/**
 * The active teachers INS-12's "Director de Grupo" offers (`user.options`, role `teacher`) that
 * match `search`, debounced; blank search lists the first page. The previous results stay on
 * screen while a new search loads, so the list does not flash empty on every keystroke. `term` is
 * the debounced search the query ran with, which the status mapping needs.
 */
export function useDirectorTeachers(search: string) {
  const term = useDebouncedValue(search.trim().slice(0, SEARCH_MAX_LENGTH), SEARCH_DEBOUNCE_MS);
  const query = useQuery({
    ...orpc.user.options.queryOptions({
      input: { role: "teacher", search: term === "" ? undefined : term, limit: RESULT_LIMIT },
    }),
    placeholderData: keepPreviousData,
  });
  return { query, term };
}

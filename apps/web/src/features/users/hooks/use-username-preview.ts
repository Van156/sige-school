import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";

import { orpc } from "@/app/orpc";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

import {
  USERNAME_PREVIEW_DEBOUNCE_MS,
  usernamePreviewInput,
  usernamePreviewState,
  type UsernamePreviewParts,
  type UsernamePreviewState,
} from "../lib/username-preview";

/** An answer for the same names and document stays valid while the user keeps typing around it. */
const PREVIEW_STALE_MS = 60_000;

const NO_INPUT: UsernamePreviewParts = { firstName: "", lastName: "", documentNumber: "" };

/** What every preview procedure answers (`user.previewUsername`, `platformUser.previewUsername`). */
type PreviewAnswer = { username: string | null; documentTaken: boolean };

/** The query options of one preview procedure for the debounced input. */
export type UsernamePreviewQuery = (input: UsernamePreviewParts) => UseQueryOptions<PreviewAnswer>;

/** USR-02: the tenant `user.previewUsername`. */
export const tenantUsernamePreview: UsernamePreviewQuery = (input) =>
  orpc.user.previewUsername.queryOptions({ input });

/**
 * Live username (USR-R2): asks the preview procedure `USERNAME_PREVIEW_DEBOUNCE_MS` after the last
 * keystroke once names and document are filled in. `queryFor` picks the procedure: the tenant
 * `user.previewUsername` (USR-02, the default) or `platformUser.previewUsername` (INS-02/05).
 * Never writes.
 */
export function useUsernamePreview(
  { firstName, lastName, documentNumber }: UsernamePreviewParts,
  queryFor: UsernamePreviewQuery = tenantUsernamePreview,
): UsernamePreviewState {
  const input = useMemo(
    () => usernamePreviewInput({ firstName, lastName, documentNumber }),
    [firstName, lastName, documentNumber],
  );
  const settled = useDebouncedValue(input, USERNAME_PREVIEW_DEBOUNCE_MS);
  const query = useQuery({
    ...queryFor(settled ?? NO_INPUT),
    enabled: settled !== null,
    retry: false,
    staleTime: PREVIEW_STALE_MS,
    refetchOnWindowFocus: false,
  });

  return usernamePreviewState({
    enabled: input !== null,
    pending: input !== settled,
    isFetching: query.isFetching,
    isError: query.isError,
    data: query.data,
  });
}

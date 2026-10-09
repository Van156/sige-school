import { useQuery } from "@tanstack/react-query";
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

const NO_INPUT: UsernamePreviewParts = { firstName: "", lastName: "", documentNumber: "" };

/**
 * USR-02 live username (USR-R2): asks `user.previewUsername` 300 ms after the last keystroke once
 * names and document are filled in. Never writes.
 */
export function useUsernamePreview({
  firstName,
  lastName,
  documentNumber,
}: UsernamePreviewParts): UsernamePreviewState {
  const input = useMemo(
    () => usernamePreviewInput({ firstName, lastName, documentNumber }),
    [firstName, lastName, documentNumber],
  );
  const settled = useDebouncedValue(input, USERNAME_PREVIEW_DEBOUNCE_MS);
  const query = useQuery({
    ...orpc.user.previewUsername.queryOptions({ input: settled ?? NO_INPUT }),
    enabled: settled !== null,
    retry: false,
  });

  return usernamePreviewState({
    enabled: input !== null,
    pending: input !== settled,
    isFetching: query.isFetching,
    isError: query.isError,
    data: query.data,
  });
}

/** Wait after the last keystroke before asking `user.previewUsername` (USR-R2). */
export const USERNAME_PREVIEW_DEBOUNCE_MS = 300;

export type UsernamePreviewParts = {
  firstName: string;
  lastName: string;
  documentNumber: string;
};

/** The three inputs, trimmed; `null` while any is empty (the server answers `null` then too). */
export function usernamePreviewInput(parts: UsernamePreviewParts): UsernamePreviewParts | null {
  const input = {
    firstName: parts.firstName.trim(),
    lastName: parts.lastName.trim(),
    documentNumber: parts.documentNumber.trim(),
  };
  return input.firstName && input.lastName && input.documentNumber ? input : null;
}

/** What the preview box shows. */
export type UsernamePreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; username: string; documentTaken: boolean }
  | { status: "unavailable"; documentTaken: boolean }
  | { status: "error" };

/**
 * Preview state from the debounced query. `pending` means the typed values have not reached the
 * query yet; the last answer stays visible while a newer one loads only as "loading".
 */
export function usernamePreviewState(state: {
  enabled: boolean;
  pending: boolean;
  isFetching: boolean;
  isError: boolean;
  data: { username: string | null; documentTaken: boolean } | undefined;
}): UsernamePreviewState {
  if (!state.enabled) {
    return { status: "idle" };
  }
  if (state.pending || state.isFetching) {
    return { status: "loading" };
  }
  if (state.isError) {
    return { status: "error" };
  }
  if (!state.data) {
    return { status: "idle" };
  }
  return state.data.username
    ? { status: "ready", username: state.data.username, documentTaken: state.data.documentTaken }
    : { status: "unavailable", documentTaken: state.data.documentTaken };
}

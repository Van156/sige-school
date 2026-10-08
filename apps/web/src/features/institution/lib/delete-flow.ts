import { describeDeleteFailure } from "./delete-failure";

/** The side effects of a delete, injected so the flow stays free of toast and query-client imports. */
export type DeleteEffects<TRow extends { name: string }> = {
  remove: (row: TRow) => Promise<unknown>;
  notifyError: (title: string, description: string) => void;
  notifySuccess: (message: string) => void;
  refresh: () => Promise<unknown>;
  successMessage: (row: TRow) => string;
};

/**
 * Runs one confirmed delete. Success toasts and refreshes the list. `HAS_DEPENDENTS` toasts the
 * server's message and resolves, so the dialog closes (retrying cannot help). Any other failure
 * toasts and rethrows, so the dialog stays open for a retry.
 */
export async function runDelete<TRow extends { name: string }>(
  row: TRow,
  effects: DeleteEffects<TRow>,
): Promise<void> {
  try {
    await effects.remove(row);
  } catch (error) {
    const failure = describeDeleteFailure(row.name, error);
    effects.notifyError(failure.title, failure.description);
    if (failure.blockedByDependents) {
      return;
    }
    throw error;
  }
  effects.notifySuccess(effects.successMessage(row));
  await effects.refresh();
}

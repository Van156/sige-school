import { activationCopy, activationFailureMessage } from "./user-activation";
import type { UserRow } from "../types";

/** Side effects of one confirmed activate/deactivate, injected so the flow stays testable. */
export type ActivationEffects = {
  setActive: (row: UserRow, active: boolean) => Promise<unknown>;
  notifyError: (title: string, description: string) => void;
  notifySuccess: (message: string) => void;
  refresh: () => Promise<unknown>;
};

/**
 * Runs one confirmed activation change. Success toasts and refreshes. A failure toasts the server
 * message and rethrows, so the dialog stays open and nothing is refreshed.
 */
export async function runActivation(row: UserRow, effects: ActivationEffects): Promise<void> {
  const copy = activationCopy(row);
  try {
    await effects.setActive(row, copy.active);
  } catch (error) {
    effects.notifyError(`No se pudo actualizar a ${row.username}`, activationFailureMessage(error));
    throw error;
  }
  effects.notifySuccess(copy.successMessage);
  await effects.refresh();
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";

import {
  resetSuccessMessage,
  toResetPasswordInput,
  type ResetPasswordRequest,
} from "../lib/reset-password";

/**
 * Container logic of the reset-password dialog: calls `user.resetPassword` for `personId`, toasts
 * the outcome and refreshes the user data (the forced change is re-armed, USR-R9). Rejects with
 * the server error so the dialog can show it.
 */
export function useResetUserPassword(personId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation(orpc.user.resetPassword.mutationOptions());

  return async (request: ResetPasswordRequest) => {
    await mutation.mutateAsync(toResetPasswordInput(personId, request));
    toast.success(resetSuccessMessage(request));
    await queryClient.invalidateQueries({ queryKey: orpc.user.key() });
  };
}

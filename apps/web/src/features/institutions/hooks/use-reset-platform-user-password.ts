import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { resetSuccessMessage, type ResetPasswordRequest } from "@/features/users";

import { toPlatformResetInput } from "../lib/platform-user";

/**
 * Container logic of the INS-04 "Cambiar contraseña" dialog: calls `platformUser.resetPassword`
 * for `personId` of `institutionId`, toasts the outcome and refreshes the platform user data (the
 * forced change is re-armed, USR-R9). Rejects with the server error so the dialog can show it.
 */
export function useResetPlatformUserPassword(institutionId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation(orpc.platformUser.resetPassword.mutationOptions());

  return async (personId: string, request: ResetPasswordRequest) => {
    await mutation.mutateAsync(toPlatformResetInput(institutionId, personId, request));
    toast.success(resetSuccessMessage(request));
    await queryClient.invalidateQueries({ queryKey: orpc.platformUser.key() });
  };
}

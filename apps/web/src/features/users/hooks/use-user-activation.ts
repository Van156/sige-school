import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { confirmFor } from "@/shared/lib/confirm";

import { activationCopy, activationFailureMessage } from "../lib/user-activation";
import type { UserRow } from "../types";

/**
 * Container logic of the row activate/deactivate action: remembers the row awaiting confirmation,
 * calls `user.setActive`, refreshes the list and stats, and reports the outcome. A failure toasts
 * the server message and keeps the dialog open. Spread `dialog` into `ConfirmDialog`.
 */
export function useUserActivation() {
  const queryClient = useQueryClient();
  const setActive = useMutation(orpc.user.setActive.mutationOptions());
  const [target, setTarget] = useState<UserRow | null>(null);

  const confirm = confirmFor(target, async (row) => {
    const copy = activationCopy(row);
    try {
      await setActive.mutateAsync({ personId: row.personId, active: copy.active });
    } catch (error) {
      toast.error(`No se pudo actualizar a ${row.username}`, {
        description: activationFailureMessage(error),
      });
      throw error;
    }
    toast.success(copy.successMessage);
    await queryClient.invalidateQueries({ queryKey: orpc.user.key() });
  });

  return {
    target,
    copy: target ? activationCopy(target) : null,
    request: setTarget,
    dialog: {
      open: target !== null,
      onOpenChange: (open: boolean) => {
        if (!open) {
          setTarget(null);
        }
      },
      onConfirm: confirm,
    },
  };
}

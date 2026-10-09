import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { confirmFor } from "@/shared/lib/confirm";

import { runActivation } from "../lib/activation-flow";
import { activationCopy } from "../lib/user-activation";
import type { UserRow } from "../types";

/**
 * Container logic of the row activate/deactivate action: remembers the row awaiting confirmation,
 * runs `runActivation` (`user.setActive`, refresh of `orpc.user.key()`, toasts). A failure keeps the
 * dialog open. Spread `dialog` into `ConfirmDialog`.
 */
export function useUserActivation() {
  const queryClient = useQueryClient();
  const setActive = useMutation(orpc.user.setActive.mutationOptions());
  const [target, setTarget] = useState<UserRow | null>(null);

  const confirm = confirmFor(target, (row) =>
    runActivation(row, {
      setActive: (user, active) => setActive.mutateAsync({ personId: user.personId, active }),
      notifyError: (title, description) => toast.error(title, { description }),
      notifySuccess: (message) => toast.success(message),
      refresh: () => queryClient.invalidateQueries({ queryKey: orpc.user.key() }),
    }),
  );

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

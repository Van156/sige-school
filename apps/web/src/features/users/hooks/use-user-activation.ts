import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { confirmFor } from "@/shared/lib/confirm";

import { runActivation } from "../lib/activation-flow";
import { activationCopy } from "../lib/user-activation";
import type { UserRow } from "../types";

/**
 * Confirmation state of the row activate/deactivate action, for any `setActive` procedure:
 * remembers the row awaiting confirmation, runs `runActivation` (the given call, a refresh of
 * `invalidate`, toasts). A failure keeps the dialog open. Spread `dialog` into `ConfirmDialog`.
 * `USR-01` binds it to `user.setActive`, INS-04 to `platformUser.setActive`.
 */
export function useActivationConfirm({
  setActive,
  invalidate,
}: {
  setActive: (row: UserRow, active: boolean) => Promise<unknown>;
  /** Query key refreshed after a successful change. */
  invalidate: QueryKey;
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<UserRow | null>(null);

  const confirm = confirmFor(target, (row) =>
    runActivation(row, {
      setActive,
      notifyError: (title, description) => toast.error(title, { description }),
      notifySuccess: (message) => toast.success(message),
      refresh: () => queryClient.invalidateQueries({ queryKey: invalidate }),
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

/** Container logic of the USR-01 row activate/deactivate action (`user.setActive`). */
export function useUserActivation() {
  const setActive = useMutation(orpc.user.setActive.mutationOptions());
  return useActivationConfirm({
    setActive: (user, active) => setActive.mutateAsync({ personId: user.personId, active }),
    invalidate: orpc.user.key(),
  });
}

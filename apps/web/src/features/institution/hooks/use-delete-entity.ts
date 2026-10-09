import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { confirmFor } from "@/shared/lib/confirm";

import { runDelete } from "../lib/delete-flow";

/**
 * Container logic of a row "Eliminar" action: remembers the row awaiting confirmation, runs the
 * delete, refreshes the list and reports the outcome. `HAS_DEPENDENTS` toasts the server's message
 * and closes the dialog (retrying cannot help); any other failure toasts and keeps it open.
 * Spread `dialog` into `ConfirmDelete`.
 */
export function useDeleteEntity<TRow extends { id: string; name: string }>({
  remove,
  invalidate,
  successMessage,
}: {
  remove: (row: TRow) => Promise<unknown>;
  /** Query key of the list (and anything else) the delete makes stale. */
  invalidate: QueryKey;
  /** Toast after a successful delete, e.g. "Sede eliminada". */
  successMessage: (row: TRow) => string;
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<TRow | null>(null);

  const confirm = confirmFor(target, (row) =>
    runDelete(row, {
      remove,
      successMessage,
      notifyError: (title, description) => toast.error(title, { description }),
      notifySuccess: (message) => toast.success(message),
      refresh: () => queryClient.invalidateQueries({ queryKey: invalidate }),
    }),
  );

  return {
    target,
    requestDelete: setTarget,
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

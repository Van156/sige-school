import type { ReactNode } from "react";

import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

/**
 * Spanish delete confirmation of the structure lists (sige/02 §5.2: copy per list, e.g.
 * "¿Eliminar sede X?"). Presentational: `onConfirm` may reject to keep the dialog open; the
 * caller reports the failure (see `useDeleteEntity`).
 */
export default function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question, e.g. "¿Eliminar sede Norte?". */
  title: string;
  description?: ReactNode;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel="Sí, eliminar"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
    />
  );
}

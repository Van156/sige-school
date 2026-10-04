import { buttonVariants } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";
import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { ConfirmDeleteButton } from "./confirm-delete";
import { ScreenLink } from "./sige-link";

/** Edit link plus guarded delete for a table row; extra actions (view, key...) go in `before`. */
export function RowActions({
  editScreenId,
  id,
  entity,
  name,
  onDelete,
  canDelete = true,
  before,
}: {
  editScreenId: string;
  id: number;
  /** Lower-case entity noun for the labels, e.g. "sede". */
  entity: string;
  name: string;
  onDelete: () => void;
  canDelete?: boolean;
  before?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {before}
      <ScreenLink
        screenId={editScreenId}
        search={{ id: String(id) }}
        aria-label={`Editar ${entity} ${name}`}
        title="Editar"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
      >
        <Pencil />
      </ScreenLink>
      {canDelete ? (
        <ConfirmDeleteButton
          label={`Eliminar ${entity} ${name}`}
          title={`¿Eliminar ${entity} ${name}?`}
          description="Esta acción no se puede deshacer."
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  );
}

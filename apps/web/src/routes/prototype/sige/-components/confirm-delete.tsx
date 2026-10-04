import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@base-template/ui/components/alert-dialog";
import { Button } from "@base-template/ui/components/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";

/** Trash icon button that asks for confirmation before running `onConfirm` (legacy `confirm()`). */
export function ConfirmDeleteButton({
  label,
  title,
  description,
  onConfirm,
}: {
  /** Accessible name of the trigger, e.g. "Eliminar sede Sede Norte". */
  label: string;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            title={label}
            className="text-destructive hover:text-destructive"
          />
        }
      >
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Sí, eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

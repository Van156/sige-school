import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import { mapSubmitError } from "@/features/institution";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  OFFERING_HOURS_FIELDS,
  OFFERING_HOURS_SAVE_FALLBACK,
  offeringHoursFormSchema,
  offeringToHoursForm,
} from "../lib/offering-form";
import type { OfferingRow } from "../types";

type HoursTarget = Pick<OfferingRow, "id" | "subjectName" | "courseName" | "hoursPerWeek">;

/**
 * "Editar intensidad" dialog (OQ-SCH-1): edits only the weekly hours of one offering.
 * Presentational: `onSubmit` performs `offering.update` and rejects with the server error, which
 * is shown under the field or inline; the dialog closes only when it resolves.
 */
export default function OfferingHoursDialog({
  offering,
  onClose,
  onSubmit,
}: {
  /** The offering being edited; the dialog is open while it is set. */
  offering: HoursTarget | null;
  onClose: () => void;
  onSubmit: (offering: HoursTarget, hoursPerWeek: number) => Promise<void>;
}) {
  return (
    <Dialog
      open={offering !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        {offering ? (
          <OfferingHoursForm
            key={offering.id}
            offering={offering}
            onSubmit={onSubmit}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function OfferingHoursForm({
  offering,
  onSubmit,
  onClose,
}: {
  offering: HoursTarget;
  onSubmit: (offering: HoursTarget, hoursPerWeek: number) => Promise<void>;
  onClose: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: offeringToHoursForm(offering),
    validators: { onSubmit: offeringHoursFormSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(offering, offeringHoursFormSchema.parse(value).hoursPerWeek);
        onClose();
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: OFFERING_HOURS_FIELDS,
          fallback: OFFERING_HOURS_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <form
      noValidate
      aria-label="Editar intensidad"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>Editar intensidad</DialogTitle>
        <DialogDescription>
          {offering.subjectName} · {offering.courseName}
        </DialogDescription>
      </DialogHeader>
      <form.Field name="hoursPerWeek">
        {(field) => (
          <FormField
            field={field}
            label="Intensidad Horaria (Horas/Semana) *"
            description="Las clases ya programadas no se mueven; genere el horario de nuevo para aplicar el cambio."
          >
            {(control) => <Input {...control} type="number" min={1} max={20} step={1} />}
          </FormField>
        )}
      </form.Field>
      {formError ? <AuthFormError message={formError} /> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => <SubmitButton isPending={isSubmitting}>Guardar Cambios</SubmitButton>}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Switch } from "@base-template/ui/components/switch";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactNode } from "react";

import { describedBy, firstErrorMessage } from "@/shared/lib/form-errors";

/**
 * A boolean TanStack Form field rendered as a labelled switch with an optional description and
 * the first validation error. Counterpart of `FormField` for boolean values.
 */
export default function SwitchField({
  field,
  label,
  description,
  disabled,
}: {
  field: AnyFieldApi;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const message = firstErrorMessage(field.state.meta.errors);
  const id = field.name;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <Field orientation="horizontal" data-invalid={message ? true : undefined}>
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
        {message ? <FieldError id={errorId} errors={[{ message }]} /> : null}
      </FieldContent>
      <Switch
        id={id}
        name={field.name}
        checked={Boolean(field.state.value)}
        onCheckedChange={(checked) => field.handleChange(checked)}
        onBlur={field.handleBlur}
        disabled={disabled}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy(
          description ? descriptionId : undefined,
          message ? errorId : undefined,
        )}
      />
    </Field>
  );
}

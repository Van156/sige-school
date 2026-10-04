import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { Switch } from "@base-template/ui/components/switch";
import { Textarea } from "@base-template/ui/components/textarea";
import { useId, type ComponentProps, type ReactNode } from "react";

import type { FieldBinding } from "../-lib/use-form";

interface FrameProps {
  label: string;
  required?: boolean;
  hint?: ReactNode;
}

function FieldFrame({
  id,
  label,
  required,
  hint,
  error,
  children,
}: FrameProps & { id: string; error?: string; children: ReactNode }) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </FieldLabel>
      {children}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <FieldDescription>{hint}</FieldDescription>
      ) : null}
    </Field>
  );
}

type InputExtras = Omit<ComponentProps<typeof Input>, "id" | "value" | "onChange" | "size">;

export function TextField({
  label,
  required,
  hint,
  id,
  value,
  onValueChange,
  error,
  ...input
}: FrameProps & FieldBinding<string> & InputExtras) {
  return (
    <FieldFrame id={id} label={label} required={required} hint={hint} error={error}>
      <Input
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onValueChange(event.target.value)}
        {...input}
      />
    </FieldFrame>
  );
}

export function TextareaField({
  label,
  required,
  hint,
  id,
  value,
  onValueChange,
  error,
  rows = 4,
  placeholder,
}: FrameProps & FieldBinding<string> & { rows?: number; placeholder?: string }) {
  return (
    <FieldFrame id={id} label={label} required={required} hint={hint} error={error}>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </FieldFrame>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  required,
  hint,
  id,
  value,
  onValueChange,
  error,
  options,
  placeholder,
  disabled,
}: FrameProps &
  FieldBinding<string> & {
    options: readonly SelectOption[];
    /** Label of the empty first option; omit when the field always has a value. */
    placeholder?: string;
    disabled?: boolean;
  }) {
  return (
    <FieldFrame id={id} label={label} required={required} hint={hint} error={error}>
      <NativeSelect
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className="w-full"
        onChange={(event) => onValueChange(event.target.value)}
      >
        {placeholder !== undefined ? (
          <NativeSelectOption value="">{placeholder}</NativeSelectOption>
        ) : null}
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </FieldFrame>
  );
}

export function SwitchField({
  label,
  hint,
  id,
  value,
  onValueChange,
  error,
}: Omit<FrameProps, "required"> & FieldBinding<boolean>) {
  return (
    <Field orientation="horizontal" data-invalid={Boolean(error)}>
      <Switch
        id={id}
        checked={value}
        onCheckedChange={onValueChange}
        aria-invalid={Boolean(error)}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {error ? (
          <FieldError>{error}</FieldError>
        ) : hint ? (
          <FieldDescription>{hint}</FieldDescription>
        ) : null}
      </FieldContent>
    </Field>
  );
}

/** Locked value shown with the look of a field (edit forms of the legacy read-only columns). */
export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value} readOnly className="bg-muted/40" />
    </Field>
  );
}

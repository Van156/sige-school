import { useState, type FormEvent } from "react";

export interface FieldBinding<V> {
  id: string;
  value: V;
  onValueChange: (value: V) => void;
  error?: string;
}

export type FormErrors<T> = Partial<Record<keyof T, string>>;

export interface SimpleForm<T> {
  values: T;
  errors: FormErrors<T>;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  bind: <K extends keyof T & string>(key: K) => FieldBinding<T[K]>;
  /** Submit handler: shows errors from the first attempt on and calls `onValid` when none remain. */
  handleSubmit: (onValid: (values: T) => void) => (event: FormEvent) => void;
}

/**
 * Minimal controlled form for the prototype. Errors are derived from `validate` during render and
 * only shown after the first submit attempt (then live), so there is no error state to keep in sync.
 */
export function useSimpleForm<T extends object>(
  initial: T,
  validate: (values: T) => FormErrors<T>,
): SimpleForm<T> {
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors: FormErrors<T> = submitted ? validate(values) : {};

  const set: SimpleForm<T>["set"] = (key, value) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  return {
    values,
    errors,
    set,
    bind: (key) => ({
      id: key,
      value: values[key],
      onValueChange: (value) => set(key, value),
      error: errors[key],
    }),
    handleSubmit: (onValid) => (event) => {
      event.preventDefault();
      setSubmitted(true);
      if (Object.keys(validate(values)).length === 0) onValid(values);
    },
  };
}

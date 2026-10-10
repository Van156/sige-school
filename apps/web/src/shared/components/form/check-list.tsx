import { Button } from "@base-template/ui/components/button";
import { Checkbox } from "@base-template/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from "@base-template/ui/components/field";
import { useId, type ReactNode } from "react";

export type CheckItem = {
  value: string;
  label: string;
  /** Secondary line under the label, e.g. a code or "sede · jornada". */
  hint?: string;
};

/**
 * Multi-select as a scrollable checkbox list (keyboard friendly, with "select all / none"
 * shortcuts). Controlled and presentational: `value` holds the selected item values and
 * `onValueChange` receives the next selection; `error` replaces `hint` while set.
 */
export default function CheckList({
  legend,
  required,
  hint,
  items,
  value,
  onValueChange,
  error,
  empty = "No hay opciones disponibles.",
}: {
  legend: string;
  required?: boolean;
  hint?: ReactNode;
  items: readonly CheckItem[];
  value: readonly string[];
  onValueChange: (next: string[]) => void;
  error?: string;
  empty?: ReactNode;
}) {
  const baseId = useId();
  const toggle = (itemValue: string, checked: boolean) =>
    onValueChange(
      checked ? [...value, itemValue] : value.filter((selected) => selected !== itemValue),
    );

  return (
    <FieldSet data-invalid={error ? true : undefined} className="gap-2">
      <FieldLegend variant="label" className="mb-0">
        {legend}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
      </FieldLegend>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[13px] text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="flex max-h-56 flex-col overflow-y-auto rounded-lg border">
          {items.map((item) => {
            const inputId = `${baseId}-${item.value}`;
            return (
              <li key={item.value} className="border-b last:border-b-0">
                <label
                  htmlFor={inputId}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted/50"
                >
                  <Checkbox
                    id={inputId}
                    checked={value.includes(item.value)}
                    onCheckedChange={(checked) => toggle(item.value, checked)}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{item.label}</span>
                    {item.hint ? (
                      <span className="truncate text-xs text-muted-foreground">{item.hint}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 ? (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onValueChange(items.map((item) => item.value))}
          >
            Seleccionar todos
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => onValueChange([])}>
            Ninguno
          </Button>
          <span className="ml-auto self-center text-xs text-muted-foreground tabular-nums">
            {value.length} de {items.length}
          </span>
        </div>
      ) : null}
      <Field>
        {error ? (
          <FieldError>{error}</FieldError>
        ) : hint ? (
          <FieldDescription>{hint}</FieldDescription>
        ) : null}
      </Field>
    </FieldSet>
  );
}

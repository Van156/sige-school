import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@base-template/ui/components/combobox";
import { useState } from "react";

import type { FormFieldControlProps } from "@/shared/components/form/form-field";
import type { Option } from "@/shared/lib/data-table/types";

import {
  directorItems,
  directorSelection,
  type CurrentDirector,
  type DirectorSource,
  type DirectorStatus,
} from "../lib/course-form";

/** Re-exported for the stories and the container. */
export type { DirectorStatus };

/**
 * "Director de Grupo" searchable combobox (INS-12). Presentational: `teachers` are the active
 * teachers matching the search the container runs on `onSearchChange`; "Sin director asignado"
 * clears the director and the current director stays selectable even when the results omit them.
 * `unavailable` disables the field, still showing the current value; a `search-failed` input
 * stays usable so the user can change the term.
 */
export default function DirectorCombobox({
  control,
  teachers,
  current,
  status,
  onSearchChange,
}: {
  control: FormFieldControlProps;
  teachers: readonly DirectorSource[];
  current?: CurrentDirector;
  status: DirectorStatus;
  onSearchChange: (search: string) => void;
}) {
  const [picked, setPicked] = useState<Option>();
  const items = directorItems(teachers, current, picked);
  const unavailable = status === "unavailable";

  return (
    <Combobox
      items={items}
      filter={null}
      value={directorSelection(items, control.value)}
      onValueChange={(option) => {
        setPicked(option ?? undefined);
        control.onChange({ target: { value: option?.value ?? "" } });
      }}
      onInputValueChange={(text, { reason }) =>
        onSearchChange(reason === "input-change" ? text : "")
      }
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(option, value) => option.value === value.value}
      disabled={unavailable}
    >
      <ComboboxInput
        id={control.id}
        name={control.name}
        onBlur={control.onBlur}
        aria-invalid={control["aria-invalid"]}
        aria-describedby={control["aria-describedby"]}
        placeholder="Buscar profesor..."
        disabled={unavailable}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxList aria-busy={status === "searching" || undefined}>
          {(option: Option) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

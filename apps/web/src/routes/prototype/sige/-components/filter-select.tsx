import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";

import type { Option } from "../-lib/user-options";

/** Compact select of a list filter. With `allLabel` the empty value means "no filter". */
export function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  allLabel,
}: {
  /** Accessible name, e.g. "Filtrar por grado". */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly Option[];
  allLabel?: string;
}) {
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {allLabel !== undefined ? <NativeSelectOption value="">{allLabel}</NativeSelectOption> : null}
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

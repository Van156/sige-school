import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@base-template/ui/components/combobox";
import { useState } from "react";

import type { FormFieldControlProps } from "@/shared/components/form/form-field";
import type { Option } from "@/shared/lib/data-table/types";

import { candidateItems, type CandidatesStatus } from "../lib/student-guardians";
import type { GuardianCandidate } from "../types";

/**
 * STU-04 "Seleccionar Acudiente" (sige/05 §5.4): a search-as-you-type combobox over the
 * `guardian.candidates` the container fetches on `onSearchChange`. Options read
 * "{nombre} ({username}) - {documento}"; the picked guardian keeps showing while a later search
 * omits it. Presentational.
 */
export default function GuardianCandidateCombobox({
  control,
  candidates,
  status,
  onSearchChange,
}: {
  control: FormFieldControlProps;
  candidates: readonly GuardianCandidate[];
  status: CandidatesStatus;
  onSearchChange: (search: string) => void;
}) {
  const [picked, setPicked] = useState<Option>();
  const items = candidateItems(candidates, picked, control.value);
  const unavailable = status === "unavailable";

  return (
    <Combobox
      items={items}
      filter={null}
      value={items.find((item) => item.value === control.value) ?? null}
      onValueChange={(option: Option | null) => {
        setPicked(option ?? undefined);
        control.onChange({ target: { value: option?.value ?? "" } });
      }}
      onInputValueChange={(text, { reason }) =>
        onSearchChange(reason === "input-change" ? text : "")
      }
      itemToStringLabel={(option: Option) => option.label}
      isItemEqualToValue={(option: Option, value: Option) => option.value === value.value}
      disabled={unavailable}
    >
      <ComboboxInput
        id={control.id}
        name={control.name}
        onBlur={control.onBlur}
        aria-invalid={control["aria-invalid"]}
        aria-describedby={control["aria-describedby"]}
        placeholder="-- Seleccione un acudiente --"
        disabled={unavailable}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>No se encontraron acudientes.</ComboboxEmpty>
        <ComboboxList aria-busy={status === "searching" || status === "loading" || undefined}>
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

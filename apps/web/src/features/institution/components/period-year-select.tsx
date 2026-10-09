import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";

/** Academic-year filter of the INS-15 list card header. Presentational. */
export default function PeriodYearSelect({
  years,
  value,
  onChange,
}: {
  years: readonly string[];
  value: string;
  onChange: (year: string) => void;
}) {
  return (
    <NativeSelect
      aria-label="Año académico"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {years.map((year) => (
        <NativeSelectOption key={year} value={year}>
          {year}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

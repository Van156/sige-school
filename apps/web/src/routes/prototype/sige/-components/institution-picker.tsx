import { RadioGroup, RadioGroupItem } from "@base-template/ui/components/radio-group";
import { cn } from "@base-template/ui/lib/utils";

import type { Institution } from "../-mock/types";

/** Radio cards listing institutions (root selector card and INS-03). */
export function InstitutionPicker({
  institutions,
  value,
  onValueChange,
}: {
  institutions: readonly Institution[];
  value: number | null;
  onValueChange: (id: number) => void;
}) {
  return (
    <RadioGroup
      aria-label="Instituciones disponibles"
      value={value === null ? "" : String(value)}
      onValueChange={(next) => onValueChange(Number(next))}
      className="sm:grid-cols-2"
    >
      {institutions.map((institution) => {
        const selected = institution.id === value;
        const inputId = `institution-${institution.id}`;
        return (
          <label
            key={institution.id}
            htmlFor={inputId}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted/50",
              selected && "border-primary bg-primary/5",
            )}
          >
            <RadioGroupItem id={inputId} value={String(institution.id)} className="mt-0.5" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{institution.name}</span>
              <span className="text-[13px] text-muted-foreground">
                {institution.municipality
                  ? `${institution.municipality}, ${institution.department ?? ""}`
                  : "Ubicación no especificada"}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {institution.nit ? `NIT: ${institution.nit} · ` : ""}Año: {institution.academicYear}
              </span>
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}

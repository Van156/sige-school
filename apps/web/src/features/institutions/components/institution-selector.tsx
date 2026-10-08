import { Button } from "@base-template/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@base-template/ui/components/radio-group";

import { institutionLocation } from "../lib/institution-format";
import type { InstitutionRow } from "../types";

/**
 * INS-03 radio cards: one per institution (name, location, NIT, year, email) and the
 * "Seleccionar y Continuar" submit. Presentational: the caller owns the selection and what
 * submitting does.
 */
export default function InstitutionSelector({
  institutions,
  selectedId,
  onSelect,
  onSubmit,
  isSubmitting = false,
}: {
  institutions: InstitutionRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}) {
  return (
    <form
      aria-label="Seleccionar institución"
      onSubmit={(event) => {
        event.preventDefault();
        if (selectedId) {
          onSubmit();
        }
      }}
      className="flex flex-col gap-4"
    >
      <RadioGroup
        aria-label="Instituciones disponibles"
        value={selectedId ?? ""}
        onValueChange={(value) => onSelect(String(value))}
        disabled={isSubmitting}
      >
        {institutions.map((institution) => (
          <label
            key={institution.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-3 has-data-checked:border-primary has-data-checked:bg-primary/5"
          >
            <RadioGroupItem value={institution.id} className="mt-0.5" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{institution.name}</span>
              <span className="text-[13px] text-muted-foreground">
                {institutionLocation(institution) ?? "Ubicación no especificada"}
              </span>
              <span className="text-xs text-muted-foreground">
                {[
                  institution.nit ? `NIT: ${institution.nit}` : null,
                  `Año: ${institution.academicYear}`,
                  institution.email,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <div>
        <Button type="submit" disabled={selectedId === null || isSubmitting}>
          {isSubmitting ? "Ingresando..." : "Seleccionar y Continuar"}
        </Button>
      </div>
    </form>
  );
}

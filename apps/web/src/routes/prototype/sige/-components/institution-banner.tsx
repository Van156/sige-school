import { Badge } from "@base-template/ui/components/badge";
import { Building2 } from "lucide-react";

import { institution as defaultInstitution } from "../-mock";
import type { Institution } from "../-mock/types";

/** Institution name and location strip shown at the top of staff dashboards. */
export function InstitutionBanner({
  badge,
  institution = defaultInstitution,
}: {
  badge?: string;
  /** Defaults to the San José dataset institution; root screens pass the active one. */
  institution?: Institution;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
      >
        <Building2 className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{institution.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {institution.municipality
            ? `${institution.municipality}, ${institution.department ?? ""}`
            : "Ubicación no especificada"}
        </span>
      </div>
      {badge ? <Badge variant="secondary">{badge}</Badge> : null}
    </div>
  );
}

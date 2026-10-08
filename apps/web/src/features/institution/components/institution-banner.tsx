import { Badge } from "@base-template/ui/components/badge";
import { Building2 } from "lucide-react";

import { formatInstitutionLocation } from "../lib/institution-scope";

/** Institution name and location strip shown at the top of the tenant screens (sige/02 §5.2). */
export default function InstitutionBanner({
  name,
  logo,
  municipality,
  department,
  badge,
}: {
  name: string;
  /** Logo URL; the building icon stands in when absent. */
  logo?: string | null;
  municipality?: string | null;
  department?: string | null;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      {logo ? (
        <img src={logo} alt="" className="size-9 shrink-0 rounded-md object-contain" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <Building2 className="size-4" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {formatInstitutionLocation(municipality, department)}
        </span>
      </div>
      {badge ? <Badge variant="secondary">{badge}</Badge> : null}
    </div>
  );
}

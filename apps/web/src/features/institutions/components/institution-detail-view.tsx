import { Building2 } from "lucide-react";

import { institutionSubtitle, valueOrDash } from "../lib/institution-format";
import type { InstitutionDetail } from "../types";

/** Body of the INS-01 "Datos de la Institución" dialog: identity, contact fields and counts. */
export default function InstitutionDetailView({ institution }: { institution: InstitutionDetail }) {
  const fields = [
    ["NIT", institution.nit],
    ["Teléfono", institution.phone],
    ["Email", institution.email],
    ["Dirección", institution.address],
    ["Resolución", institution.resolution],
  ] as const;
  const stats = [
    ["Sedes", institution.counts.campuses],
    ["Estudiantes", institution.counts.students],
    ["Año Lectivo", institution.academicYear],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {institution.logo ? (
          <img
            src={institution.logo}
            alt={`Logo de ${institution.name}`}
            className="size-14 rounded-md border object-contain"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-md bg-muted text-muted-foreground"
          >
            <Building2 className="size-6" />
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold">{institution.name}</span>
          <span className="text-sm text-muted-foreground">{institutionSubtitle(institution)}</span>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm break-words">{valueOrDash(value)}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid grid-cols-3 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="flex flex-col rounded-md border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

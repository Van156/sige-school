import { Button } from "@base-template/ui/components/button";
import { ClipboardList } from "lucide-react";
import { useState } from "react";

import { EmptyBlock } from "../../-components/empty-block";
import { ObservationCard } from "../../-components/observation-parts";
import { ParentChildPage, type ChildContext } from "../../-components/parent-frame";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { OBSERVATION_LABEL, OBSERVATION_TYPES, countObservations } from "../../-lib/observations";
import { observationStore, useMockCollection } from "../../-mock";

/** PAR-04: observations of the child with counters and a type filter (read-only). */
export function ChildObservationsScreen() {
  return (
    <ParentChildPage screenId="PAR-04" title="Observaciones del hijo/a" section="Observaciones">
      {(context) => <Observations {...context} />}
    </ParentChildPage>
  );
}

function Observations({ student, school }: ChildContext) {
  const [type, setType] = useState("");
  const rows = useMockCollection(observationStore)
    .filter((row) => row.studentId === student.id)
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const counts = countObservations(rows);
  const visible = rows.filter((row) => !type || row.type === type);

  return (
    <>
      <StatGrid>
        <StatTile label="Total" value={counts.total} icon={ClipboardList} />
        <StatTile label="Positivas" value={counts.positiva} tone="success" />
        <StatTile label="Negativas" value={counts.negativa} tone="destructive" />
        <StatTile label="Seguimiento" value={counts.seguimiento + counts.convivencia} tone="info" />
      </StatGrid>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por tipo">
        <span className="text-[13px] text-muted-foreground">Filtrar:</span>
        {[
          { value: "", label: "Todas" },
          ...OBSERVATION_TYPES.map((value) => ({ value, label: OBSERVATION_LABEL[value] })),
        ].map((chip) => (
          <Button
            key={chip.value}
            size="sm"
            variant={type === chip.value ? "default" : "outline"}
            aria-pressed={type === chip.value}
            onClick={() => setType(chip.value)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyBlock
          icon={<ClipboardList />}
          title="No hay observaciones registradas"
          description="Las observaciones aparecerán cuando los profesores las registren."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((row) => (
            <li key={row.id}>
              <ObservationCard
                observation={row}
                authorName={school.userName(row.authorId) ?? "-"}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

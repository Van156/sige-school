import { Badge } from "@base-template/ui/components/badge";

import { SectionCard } from "./section-card";
import { DetailList } from "./detail-list";
import type { ClassInfo } from "./class-context";
import type { GradeCriteria } from "../-mock/types";

/** "Grado / Asignatura / Periodo / Docente" strip plus the criteria weight chips of a class screen. */
export function ClassHeader({
  info,
  criteria,
}: {
  info: ClassInfo;
  /** Pass the criteria to also show the "Criterios y Ponderación" chips. */
  criteria?: readonly GradeCriteria[];
}) {
  return (
    <SectionCard title={`${info.subjectName} · ${info.grade.name}`}>
      <DetailList
        items={[
          ["Grado", info.grade.name],
          ["Asignatura", info.subjectName],
          ...(info.period ? ([["Periodo", info.period.name]] as const) : []),
          ["Docente", info.teacherName],
        ]}
      />
      {criteria ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Criterios y Ponderación:</span>
          {criteria.map((criterion) => (
            <Badge key={criterion.id} variant="outline">
              {criterion.name}: {criterion.weight}%
            </Badge>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}

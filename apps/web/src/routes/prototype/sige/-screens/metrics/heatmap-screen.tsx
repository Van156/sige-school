import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { cn } from "@base-template/ui/lib/utils";
import { Grid3x3 } from "lucide-react";
import { useState } from "react";

import { EmptyBlock } from "../../-components/empty-block";
import { MetricsActions } from "../../-components/metric-parts";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { HEAT_BANDS, heatBand, heatmap, type HeatCell } from "../../-lib/metrics";
import { useMetrics } from "../../-lib/use-metrics";
import type { Institution } from "../../-mock/types";

/** MET-02: failure-rate matrix by course and subject, with a detail dialog per cell. */
export function HeatmapScreen() {
  return (
    <ScopedPage
      screenId="MET-02"
      title="Mapa de Calor de Rendimiento"
      description="Matriz de porcentaje de pérdida por grado y asignatura"
      target="Métricas"
      banner={false}
      actions={<MetricsActions />}
    >
      {(institution) => <Heatmap institution={institution} />}
    </ScopedPage>
  );
}

function Heatmap({ institution }: { institution: Institution }) {
  const metrics = useMetrics(institution.id);
  const { subjects, cells } = heatmap(metrics);
  const [selected, setSelected] = useState<HeatCell | null>(null);

  return (
    <>
      <SectionCard title="Leyenda - Porcentaje de Pérdida">
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
          {HEAT_BANDS.map((band) => (
            <li key={band.label} className="flex items-center gap-2">
              <span className={cn("size-4 rounded-sm border", band.className)} aria-hidden="true" />
              {band.label}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="size-4 rounded-sm border bg-muted" aria-hidden="true" />
            Sin datos
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="Matriz Grado x Asignatura">
        {cells.size === 0 ? (
          <EmptyBlock icon={<Grid3x3 />} title="No hay datos disponibles para el mapa de calor." />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Grado / Sede</TableHead>
                  {subjects.map((subject) => (
                    <TableHead key={subject.id} className="text-center">
                      <span title={subject.name}>{subject.code ?? subject.name}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.school.grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium">{grade.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {metrics.school.campusName(grade.campusId)}
                        </span>
                      </div>
                    </TableCell>
                    {subjects.map((subject) => {
                      const cell = cells.get(`${grade.id}:${subject.id}`);
                      return (
                        <TableCell key={subject.id} className="p-1 text-center">
                          {cell ? (
                            <button
                              type="button"
                              onClick={() => setSelected(cell)}
                              title={`${subject.name} - ${grade.name}: ${cell.failureRate}% pérdida | Promedio: ${cell.average.toFixed(2)} | Total: ${cell.total} | Perdidas: ${cell.failed}`}
                              className={cn(
                                "flex w-full min-w-14 flex-col items-center rounded-md px-1 py-1.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                                heatBand(cell.failureRate).className,
                              )}
                            >
                              <span className="font-semibold tabular-nums">
                                {cell.failureRate}%
                              </span>
                              <span className="tabular-nums opacity-80">
                                Prom: {cell.average.toFixed(1)}
                              </span>
                            </button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => (open ? undefined : setSelected(null))}
      >
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Detalle de Celda</DialogTitle>
                <DialogDescription>
                  Grado: <strong>{selected.grade.name}</strong> · Asignatura:{" "}
                  <strong>{selected.subject.name}</strong>
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                {(
                  [
                    ["% Pérdida", `${selected.failureRate}%`],
                    ["Promedio", selected.average.toFixed(2)],
                    ["Total Notas", selected.total],
                    ["Perdidas", selected.failed],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-col rounded-md bg-muted/50 px-2 py-2">
                    <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                  </div>
                ))}
              </dl>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { Button } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";
import { FileDown } from "lucide-react";

import { BackButton } from "./form-layout";
import { SimpleTable, type TableColumn } from "./simple-table";
import { ToneBadge } from "./tone-badge";
import { formatPercent, formatScore } from "../-lib/format";
import type { PerformanceRow } from "../-lib/metrics";
import { mockInfo } from "../-mock";

/** Pass-rate figure with a thin bar: green from 80%, amber from 60%, red below (inventory 3.11). */
export function PassRateBar({ value }: { value: number }) {
  const tone = value >= 80 ? "bg-success" : value >= 60 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex min-w-24 flex-col gap-1">
      <span className="tabular-nums">{formatPercent(value, 1)}</span>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full", tone)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

/** Mean score coloured by band: 4.0+ green, 3.0+ amber, below red. */
export function ScoreText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">-</span>;
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        value >= 4 ? "text-success" : value >= 3 ? "text-foreground" : "text-destructive",
      )}
    >
      {formatScore(value)}
    </span>
  );
}

/** Header actions of the metrics sub-screens: back to MET-01 plus the (stub) export. */
export function MetricsActions({ exportLabel = "Exportar" }: { exportLabel?: string }) {
  return (
    <>
      <Button
        variant="outline"
        onClick={() => mockInfo(exportLabel, "La descarga no existe en el prototipo.")}
      >
        <FileDown data-icon="inline-start" />
        {exportLabel}
      </Button>
      <BackButton screenId="MET-01" label="Volver a Métricas" />
    </>
  );
}

/** Campus / course performance table of MET-01. */
export function PerformanceTable({
  rows,
  labelHeader,
  sublabelHeader,
  emptyText,
}: {
  rows: readonly PerformanceRow[];
  labelHeader: string;
  sublabelHeader?: string;
  emptyText: string;
}) {
  const columns: TableColumn<PerformanceRow>[] = [
    {
      key: "label",
      header: labelHeader,
      sortValue: (row) => row.label,
      cell: (row) => <span className="font-medium">{row.label}</span>,
    },
    ...(sublabelHeader
      ? [
          {
            key: "sublabel",
            header: sublabelHeader,
            cell: (row: PerformanceRow) => row.sublabel ?? "-",
          } satisfies TableColumn<PerformanceRow>,
        ]
      : []),
    {
      key: "students",
      header: "Estudiantes",
      align: "right",
      sortValue: (row) => row.students,
      cell: (row) => <span className="tabular-nums">{row.students}</span>,
    },
    {
      key: "average",
      header: "Promedio",
      align: "right",
      sortValue: (row) => row.average,
      cell: (row) => <ScoreText value={row.average} />,
    },
    {
      key: "passRate",
      header: "% Aprobación",
      sortValue: (row) => row.passRate,
      cell: (row) => <PassRateBar value={row.passRate} />,
    },
    {
      key: "atRisk",
      header: "En Riesgo",
      align: "right",
      sortValue: (row) => row.atRisk,
      cell: (row) =>
        row.atRisk > 0 ? (
          <ToneBadge tone="destructive">{row.atRisk}</ToneBadge>
        ) : (
          <span className="tabular-nums">0</span>
        ),
    },
  ];
  return (
    <SimpleTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      empty={<p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>}
    />
  );
}

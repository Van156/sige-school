import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Bell,
  BellRing,
  CheckCheck,
  Eye,
  FileDown,
  History,
  Play,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import {
  ALERT_TYPE_COLOR,
  ALERT_TYPE_SHORT,
  AlertStatusBadge,
  AlertTypeBadge,
} from "../../-components/alert-parts";
import { CategoryBarChart, DonutChart } from "../../-components/charts";
import { EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { IconLink } from "../../-components/icon-link";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import type { TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { SeverityBadge } from "../../-components/tone-badge";
import { capitalize, formatDateTime } from "../../-lib/format";
import { truncate } from "../../-lib/list";
import { useSchool } from "../../-lib/use-school";
import {
  ALERT_RULES,
  ALERT_TYPE_LABEL,
  alertStore,
  mockInfo,
  useMockCollection,
} from "../../-mock";
import type { Alert, Institution, Severity } from "../../-mock/types";

const SEVERITIES: readonly Severity[] = ["alta", "media", "baja"];
const SEVERITY_COLOR: Record<Severity, string> = {
  alta: "var(--destructive)",
  media: "var(--warning)",
  baja: "var(--success)",
};

/** ALR-01: alerts panel with KPIs, charts, filters and the alerts table. */
export function AlertsScreen() {
  return (
    <ScopedPage
      screenId="ALR-01"
      title="Alertas Tempranas"
      description="Detección automática de riesgo académico, inasistencia y deserción"
      target="Alertas"
      banner={false}
      actions={
        <>
          <ScreenLinkButton screenId="ALR-03" variant="default">
            <Play data-icon="inline-start" />
            Ejecutar Motor
          </ScreenLinkButton>
          <Button
            variant="outline"
            onClick={() => mockInfo("Exportar CSV", "La descarga no existe en el prototipo.")}
          >
            <FileDown data-icon="inline-start" />
            Exportar CSV
          </Button>
        </>
      }
    >
      {(institution) => <AlertsView institution={institution} />}
    </ScopedPage>
  );
}

function AlertsView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const all = useMockCollection(alertStore).filter((alert) =>
    school.studentById.has(alert.studentId),
  );
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [state, setState] = useState("");

  const active = all.filter((alert) => !alert.resolved);
  const rows = all
    .filter(
      (alert) =>
        (!type || alert.alertType === type) &&
        (!severity || alert.severity === severity) &&
        (!state || String(alert.resolved) === state),
    )
    .toSorted((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));

  const columns: TableColumn<Alert>[] = [
    {
      key: "id",
      header: "ID",
      sortValue: (row) => row.id,
      cell: (row) => <span className="tabular-nums">#{row.id}</span>,
    },
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => school.studentName(row.studentId),
      cell: (row) => <span className="font-medium">{school.studentName(row.studentId)}</span>,
    },
    {
      key: "type",
      header: "Tipo",
      sortValue: (row) => row.alertType,
      cell: (row) => <AlertTypeBadge type={row.alertType} />,
    },
    {
      key: "severity",
      header: "Severidad",
      sortValue: (row) => SEVERITIES.indexOf(row.severity),
      cell: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      key: "title",
      header: "Título",
      className: "max-w-60",
      cell: (row) => <span title={row.title}>{truncate(row.title, 50)}</span>,
    },
    {
      key: "date",
      header: "Fecha",
      sortValue: (row) => row.triggeredAt,
      cell: (row) => <span className="tabular-nums">{formatDateTime(row.triggeredAt)}</span>,
    },
    {
      key: "state",
      header: "Estado",
      sortValue: (row) => String(row.resolved),
      cell: (row) => <AlertStatusBadge resolved={row.resolved} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-12",
      cell: (row) => (
        <IconLink
          screenId="ALR-02"
          search={{ id: String(row.id) }}
          label={`Ver detalle de la alerta #${row.id}`}
        >
          <Eye />
        </IconLink>
      ),
    },
  ];

  return (
    <>
      <StatGrid>
        <StatTile label="Alertas Activas" value={active.length} icon={BellRing} tone="warning" />
        <StatTile
          label="Resueltas"
          value={all.length - active.length}
          icon={CheckCheck}
          tone="success"
        />
        <StatTile label="Total Histórico" value={all.length} icon={History} />
        <StatTile
          label="Severidad Alta"
          value={active.filter((alert) => alert.severity === "alta").length}
          icon={TriangleAlert}
          tone="destructive"
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Alertas por Tipo">
          <CategoryBarChart
            ariaLabel="Alertas activas por tipo"
            seriesLabel="Alertas Activas"
            data={ALERT_RULES.map((rule) => ({
              label: ALERT_TYPE_SHORT[rule.type],
              value: active.filter((alert) => alert.alertType === rule.type).length,
              color: ALERT_TYPE_COLOR[rule.type],
            }))}
          />
        </SectionCard>
        <SectionCard title="Alertas por Severidad">
          <DonutChart
            ariaLabel="Alertas activas por severidad"
            data={SEVERITIES.map((value) => ({
              label: capitalize(value),
              value: active.filter((alert) => alert.severity === value).length,
              color: SEVERITY_COLOR[value],
            }))}
          />
        </SectionCard>
      </div>

      <EntityList
        title="Listado de Alertas"
        action={<Badge variant="secondary">{rows.length} alertas</Badge>}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        searchText={(row) => [
          school.studentName(row.studentId),
          row.title,
          ALERT_TYPE_LABEL[row.alertType],
        ]}
        searchPlaceholder="Buscar por estudiante o título"
        emptyIcon={<Bell />}
        emptyTitle="No hay alertas"
        emptyDescription="No se encontraron alertas con los filtros aplicados."
        filters={
          <>
            <FilterSelect
              label="Filtrar por tipo de alerta"
              value={type}
              onValueChange={setType}
              options={ALERT_RULES.map((rule) => ({ value: rule.type, label: rule.label }))}
              allLabel="Todos los tipos"
            />
            <FilterSelect
              label="Filtrar por severidad"
              value={severity}
              onValueChange={setSeverity}
              options={SEVERITIES.map((value) => ({ value, label: capitalize(value) }))}
              allLabel="Todas las severidades"
            />
            <FilterSelect
              label="Filtrar por estado"
              value={state}
              onValueChange={setState}
              options={[
                { value: "false", label: "Activas" },
                { value: "true", label: "Resueltas" },
              ]}
              allLabel="Todas"
            />
            {type || severity || state ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setType("");
                  setSeverity("");
                  setState("");
                }}
              >
                Limpiar
              </Button>
            ) : null}
          </>
        }
      />
    </>
  );
}

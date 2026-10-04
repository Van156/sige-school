import { CalendarRange } from "lucide-react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import type { TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { reportDelete } from "../../-lib/delete-report";
import { formatDate } from "../../-lib/format";
import { useCan } from "../../-lib/permissions";
import { deletePeriod, periodStore, useMockCollection } from "../../-mock";
import type { AcademicPeriod } from "../../-mock/types";

/** INS-15: academic periods of the scoped institution. */
export function PeriodsScreen() {
  const periodList = useMockCollection(periodStore);
  const canManage = useCan("INS-16");

  return (
    <ScopedPage
      screenId="INS-15"
      title="Periodos Académicos"
      description="Divisiones del año lectivo en las que se cierran las notas"
      target="Periodos"
      actions={<CreateButton screenId="INS-16" label="Nuevo Periodo" canCreate={canManage} />}
    >
      {(institution) => {
        const rows = periodList
          .filter((period) => period.institutionId === institution.id)
          .sort((a, b) => a.academicYear.localeCompare(b.academicYear) || a.order - b.order);
        const columns: TableColumn<AcademicPeriod>[] = [
          {
            key: "name",
            header: "Nombre",
            sortValue: (period) => period.order,
            cell: (period) => <span className="font-medium">{period.name}</span>,
          },
          {
            key: "short",
            header: "Nombre Corto",
            cell: (period) => period.shortName,
          },
          {
            key: "start",
            header: "Fecha Inicio",
            sortValue: (period) => period.startDate,
            cell: (period) => <span className="tabular-nums">{formatDate(period.startDate)}</span>,
          },
          {
            key: "end",
            header: "Fecha Fin",
            sortValue: (period) => period.endDate,
            cell: (period) => <span className="tabular-nums">{formatDate(period.endDate)}</span>,
          },
          {
            key: "year",
            header: "Año Académico",
            sortValue: (period) => period.academicYear,
            cell: (period) => period.academicYear,
          },
          {
            key: "active",
            header: "Activo",
            sortValue: (period) => Number(period.isActive),
            cell: (period) => (
              <ToneBadge tone={period.isActive ? "success" : "secondary"}>
                {period.isActive ? "Activo" : "Inactivo"}
              </ToneBadge>
            ),
          },
          ...(canManage
            ? [
                {
                  key: "actions",
                  header: <span className="sr-only">Acciones</span>,
                  className: "w-24",
                  cell: (period: AcademicPeriod) => (
                    <RowActions
                      editScreenId="INS-16"
                      id={period.id}
                      entity="periodo"
                      name={period.name}
                      onDelete={() =>
                        reportDelete(deletePeriod(period.id), "Periodo eliminado", period.name)
                      }
                    />
                  ),
                },
              ]
            : []),
        ];
        return (
          <EntityList
            title="Listado de Periodos"
            columns={columns}
            rows={rows}
            getRowId={(period) => period.id}
            searchText={(period) => [period.name, period.shortName, period.academicYear]}
            searchPlaceholder="Buscar periodo"
            emptyIcon={<CalendarRange />}
            emptyTitle="No hay periodos académicos"
            emptyDescription="Crea los periodos del año lectivo (generalmente cuatro)."
            create={canManage ? { screenId: "INS-16", label: "Crear Primer Periodo" } : undefined}
          />
        );
      }}
    </ScopedPage>
  );
}

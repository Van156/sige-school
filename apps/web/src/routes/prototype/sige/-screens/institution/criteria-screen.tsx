import { ClipboardCheck } from "lucide-react";

import { Callout } from "../../-components/callout";
import { CreateButton, EntityList } from "../../-components/entity-list";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import type { TableColumn } from "../../-components/simple-table";
import { reportDelete } from "../../-lib/delete-report";
import { truncate } from "../../-lib/list";
import { useCan } from "../../-lib/permissions";
import { criteriaStore, deleteCriterion, round, useMockCollection } from "../../-mock";
import type { GradeCriteria } from "../../-mock/types";

/** INS-17: evaluation criteria and their weights; warns when the weights do not add up to 100. */
export function CriteriaScreen() {
  const criteriaList = useMockCollection(criteriaStore);
  const canManage = useCan("INS-18");

  return (
    <ScopedPage
      screenId="INS-17"
      title="Criterios de Evaluación"
      description="Definen cómo se calculan las notas de cada periodo"
      target="Criterios"
      actions={<CreateButton screenId="INS-18" label="Nuevo Criterio" canCreate={canManage} />}
    >
      {(institution) => {
        const rows = criteriaList
          .filter((criterion) => criterion.institutionId === institution.id)
          .sort((a, b) => a.order - b.order);
        const total = round(rows.reduce((sum, criterion) => sum + criterion.weight, 0));
        const columns: TableColumn<GradeCriteria>[] = [
          {
            key: "name",
            header: "Nombre",
            sortValue: (criterion) => criterion.name,
            cell: (criterion) => <span className="font-medium">{criterion.name}</span>,
          },
          {
            key: "weight",
            header: "Peso (%)",
            align: "right",
            sortValue: (criterion) => criterion.weight,
            cell: (criterion) => <span className="tabular-nums">{criterion.weight}%</span>,
          },
          {
            key: "description",
            header: "Descripción",
            cell: (criterion) => (
              <span className="text-muted-foreground">
                {criterion.description ? truncate(criterion.description, 50) : "-"}
              </span>
            ),
          },
          {
            key: "order",
            header: "Orden",
            align: "right",
            sortValue: (criterion) => criterion.order,
            cell: (criterion) => <span className="tabular-nums">{criterion.order}</span>,
          },
          ...(canManage
            ? [
                {
                  key: "actions",
                  header: <span className="sr-only">Acciones</span>,
                  className: "w-24",
                  cell: (criterion: GradeCriteria) => (
                    <RowActions
                      editScreenId="INS-18"
                      id={criterion.id}
                      entity="criterio"
                      name={criterion.name}
                      onDelete={() =>
                        reportDelete(
                          deleteCriterion(criterion.id),
                          "Criterio eliminado",
                          criterion.name,
                        )
                      }
                    />
                  ),
                },
              ]
            : []),
        ];

        return (
          <EntityList
            title="Listado de Criterios"
            columns={columns}
            rows={rows}
            getRowId={(criterion) => criterion.id}
            searchText={(criterion) => [criterion.name, criterion.description]}
            searchPlaceholder="Buscar criterio"
            emptyIcon={<ClipboardCheck />}
            emptyTitle="No hay criterios de evaluación"
            emptyDescription="Define los criterios con los que se calcula la nota de cada periodo."
            create={canManage ? { screenId: "INS-18", label: "Crear Primer Criterio" } : undefined}
            footer={
              rows.length === 0 ? null : total === 100 ? (
                <p className="text-[13px] text-muted-foreground tabular-nums">
                  Peso total: <span className="font-medium text-foreground">{total}%</span>
                </p>
              ) : (
                <Callout tone="warning" title={`Los pesos suman ${total}%`}>
                  Los pesos de los criterios deben sumar 100% para calcular bien las notas finales.
                </Callout>
              )
            }
          />
        );
      }}
    </ScopedPage>
  );
}

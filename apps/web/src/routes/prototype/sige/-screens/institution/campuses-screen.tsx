import { Badge } from "@base-template/ui/components/badge";
import { Building2, CircleCheck, CircleOff, Star } from "lucide-react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import type { TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { reportDelete } from "../../-lib/delete-report";
import { JORNADA_LABEL } from "../../-lib/format";
import { useCan } from "../../-lib/permissions";
import { campusStore, deleteCampus, gradeStore, useMockCollection } from "../../-mock";
import type { Campus } from "../../-mock/types";

/** INS-07: campuses of the scoped institution. */
export function CampusesScreen() {
  const campusList = useMockCollection(campusStore);
  const gradeList = useMockCollection(gradeStore);
  const canManage = useCan("INS-08");

  return (
    <ScopedPage
      screenId="INS-07"
      title="Gestión de Sedes"
      description="Administra las sedes de tu institución educativa"
      target="Sedes"
      actions={<CreateButton screenId="INS-08" label="Nueva Sede" canCreate={canManage} />}
    >
      {(institution) => {
        const rows = campusList.filter((campus) => campus.institutionId === institution.id);
        const active = rows.filter((campus) => campus.active).length;
        const main = rows.find((campus) => campus.isMainCampus);

        const columns: TableColumn<Campus>[] = [
          {
            key: "code",
            header: "Código",
            sortValue: (campus) => campus.code ?? "",
            cell: (campus) => (campus.code ? <Badge variant="outline">{campus.code}</Badge> : "-"),
          },
          {
            key: "name",
            header: "Nombre",
            sortValue: (campus) => campus.name,
            cell: (campus) => <span className="font-medium">{campus.name}</span>,
          },
          {
            key: "address",
            header: "Dirección",
            cell: (campus) => campus.address ?? "-",
          },
          {
            key: "jornada",
            header: "Jornada",
            sortValue: (campus) => campus.jornada,
            cell: (campus) => <Badge variant="secondary">{JORNADA_LABEL[campus.jornada]}</Badge>,
          },
          {
            key: "type",
            header: "Tipo",
            sortValue: (campus) => Number(campus.isMainCampus),
            cell: (campus) => (
              <ToneBadge tone={campus.isMainCampus ? "warning" : "outline"}>
                {campus.isMainCampus ? "Principal" : "Secundaria"}
              </ToneBadge>
            ),
          },
          {
            key: "status",
            header: "Estado",
            sortValue: (campus) => Number(campus.active),
            cell: (campus) => (
              <ToneBadge tone={campus.active ? "success" : "secondary"}>
                {campus.active ? "Activa" : "Inactiva"}
              </ToneBadge>
            ),
          },
          {
            key: "grades",
            header: "Grados",
            align: "center",
            sortValue: (campus) => gradeList.filter((grade) => grade.campusId === campus.id).length,
            cell: (campus) => (
              <Badge variant="info">
                {gradeList.filter((grade) => grade.campusId === campus.id).length}
              </Badge>
            ),
          },
          ...(canManage
            ? [
                {
                  key: "actions",
                  header: <span className="sr-only">Acciones</span>,
                  className: "w-24",
                  cell: (campus: Campus) => (
                    <RowActions
                      editScreenId="INS-08"
                      id={campus.id}
                      entity="sede"
                      name={campus.name}
                      onDelete={() =>
                        reportDelete(deleteCampus(campus.id), "Sede eliminada", campus.name)
                      }
                    />
                  ),
                },
              ]
            : []),
        ];

        return (
          <>
            <StatGrid>
              <StatTile label="Total Sedes" value={rows.length} icon={Building2} />
              <StatTile label="Sedes Activas" value={active} icon={CircleCheck} tone="success" />
              <StatTile
                label="Sede Principal"
                value={main ? main.name : "-"}
                icon={Star}
                tone="warning"
              />
              <StatTile label="Sedes Inactivas" value={rows.length - active} icon={CircleOff} />
            </StatGrid>
            <EntityList
              title="Listado de Sedes"
              columns={columns}
              rows={rows}
              getRowId={(campus) => campus.id}
              searchText={(campus) => [campus.name, campus.code, campus.address]}
              searchPlaceholder="Buscar sede"
              emptyIcon={<Building2 />}
              emptyTitle="No hay sedes registradas"
              emptyDescription="Crea la primera sede para esta institución."
              create={canManage ? { screenId: "INS-08", label: "Crear Primera Sede" } : undefined}
            />
          </>
        );
      }}
    </ScopedPage>
  );
}

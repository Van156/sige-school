import { Badge } from "@base-template/ui/components/badge";
import { Layers } from "lucide-react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import type { TableColumn } from "../../-components/simple-table";
import { reportDelete } from "../../-lib/delete-report";
import { pluralize } from "../../-lib/format";
import { useCan } from "../../-lib/permissions";
import {
  campusStore,
  deleteGradeLevel,
  gradeLevelStore,
  gradeStore,
  useMockCollection,
} from "../../-mock";
import type { GradeLevel } from "../../-mock/types";

/** INS-09: academic levels ("Sexto", "Once") of the scoped institution, per campus. */
export function LevelsScreen() {
  const campusList = useMockCollection(campusStore);
  const levelList = useMockCollection(gradeLevelStore);
  const gradeList = useMockCollection(gradeStore);
  const canManage = useCan("INS-10");

  return (
    <ScopedPage
      screenId="INS-09"
      title="Niveles Académicos"
      description="Gestiona los niveles académicos (Primero, Sexto, Once, etc.) por sede"
      target="Niveles"
      actions={<CreateButton screenId="INS-10" label="Nuevo Nivel" canCreate={canManage} />}
    >
      {(institution) => {
        const campuses = campusList.filter((campus) => campus.institutionId === institution.id);
        const campusName = new Map(campuses.map((campus) => [campus.id, campus.name]));
        const rows = levelList
          .filter((level) => campusName.has(level.campusId))
          .sort((a, b) => a.orderNum - b.orderNum);

        const columns: TableColumn<GradeLevel>[] = [
          {
            key: "order",
            header: "Orden",
            sortValue: (level) => level.orderNum,
            cell: (level) => <Badge variant="secondary">{level.orderNum}</Badge>,
          },
          {
            key: "name",
            header: "Nombre del Nivel",
            sortValue: (level) => level.name,
            cell: (level) => <span className="font-medium">{level.name}</span>,
          },
          {
            key: "campus",
            header: "Sede",
            sortValue: (level) => campusName.get(level.campusId) ?? "",
            cell: (level) => campusName.get(level.campusId) ?? "-",
          },
          {
            key: "courses",
            header: "Cursos Asociados",
            sortValue: (level) => gradeList.filter((grade) => grade.levelId === level.id).length,
            cell: (level) =>
              pluralize(
                gradeList.filter((grade) => grade.levelId === level.id).length,
                "curso",
                "cursos",
              ),
          },
          ...(canManage
            ? [
                {
                  key: "actions",
                  header: <span className="sr-only">Acciones</span>,
                  className: "w-24",
                  cell: (level: GradeLevel) => (
                    <RowActions
                      editScreenId="INS-10"
                      id={level.id}
                      entity="nivel"
                      name={level.name}
                      onDelete={() =>
                        reportDelete(deleteGradeLevel(level.id), "Nivel eliminado", level.name)
                      }
                    />
                  ),
                },
              ]
            : []),
        ];

        return (
          <>
            <StatGrid columns={3}>
              <StatTile label="Niveles Registrados" value={rows.length} icon={Layers} />
            </StatGrid>
            <EntityList
              title="Listado de Niveles"
              columns={columns}
              rows={rows}
              getRowId={(level) => level.id}
              searchText={(level) => [level.name, campusName.get(level.campusId)]}
              searchPlaceholder="Buscar nivel"
              emptyIcon={<Layers />}
              emptyTitle="No hay niveles académicos"
              emptyDescription='Crea niveles como "Primero", "Sexto", "Once" para agrupar tus cursos.'
              create={canManage ? { screenId: "INS-10", label: "Crear Primer Nivel" } : undefined}
            />
          </>
        );
      }}
    </ScopedPage>
  );
}

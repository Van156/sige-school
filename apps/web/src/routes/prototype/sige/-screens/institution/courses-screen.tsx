import { Badge } from "@base-template/ui/components/badge";
import { Building2, GraduationCap, UserCheck } from "lucide-react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import type { TableColumn } from "../../-components/simple-table";
import { reportDelete } from "../../-lib/delete-report";
import { useCan } from "../../-lib/permissions";
import {
  campusStore,
  deleteGrade,
  fullName,
  gradeStore,
  studentStore,
  useMockCollection,
  userStore,
} from "../../-mock";
import type { Grade } from "../../-mock/types";

/** INS-11: courses (grados / grupos) of the scoped institution. */
export function CoursesScreen() {
  const campusList = useMockCollection(campusStore);
  const gradeList = useMockCollection(gradeStore);
  const userList = useMockCollection(userStore);
  const studentList = useMockCollection(studentStore);
  const canManage = useCan("INS-12");

  return (
    <ScopedPage
      screenId="INS-11"
      title="Gestión de Grados"
      description="Administra los grados de tu institución educativa"
      target="Grados"
      actions={<CreateButton screenId="INS-12" label="Nuevo Grado" canCreate={canManage} />}
    >
      {(institution) => {
        const campusName = new Map(
          campusList
            .filter((campus) => campus.institutionId === institution.id)
            .map((campus) => [campus.id, campus.name]),
        );
        const rows = gradeList.filter((grade) => campusName.has(grade.campusId));
        const studentCount = (grade: Grade) =>
          studentList.filter(
            (student) => student.gradeId === grade.id && student.status === "activo",
          ).length;
        const director = (grade: Grade) => {
          const user = userList.find((entry) => entry.id === grade.directorId);
          return user ? fullName(user) : undefined;
        };

        const columns: TableColumn<Grade>[] = [
          {
            key: "name",
            header: "Nombre",
            sortValue: (grade) => grade.name,
            cell: (grade) => <span className="font-medium">{grade.name}</span>,
          },
          {
            key: "campus",
            header: "Sede",
            sortValue: (grade) => campusName.get(grade.campusId) ?? "",
            cell: (grade) => <Badge variant="outline">{campusName.get(grade.campusId)}</Badge>,
          },
          {
            key: "director",
            header: "Director de Grupo",
            sortValue: (grade) => director(grade) ?? "",
            cell: (grade) =>
              director(grade) ?? <span className="text-muted-foreground">Sin asignar</span>,
          },
          {
            key: "year",
            header: "Año Lectivo",
            sortValue: (grade) => grade.academicYear,
            cell: (grade) => <Badge variant="secondary">{grade.academicYear}</Badge>,
          },
          {
            key: "shift",
            header: "Jornada",
            sortValue: (grade) => grade.shift,
            cell: (grade) => <Badge variant="info">{grade.shift}</Badge>,
          },
          {
            key: "capacity",
            header: "Capacidad",
            align: "right",
            sortValue: (grade) => grade.maxStudents,
            cell: (grade) => <span className="tabular-nums">{grade.maxStudents}</span>,
          },
          {
            key: "students",
            header: "Estudiantes",
            align: "right",
            sortValue: studentCount,
            cell: (grade) => <span className="tabular-nums">{studentCount(grade)}</span>,
          },
          ...(canManage
            ? [
                {
                  key: "actions",
                  header: <span className="sr-only">Acciones</span>,
                  className: "w-24",
                  cell: (grade: Grade) => (
                    <RowActions
                      editScreenId="INS-12"
                      id={grade.id}
                      entity="grado"
                      name={grade.name}
                      onDelete={() =>
                        reportDelete(deleteGrade(grade.id), "Grado eliminado", grade.name)
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
              <StatTile label="Total Grados" value={rows.length} icon={GraduationCap} />
              <StatTile
                label="Sedes con Grados"
                value={new Set(rows.map((grade) => grade.campusId)).size}
                icon={Building2}
                tone="info"
              />
              <StatTile
                label="Con Director"
                value={rows.filter((grade) => grade.directorId !== undefined).length}
                icon={UserCheck}
                tone="success"
              />
            </StatGrid>
            <EntityList
              title="Listado de Grados"
              columns={columns}
              rows={rows}
              getRowId={(grade) => grade.id}
              searchText={(grade) => [
                grade.name,
                campusName.get(grade.campusId),
                director(grade),
                grade.shift,
              ]}
              searchPlaceholder="Buscar grado"
              emptyIcon={<GraduationCap />}
              emptyTitle="No hay grados registrados"
              emptyDescription="Crea el primer grado para esta institución."
              create={canManage ? { screenId: "INS-12", label: "Crear Primer Grado" } : undefined}
            />
          </>
        );
      }}
    </ScopedPage>
  );
}

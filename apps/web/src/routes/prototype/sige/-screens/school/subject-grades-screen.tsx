import { Badge } from "@base-template/ui/components/badge";
import { BookOpenCheck, Clock, UserX, Users } from "lucide-react";
import { useState } from "react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { ScreenLinkButton } from "../../-components/link-button";
import { ConfirmDeleteButton } from "../../-components/confirm-delete";
import { ScopedPage } from "../../-components/scoped-page";
import type { TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { reportDelete } from "../../-lib/delete-report";
import { gradeOptions } from "../../-lib/school-options";
import { useSchool } from "../../-lib/use-school";
import { deleteSubjectGrade, type SubjectGradeRecord } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** SCH-05: subjects taught in each course ("Materias por Grado") with their teacher and weekly hours. */
export function SubjectGradesScreen() {
  return (
    <ScopedPage
      screenId="SCH-05"
      title="Materias por Grado"
      description="Asignar materias a grados"
      target="Materias por Grado"
      actions={
        <>
          <ScreenLinkButton screenId="SCH-03">
            <Users data-icon="inline-start" />
            Ver Asignaciones
          </ScreenLinkButton>
          <CreateButton screenId="SCH-06" label="Asignar Materias" canCreate />
        </>
      }
    >
      {(institution) => <SubjectGradesView institution={institution} />}
    </ScopedPage>
  );
}

function SubjectGradesView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const [gradeId, setGradeId] = useState("");

  const rows = school.subjectGrades.filter((item) => !gradeId || String(item.gradeId) === gradeId);
  const subjectOf = (item: SubjectGradeRecord) => school.subjectName(item.subjectId);
  const gradeOf = (item: SubjectGradeRecord) => school.gradeName(item.gradeId) ?? "-";

  const columns: TableColumn<SubjectGradeRecord>[] = [
    {
      key: "subject",
      header: "Materia",
      sortValue: subjectOf,
      cell: (item) => <span className="font-medium">{subjectOf(item)}</span>,
    },
    {
      key: "grade",
      header: "Grado",
      sortValue: gradeOf,
      cell: (item) => <Badge variant="outline">{gradeOf(item)}</Badge>,
    },
    {
      key: "hours",
      header: "Intensidad",
      align: "right",
      sortValue: (item) => item.hoursPerWeek,
      cell: (item) => (
        <Badge variant="secondary" className="tabular-nums">
          {item.hoursPerWeek}h
        </Badge>
      ),
    },
    {
      key: "teacher",
      header: "Profesor Asignado",
      sortValue: (item) => school.userName(item.teacherId) ?? "",
      cell: (item) => {
        const name = school.userName(item.teacherId);
        return name ? (
          <Badge variant="info">{name}</Badge>
        ) : (
          <span className="text-muted-foreground">Sin asignar</span>
        );
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-16",
      cell: (item) => (
        <div className="flex justify-end">
          <ConfirmDeleteButton
            label={`Eliminar ${subjectOf(item)} de ${gradeOf(item)}`}
            title={`¿Eliminar ${subjectOf(item)} de ${gradeOf(item)}?`}
            description="Esta acción no se puede deshacer."
            onConfirm={() =>
              reportDelete(
                deleteSubjectGrade(item.id),
                "Materia desasignada",
                `${subjectOf(item)} · ${gradeOf(item)}`,
              )
            }
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <StatGrid columns={3}>
        <StatTile
          label="Materias Asignadas"
          value={school.subjectGrades.length}
          icon={BookOpenCheck}
        />
        <StatTile
          label="Horas Semanales"
          value={school.subjectGrades.reduce((sum, item) => sum + item.hoursPerWeek, 0)}
          icon={Clock}
          tone="info"
        />
        <StatTile
          label="Sin Profesor"
          value={school.subjectGrades.filter((item) => item.teacherId === undefined).length}
          icon={UserX}
          tone="warning"
        />
      </StatGrid>
      <EntityList
        title="Materias por Grado"
        columns={columns}
        rows={rows}
        getRowId={(item) => item.id}
        searchText={(item) => [subjectOf(item), gradeOf(item), school.userName(item.teacherId)]}
        searchPlaceholder="Buscar materia, grado o profesor"
        emptyIcon={<BookOpenCheck />}
        emptyTitle="No hay materias asignadas a grados"
        emptyDescription="Asigne materias a los grados del año académico."
        create={{ screenId: "SCH-06", label: "Asignar Materias" }}
        filters={
          <FilterSelect
            label="Filtrar por grado"
            value={gradeId}
            onValueChange={setGradeId}
            options={gradeOptions(school.grades)}
            allLabel="Todos los grados"
          />
        }
      />
    </>
  );
}

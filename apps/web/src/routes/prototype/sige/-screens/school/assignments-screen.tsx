import { Badge } from "@base-template/ui/components/badge";
import { BookOpenCheck, CalendarDays, UserCheck, Users } from "lucide-react";
import { useState } from "react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { ScreenLinkButton } from "../../-components/link-button";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import type { TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { ToneBadge } from "../../-components/tone-badge";
import { formatDate } from "../../-lib/format";
import { ASSIGNMENT_LABEL, ASSIGNMENT_TONE, gradeOptions } from "../../-lib/school-options";
import { useSchool } from "../../-lib/use-school";
import { deleteAssignment, mockAction } from "../../-mock";
import type { Institution, TeacherSubjectAssignment } from "../../-mock/types";

/** SCH-03: teacher assignments per subject and course. */
export function AssignmentsScreen() {
  return (
    <ScopedPage
      screenId="SCH-03"
      title="Asignación de Profesores"
      description="Asignar profesores a materias por grado"
      target="Asignaciones"
      actions={
        <>
          <ScreenLinkButton screenId="SCH-05">
            <BookOpenCheck data-icon="inline-start" />
            Ver Materias por Grado
          </ScreenLinkButton>
          <CreateButton screenId="SCH-04" label="Nueva Asignación" canCreate />
        </>
      }
    >
      {(institution) => <AssignmentsView institution={institution} />}
    </ScopedPage>
  );
}

function AssignmentsView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const [gradeId, setGradeId] = useState("");

  const itemOf = (row: TeacherSubjectAssignment) => school.subjectGradeById.get(row.subjectGradeId);
  const subjectOf = (row: TeacherSubjectAssignment) => {
    const item = itemOf(row);
    return item ? school.subjectName(item.subjectId) : "-";
  };
  const gradeOf = (row: TeacherSubjectAssignment) => school.gradeName(itemOf(row)?.gradeId) ?? "-";

  const rows = school.assignments.filter(
    (row) => !gradeId || String(itemOf(row)?.gradeId) === gradeId,
  );

  const columns: TableColumn<TeacherSubjectAssignment>[] = [
    {
      key: "teacher",
      header: "Profesor",
      sortValue: (row) => school.userName(row.teacherId),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{school.userName(row.teacherId) ?? "-"}</span>
          <span className="text-xs text-muted-foreground">
            {school.userById.get(row.teacherId)?.username}
          </span>
        </div>
      ),
    },
    { key: "subject", header: "Materia", sortValue: subjectOf, cell: subjectOf },
    {
      key: "grade",
      header: "Grado",
      sortValue: gradeOf,
      cell: (row) => <Badge variant="outline">{gradeOf(row)}</Badge>,
    },
    {
      key: "date",
      header: "Fecha Asignación",
      sortValue: (row) => row.assignmentDate,
      cell: (row) => formatDate(row.assignmentDate),
    },
    {
      key: "status",
      header: "Estado",
      sortValue: (row) => row.status,
      cell: (row) => (
        <ToneBadge tone={ASSIGNMENT_TONE[row.status]}>{ASSIGNMENT_LABEL[row.status]}</ToneBadge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-24",
      cell: (row) => (
        <RowActions
          editScreenId="SCH-04"
          id={row.id}
          entity="asignación"
          name={`${subjectOf(row)} ${gradeOf(row)}`}
          onDelete={() => {
            deleteAssignment(row.id);
            mockAction(
              "Asignación eliminada",
              `${subjectOf(row)} · ${gradeOf(row)} queda sin profesor.`,
            );
          }}
        />
      ),
    },
  ];

  return (
    <>
      <StatGrid columns={3}>
        <StatTile label="Total Asignaciones" value={school.assignments.length} icon={Users} />
        <StatTile
          label="Asignaciones Activas"
          value={school.assignments.filter((row) => row.status === "activo").length}
          icon={UserCheck}
          tone="success"
        />
        <StatTile
          label="Año Académico"
          value={institution.academicYear}
          icon={CalendarDays}
          tone="info"
        />
      </StatGrid>
      <EntityList
        title="Listado de Asignaciones"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        searchText={(row) => [
          school.userName(row.teacherId),
          school.userById.get(row.teacherId)?.username,
          subjectOf(row),
          gradeOf(row),
        ]}
        searchPlaceholder="Buscar profesor, materia o grado"
        emptyIcon={<Users />}
        emptyTitle="No hay asignaciones registradas"
        emptyDescription="Asigne profesores a las materias por grado."
        create={{ screenId: "SCH-04", label: "Crear Asignación" }}
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

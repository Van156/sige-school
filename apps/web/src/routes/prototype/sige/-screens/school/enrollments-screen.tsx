import { Badge } from "@base-template/ui/components/badge";
import { CalendarDays, ClipboardList, GraduationCap, UserCheck } from "lucide-react";
import { useState } from "react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { ScreenLinkButton } from "../../-components/link-button";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import type { TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { ToneBadge } from "../../-components/tone-badge";
import { formatDate, formatScore } from "../../-lib/format";
import {
  ENROLLMENT_LABEL,
  ENROLLMENT_OPTIONS,
  ENROLLMENT_TONE,
  gradeOptions,
  subjectOptions,
} from "../../-lib/school-options";
import { useSchool } from "../../-lib/use-school";
import { enrollmentStore, mockAction } from "../../-mock";
import type { Institution, StudentEnrollment } from "../../-mock/types";

/** SCH-01: subject enrollments of the students for the institution's academic year. */
export function EnrollmentsScreen() {
  return (
    <ScopedPage
      screenId="SCH-01"
      title="Matrículas de Estudiantes"
      description="Gestión de matrículas de estudiantes por materia"
      target="Matrículas"
      actions={
        <>
          <ScreenLinkButton screenId="STU-01">
            <GraduationCap data-icon="inline-start" />
            Ver Estudiantes
          </ScreenLinkButton>
          <CreateButton screenId="SCH-02" label="Nueva Matrícula" canCreate />
        </>
      }
    >
      {(institution) => <EnrollmentsView institution={institution} />}
    </ScopedPage>
  );
}

function EnrollmentsView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState("");

  const rows = school.enrollments.filter((row) => {
    const item = school.subjectGradeById.get(row.subjectGradeId);
    return (
      (!gradeId || String(item?.gradeId) === gradeId) &&
      (!subjectId || String(item?.subjectId) === subjectId) &&
      (!status || row.status === status)
    );
  });

  const studentOf = (row: StudentEnrollment) => school.studentById.get(row.studentId);
  const documentOf = (row: StudentEnrollment) => {
    const student = studentOf(row);
    const user = student ? school.userOfStudent(student) : undefined;
    return user ? `${user.documentType} ${user.documentNumber}` : "";
  };
  const subjectOf = (row: StudentEnrollment) => {
    const item = school.subjectGradeById.get(row.subjectGradeId);
    return item ? school.subjectName(item.subjectId) : "-";
  };
  const gradeOf = (row: StudentEnrollment) =>
    school.gradeName(school.subjectGradeById.get(row.subjectGradeId)?.gradeId) ?? "-";

  const columns: TableColumn<StudentEnrollment>[] = [
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => school.studentName(row.studentId),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{school.studentName(row.studentId)}</span>
          <span className="text-xs text-muted-foreground">{documentOf(row)}</span>
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
      header: "Fecha Matrícula",
      sortValue: (row) => row.enrollmentDate,
      cell: (row) => formatDate(row.enrollmentDate),
    },
    {
      key: "status",
      header: "Estado",
      sortValue: (row) => row.status,
      cell: (row) => (
        <ToneBadge tone={ENROLLMENT_TONE[row.status]}>{ENROLLMENT_LABEL[row.status]}</ToneBadge>
      ),
    },
    {
      key: "score",
      header: "Nota Final",
      align: "right",
      sortValue: (row) => row.finalScore,
      cell: (row) =>
        row.finalScore === undefined ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <Badge variant="secondary" className="tabular-nums">
            {formatScore(row.finalScore, 1)}
          </Badge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-24",
      cell: (row) => (
        <RowActions
          editScreenId="SCH-02"
          id={row.id}
          entity="matrícula"
          name={`de ${school.studentName(row.studentId)}`}
          onDelete={() => {
            enrollmentStore.remove(row.id);
            mockAction("Matrícula eliminada", `${subjectOf(row)} · ${gradeOf(row)}`);
          }}
        />
      ),
    },
  ];

  return (
    <>
      <StatGrid columns={3}>
        <StatTile label="Total Matrículas" value={school.enrollments.length} icon={ClipboardList} />
        <StatTile
          label="Matrículas Activas"
          value={school.enrollments.filter((row) => row.status === "activa").length}
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
        title="Listado de Matrículas"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        searchText={(row) => [
          school.studentName(row.studentId),
          documentOf(row),
          subjectOf(row),
          gradeOf(row),
        ]}
        searchPlaceholder="Buscar estudiante, documento o materia"
        emptyIcon={<ClipboardList />}
        emptyTitle="No hay matrículas registradas"
        emptyDescription="Matricule estudiantes en un grado. Serán inscritos automáticamente en todas las materias del grado."
        create={{ screenId: "SCH-02", label: "Crear Matrícula" }}
        filters={
          <>
            <FilterSelect
              label="Filtrar por grado"
              value={gradeId}
              onValueChange={setGradeId}
              options={gradeOptions(school.grades)}
              allLabel="Todos los grados"
            />
            <FilterSelect
              label="Filtrar por materia"
              value={subjectId}
              onValueChange={setSubjectId}
              options={subjectOptions(school.subjects)}
              allLabel="Todas las materias"
            />
            <FilterSelect
              label="Filtrar por estado"
              value={status}
              onValueChange={setStatus}
              options={ENROLLMENT_OPTIONS}
              allLabel="Todos los estados"
            />
          </>
        }
      />
    </>
  );
}

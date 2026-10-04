import { Badge } from "@base-template/ui/components/badge";
import { FileSpreadsheet, NotebookPen } from "lucide-react";
import { useState } from "react";

import { EmptyBlock } from "../../-components/empty-block";
import { EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { LockBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import type { TableColumn } from "../../-components/simple-table";
import { gradeOptions } from "../../-lib/school-options";
import { useAccessibleSubjectGrades, useGrading } from "../../-lib/use-grading";
import { useSchool } from "../../-lib/use-school";
import { useIntParam } from "../../-lib/use-search-params";
import type { SubjectGradeRecord } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** GRD-01: pick a period, then the course and subject to grade. */
export function GradeSelectScreen() {
  return (
    <ScopedPage
      screenId="GRD-01"
      title="Ingreso de Notas"
      description="Selecciona el periodo, el grado y la asignatura"
      target="Notas"
      banner={false}
      actions={
        <ScreenLinkButton screenId="GRD-03">
          <FileSpreadsheet data-icon="inline-start" />
          Cargar desde Excel
        </ScreenLinkButton>
      }
    >
      {(institution) => <SelectView institution={institution} />}
    </ScopedPage>
  );
}

function SelectView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const access = useAccessibleSubjectGrades(school);
  const periodParam = useIntParam("period");
  const [gradeId, setGradeId] = useState("");

  const period = grading.periods.find((item) => item.id === periodParam) ?? grading.activePeriod;
  if (!period) {
    return (
      <EmptyBlock
        title="No hay periodos académicos configurados"
        description="Configure los periodos primero."
        action={<ScreenLinkButton screenId="INS-15">Configurar periodos</ScreenLinkButton>}
      />
    );
  }

  const studentCount = (gradeIdOfClass: number) =>
    school.students.filter(
      (student) => student.gradeId === gradeIdOfClass && student.status === "activo",
    ).length;
  const gradeOf = (item: SubjectGradeRecord) => school.gradeName(item.gradeId) ?? "";
  const rows = access.list.filter((item) => !gradeId || String(item.gradeId) === gradeId);
  const courseIds = new Set(access.list.map((item) => item.gradeId));

  const columns: TableColumn<SubjectGradeRecord>[] = [
    {
      key: "grade",
      header: "Grado",
      sortValue: gradeOf,
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{gradeOf(item)}</span>
          <Badge variant="secondary">{studentCount(item.gradeId)} estudiantes</Badge>
        </div>
      ),
    },
    {
      key: "subject",
      header: "Asignatura",
      sortValue: (item) => school.subjectName(item.subjectId),
      cell: (item) => school.subjectName(item.subjectId),
    },
    {
      key: "teacher",
      header: "Docente",
      sortValue: (item) => school.userName(item.teacherId) ?? "",
      cell: (item) =>
        school.userName(item.teacherId) ?? (
          <span className="text-muted-foreground">Sin docente</span>
        ),
    },
    {
      key: "state",
      header: period.shortName,
      cell: (item) => <LockBadge state={grading.lockState(item.id, period.id)} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      cell: (item) => {
        const search = { sg: String(item.id), period: String(period.id) };
        return (
          <div className="flex justify-end gap-1.5">
            <ScreenLinkButton screenId="GRD-02" search={search} size="sm" variant="default">
              <NotebookPen data-icon="inline-start" />
              Ingresar Notas
            </ScreenLinkButton>
            <ScreenLinkButton screenId="GRD-07" search={search} size="sm">
              Ver Resumen
            </ScreenLinkButton>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <SectionCard title="Seleccionar Periodo Académico">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Periodo académico">
          {grading.periods.map((item) => (
            <ScreenLinkButton
              key={item.id}
              screenId="GRD-01"
              search={{ period: String(item.id) }}
              variant={item.id === period.id ? "default" : "outline"}
            >
              {item.name}
              {item.isActive ? <Badge variant="secondary">Activo</Badge> : null}
            </ScreenLinkButton>
          ))}
        </div>
      </SectionCard>

      {grading.criteria.length > 0 ? (
        <SectionCard title="Criterios de Evaluación">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {grading.criteria.map((criterion) => (
              <div key={criterion.id} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{criterion.name}</span>
                  <Badge variant="info">{criterion.weight}%</Badge>
                </div>
                <span className="text-[13px] text-muted-foreground">{criterion.description}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <EntityList
        title="Seleccionar Grado y Asignatura"
        columns={columns}
        rows={rows}
        getRowId={(item) => item.id}
        searchText={(item) => [
          gradeOf(item),
          school.subjectName(item.subjectId),
          school.userName(item.teacherId),
        ]}
        searchPlaceholder="Buscar grado, asignatura o docente"
        emptyIcon={<NotebookPen />}
        emptyTitle="No hay grados disponibles"
        emptyDescription="No hay grados con asignaturas para el año académico actual."
        filters={
          <FilterSelect
            label="Filtrar por grado"
            value={gradeId}
            onValueChange={setGradeId}
            options={gradeOptions(school.grades.filter((grade) => courseIds.has(grade.id)))}
            allLabel="Todos los grados"
          />
        }
      />
    </>
  );
}

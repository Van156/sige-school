import { Lock, LockOpen } from "lucide-react";
import { useState } from "react";

import { Callout } from "../../-components/callout";
import { ConfirmActionButton } from "../../-components/confirm-action";
import { EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { SelectField } from "../../-components/form-fields";
import { ScopedPage } from "../../-components/scoped-page";
import { LockBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import type { TableColumn } from "../../-components/simple-table";
import { gradeOptions } from "../../-lib/school-options";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { mockAction, mockError, setPeriodLock, type SubjectGradeRecord } from "../../-mock";
import type { AcademicPeriod, Institution } from "../../-mock/types";

interface LockRow {
  key: string;
  item: SubjectGradeRecord;
  period: AcademicPeriod;
}

/** GRD-04: lock or unlock the grades of a subject-grade and period (admin, coordinator, root). */
export function PeriodLockScreen() {
  return (
    <ScopedPage
      screenId="GRD-04"
      title="Panel de Bloqueo de Periodos"
      description="Controla qué periodos admiten cambios en las notas"
      target="Notas"
      banner={false}
    >
      {(institution) => <LockView institution={institution} />}
    </ScopedPage>
  );
}

function LockView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const [subjectGradeId, setSubjectGradeId] = useState("");
  const [periodId, setPeriodId] = useState(String(grading.activePeriod?.id ?? ""));
  const [gradeFilter, setGradeFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const rows: LockRow[] = school.subjectGrades.flatMap((item) =>
    grading.periods.map((period) => ({ key: `${item.id}-${period.id}`, item, period })),
  );
  const visible = rows.filter(
    ({ item, period }) =>
      (!gradeFilter || String(item.gradeId) === gradeFilter) &&
      (!periodFilter || String(period.id) === periodFilter) &&
      (!stateFilter || grading.lockState(item.id, period.id) === stateFilter),
  );

  const labelOf = (item: SubjectGradeRecord) =>
    `${school.subjectName(item.subjectId)} - ${school.gradeName(item.gradeId) ?? "-"}`;

  const apply = (subjectGrade: number, period: number, locked: boolean) => {
    if (grading.lockState(subjectGrade, period) === "empty") {
      mockError("No hay notas registradas", "No existen notas para esa asignatura y periodo.");
      return;
    }
    setPeriodLock(subjectGrade, period, locked);
    mockAction(locked ? "Notas bloqueadas exitosamente." : "Notas desbloqueadas exitosamente.");
  };

  const columns: TableColumn<LockRow>[] = [
    {
      key: "grade",
      header: "Grado",
      sortValue: ({ item }) => school.gradeName(item.gradeId) ?? "",
      cell: ({ item }) => school.gradeName(item.gradeId),
    },
    {
      key: "subject",
      header: "Asignatura",
      sortValue: ({ item }) => school.subjectName(item.subjectId),
      cell: ({ item }) => school.subjectName(item.subjectId),
    },
    {
      key: "period",
      header: "Periodo",
      sortValue: ({ period }) => period.order,
      cell: ({ period }) => period.name,
    },
    {
      key: "records",
      header: "Registros",
      align: "right",
      sortValue: ({ item, period }) => grading.recordCount(item.id, period.id),
      cell: ({ item, period }) => (
        <span className="tabular-nums">{grading.recordCount(item.id, period.id)}</span>
      ),
    },
    {
      key: "state",
      header: "Estado",
      sortValue: ({ item, period }) => grading.lockState(item.id, period.id),
      cell: ({ item, period }) => <LockBadge state={grading.lockState(item.id, period.id)} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      align: "right",
      cell: ({ item, period }) => (
        <RowLockAction row={{ item, period }} grading={grading} onApply={apply} school={school} />
      ),
    },
  ];

  return (
    <>
      <Callout tone="info" title="Bloqueo de periodos">
        Cuando un periodo está <strong>bloqueado</strong>, no se pueden editar ni agregar notas.
        Solo los administradores y coordinadores pueden bloquear o desbloquear periodos.
      </Callout>

      <SectionCard title="Bloquear/Desbloquear Periodo">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Asignatura - Grado"
            id="lock-class"
            value={subjectGradeId}
            onValueChange={setSubjectGradeId}
            placeholder="-- Seleccionar --"
            options={school.subjectGrades
              .map((item) => ({ value: String(item.id), label: labelOf(item) }))
              .toSorted((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }))}
          />
          <SelectField
            label="Periodo"
            id="lock-period"
            value={periodId}
            onValueChange={setPeriodId}
            options={grading.periods.map((period) => ({
              value: String(period.id),
              label: period.name,
            }))}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ConfirmActionButton
            variant="default"
            disabled={!subjectGradeId}
            title="¿Bloquear notas?"
            description="Esta acción impedirá editar o agregar notas en el periodo."
            confirmLabel="Bloquear"
            onConfirm={() => apply(Number(subjectGradeId), Number(periodId), true)}
          >
            <Lock data-icon="inline-start" />
            Bloquear
          </ConfirmActionButton>
          <ConfirmActionButton
            disabled={!subjectGradeId}
            title="¿Desbloquear notas?"
            description="Las notas volverán a ser editables."
            confirmLabel="Desbloquear"
            onConfirm={() => apply(Number(subjectGradeId), Number(periodId), false)}
          >
            <LockOpen data-icon="inline-start" />
            Desbloquear
          </ConfirmActionButton>
        </div>
      </SectionCard>

      <EntityList
        title="Estado de Periodos"
        columns={columns}
        rows={visible}
        getRowId={(row) => row.key}
        searchText={({ item, period }) => [
          school.gradeName(item.gradeId),
          school.subjectName(item.subjectId),
          period.name,
        ]}
        searchPlaceholder="Buscar grado, asignatura o periodo"
        emptyIcon={<Lock />}
        emptyTitle="No hay combinaciones disponibles"
        emptyDescription="No hay combinaciones de asignatura-grado y periodo disponibles."
        pageSize={12}
        filters={
          <>
            <FilterSelect
              label="Filtrar por grado"
              value={gradeFilter}
              onValueChange={setGradeFilter}
              options={gradeOptions(school.grades)}
              allLabel="Todos los grados"
            />
            <FilterSelect
              label="Filtrar por periodo"
              value={periodFilter}
              onValueChange={setPeriodFilter}
              options={grading.periods.map((period) => ({
                value: String(period.id),
                label: period.shortName,
              }))}
              allLabel="Todos los periodos"
            />
            <FilterSelect
              label="Filtrar por estado"
              value={stateFilter}
              onValueChange={setStateFilter}
              options={[
                { value: "locked", label: "Cerrado" },
                { value: "open", label: "Abierto" },
                { value: "empty", label: "Sin datos" },
              ]}
              allLabel="Todos los estados"
            />
          </>
        }
      />
    </>
  );
}

function RowLockAction({
  row,
  grading,
  school,
  onApply,
}: {
  row: { item: SubjectGradeRecord; period: AcademicPeriod };
  grading: Grading;
  school: School;
  onApply: (subjectGradeId: number, periodId: number, locked: boolean) => void;
}) {
  const state = grading.lockState(row.item.id, row.period.id);
  if (state === "empty") return null;
  const name = `${school.subjectName(row.item.subjectId)} ${school.gradeName(row.item.gradeId) ?? ""} ${row.period.shortName}`;
  return state === "locked" ? (
    <ConfirmActionButton
      size="sm"
      title={`¿Desbloquear ${name}?`}
      description="Las notas volverán a ser editables."
      confirmLabel="Desbloquear"
      onConfirm={() => onApply(row.item.id, row.period.id, false)}
    >
      <LockOpen data-icon="inline-start" />
      Desbloquear
    </ConfirmActionButton>
  ) : (
    <ConfirmActionButton
      size="sm"
      title={`¿Bloquear ${name}?`}
      description="Esta acción impedirá editar o agregar notas en el periodo."
      confirmLabel="Bloquear"
      onConfirm={() => onApply(row.item.id, row.period.id, true)}
    >
      <Lock data-icon="inline-start" />
      Bloquear
    </ConfirmActionButton>
  );
}

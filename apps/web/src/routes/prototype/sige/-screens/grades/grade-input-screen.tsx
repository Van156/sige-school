import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { FileSpreadsheet, Lock, LockOpen, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Callout } from "../../-components/callout";
import { ClassContext, type ClassInfo } from "../../-components/class-context";
import { ConfirmActionButton } from "../../-components/confirm-action";
import { EmptyBlock } from "../../-components/empty-block";
import {
  GradeGrid,
  cellKey,
  draftFromRecords,
  isDraftDirty,
  parseScore,
  type Draft,
} from "../../-components/grade-grid";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { useIntParam } from "../../-lib/use-search-params";
import { mockAction, mockError, saveGradeCells, setPeriodLock } from "../../-mock";
import type { AcademicPeriod, Institution } from "../../-mock/types";

/** GRD-02: grade sheet (students x criteria) of one subject-grade and period (`?sg=&period=`). */
export function GradeInputScreen() {
  const period = useIntParam("period");
  return (
    <ScopedPage
      screenId="GRD-02"
      title="Ingreso de Notas"
      description="Planilla de calificaciones por criterio"
      target="Notas"
      banner={false}
      actions={
        <BackButton
          screenId="GRD-01"
          search={{ period: period === undefined ? undefined : String(period) }}
        />
      }
    >
      {(institution) => <InputView institution={institution} />}
    </ScopedPage>
  );
}

function InputView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);

  return (
    <ClassContext
      school={school}
      grading={grading}
      selectScreenId="GRD-01"
      permissionMessage="No tienes permiso para editar esta asignatura."
    >
      {(info) =>
        info.period ? (
          <Sheet
            key={`${info.subjectGrade.id}-${info.period.id}`}
            info={info}
            period={info.period}
            school={school}
            grading={grading}
          />
        ) : null
      }
    </ClassContext>
  );
}

function Sheet({
  info,
  period,
  school,
  grading,
}: {
  info: ClassInfo;
  period: AcademicPeriod;
  school: School;
  grading: Grading;
}) {
  const { subjectGrade, students, userId } = info;
  const saved = draftFromRecords(
    grading.records.filter(
      (record) => record.subjectGradeId === subjectGrade.id && record.periodId === period.id,
    ),
  );
  const [draft, setDraft] = useState<Draft>(saved);
  const locked = grading.isLocked(subjectGrade.id, period.id);
  const dirty = isDraftDirty(draft, saved);
  const hasGrades = Object.values(draft).some((cell) => parseScore(cell.score).value !== null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const gridStudents = students.map((student) => {
    const user = school.userOfStudent(student);
    return {
      id: student.id,
      name: school.userName(student.userId) ?? "Estudiante",
      document: user ? `${user.documentType} ${user.documentNumber}` : "",
    };
  });

  const change = (
    studentId: number,
    criterionId: number,
    patch: { score?: string; observation?: string },
  ) =>
    setDraft((previous) => {
      const key = cellKey(studentId, criterionId);
      const current = previous[key] ?? { score: "", observation: "" };
      return { ...previous, [key]: { ...current, ...patch } };
    });

  /** Writes every cell to the store; refuses when a typed score is out of range. */
  const save = (): boolean => {
    const cells = gridStudents.flatMap((student) =>
      grading.criteria.map((criterion) => {
        const cell = draft[cellKey(student.id, criterion.id)] ?? { score: "", observation: "" };
        return { student, criterion, cell, parsed: parseScore(cell.score) };
      }),
    );
    if (cells.some(({ parsed }) => !parsed.valid)) {
      mockError("Hay notas fuera de rango", "Las notas deben estar entre 1.0 y 5.0.");
      return false;
    }
    saveGradeCells({
      subjectGradeId: subjectGrade.id,
      periodId: period.id,
      userId,
      cells: cells.map(({ student, criterion, cell, parsed }) => ({
        studentId: student.id,
        criterionId: criterion.id,
        score: parsed.value,
        observation: cell.observation.trim() || undefined,
      })),
    });
    return true;
  };

  const search = { sg: String(subjectGrade.id), period: String(period.id) };

  if (grading.criteria.length === 0) {
    return (
      <EmptyBlock
        title="No hay criterios de evaluación configurados"
        description="Configure los criterios primero."
        action={<ScreenLinkButton screenId="INS-17">Configurar criterios</ScreenLinkButton>}
      />
    );
  }

  return (
    <>
      <StatGrid>
        <StatTile
          label="Asignatura"
          value={<span className="text-base">{info.subjectName}</span>}
        />
        <StatTile label="Grado" value={info.grade.name} />
        <StatTile label="Periodo" value={period.shortName} hint={period.name} />
        <StatTile label="Estudiantes" value={students.length} />
      </StatGrid>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        {locked ? (
          <Badge variant="destructive">
            <Lock data-icon="inline-start" />
            Notas Bloqueadas
          </Badge>
        ) : (
          <Badge variant="success">
            <LockOpen data-icon="inline-start" />
            Notas Desbloqueadas
          </Badge>
        )}
        {dirty ? <Badge variant="warning">Cambios sin guardar</Badge> : null}
        <span className="text-muted-foreground">
          <strong className="font-medium text-foreground">Pesos:</strong>{" "}
          {grading.criteria
            .map((criterion) => `${criterion.name}: ${criterion.weight}%`)
            .join(" · ")}
          {" | Escala: 1.0 - 5.0 | Mínimo aprobación: 3.0"}
        </span>
      </div>

      {locked ? (
        <Callout tone="warning" title="Periodo bloqueado">
          Las notas son de solo lectura. Desbloquéalas para editar la planilla.
        </Callout>
      ) : null}

      <SectionCard
        title="Planilla de Calificaciones"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {locked ? (
              <ConfirmActionButton
                title="¿Desbloquear notas para edición?"
                description="La planilla volverá a ser editable."
                confirmLabel="Desbloquear"
                onConfirm={() => {
                  setPeriodLock(subjectGrade.id, period.id, false);
                  mockAction("Notas desbloqueadas exitosamente.");
                }}
              >
                <LockOpen data-icon="inline-start" />
                Desbloquear
              </ConfirmActionButton>
            ) : (
              <>
                <Button
                  onClick={() => {
                    if (save()) mockAction("Notas guardadas exitosamente.");
                  }}
                >
                  <Save data-icon="inline-start" />
                  Guardar Todas
                </Button>
                <ConfirmActionButton
                  disabled={!hasGrades}
                  title="¿Bloquear notas?"
                  description="Esta acción impedirá futuras ediciones hasta que se desbloquee."
                  confirmLabel="Guardar y bloquear"
                  onConfirm={() => {
                    if (!save()) return;
                    setPeriodLock(subjectGrade.id, period.id, true);
                    mockAction("Notas bloqueadas exitosamente.");
                  }}
                >
                  <Lock data-icon="inline-start" />
                  Guardar y Bloquear
                </ConfirmActionButton>
                <ScreenLinkButton screenId="GRD-03" search={search}>
                  <FileSpreadsheet data-icon="inline-start" />
                  Carga Masiva
                </ScreenLinkButton>
              </>
            )}
            <ScreenLinkButton screenId="GRD-05" search={search}>
              Notas finales
            </ScreenLinkButton>
            <ScreenLinkButton screenId="GRD-07" search={search}>
              Resumen
            </ScreenLinkButton>
          </div>
        }
      >
        {students.length === 0 ? (
          <EmptyBlock title="No hay estudiantes activos en este grado." />
        ) : (
          <GradeGrid
            students={gridStudents}
            criteria={grading.criteria}
            draft={draft}
            locked={locked}
            onChange={change}
          />
        )}
      </SectionCard>
    </>
  );
}

import { Button } from "@base-template/ui/components/button";
import { Spinner } from "@base-template/ui/components/spinner";
import { CircleAlert, CircleCheck, Wand2 } from "lucide-react";
import { useState } from "react";

import { Callout } from "../../-components/callout";
import { SelectField } from "../../-components/form-fields";
import { BackButton, HelpList } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { campusOptions, gradeOptions } from "../../-lib/school-options";
import { useSchool } from "../../-lib/use-school";
import { generateSchedule, type ScheduleRun } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** SCH-12: automatic timetable generation with a progress phase and a result summary. */
export function ScheduleGenerateScreen() {
  return (
    <ScopedPage
      screenId="SCH-12"
      title="Generar Horario Automático"
      description="El sistema generará automáticamente los horarios evitando conflictos"
      target="Horarios"
      back={<BackButton screenId="SCH-11" />}
    >
      {(institution) => <GenerateView institution={institution} />}
    </ScopedPage>
  );
}

type Phase =
  | { name: "idle" }
  | { name: "running" }
  | { name: "done"; run: ScheduleRun; gradeId?: number };

function GenerateView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const [campusId, setCampusId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  const scopedGrades = school.grades.filter(
    (grade) => !campusId || String(grade.campusId) === campusId,
  );

  const run = () => {
    const targets = scopedGrades.filter((grade) => !gradeId || String(grade.id) === gradeId);
    setPhase({ name: "running" });
    // The prototype fakes the optimisation time so the progress state is visible.
    setTimeout(() => {
      const result = generateSchedule(
        targets.map((grade) => grade.id),
        institution.academicYear,
      );
      setPhase({ name: "done", run: result, gradeId: targets[0]?.id });
    }, 1200);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <SectionCard title="Parámetros">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="campusId"
              label="Sede"
              placeholder="Todas las sedes"
              options={campusOptions(school.campuses)}
              value={campusId}
              onValueChange={(value) => {
                setCampusId(value);
                setGradeId("");
              }}
            />
            <SelectField
              id="gradeId"
              label="Grado (opcional)"
              placeholder="Todos los grados"
              options={gradeOptions(scopedGrades)}
              value={gradeId}
              onValueChange={setGradeId}
            />
          </div>
          <div>
            <Button disabled={phase.name === "running"} onClick={run}>
              <Wand2 data-icon="inline-start" />
              Generar Horario
            </Button>
          </div>
        </SectionCard>

        {phase.name === "running" ? (
          <SectionCard title="Generando...">
            <div className="flex items-center gap-3 text-[13px]" role="status">
              <Spinner />
              <div className="flex flex-col">
                <span className="font-medium">Generando horario...</span>
                <span className="text-muted-foreground">
                  El sistema está optimizando la asignación de horarios
                </span>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {phase.name === "done" ? <Result phase={phase} /> : null}
      </div>

      <SectionCard title="Cómo funciona">
        <div className="flex flex-col gap-2 text-[13px] text-muted-foreground">
          <HelpList
            items={[
              "Asigna cada materia a un salón y horario disponible.",
              "Evita conflictos de profesores y salones.",
              "Respeta los bloques de tiempo de cada sede.",
              "Permite ajustar manualmente después.",
            ]}
          />
          <p>Al generar, se reemplaza el horario existente de los grados seleccionados.</p>
        </div>
      </SectionCard>
    </div>
  );
}

function Result({ phase }: { phase: Extract<Phase, { name: "done" }> }) {
  const { assigned, conflicts } = phase.run;
  return (
    <SectionCard title="Resultado">
      {assigned === 0 ? (
        <Callout tone="destructive" icon={CircleAlert} title="Error al generar horario">
          No se pudieron generar horarios. Verifique que existan materias asignadas y salones
          disponibles.
        </Callout>
      ) : (
        <>
          <Callout tone="info" icon={CircleCheck} title="Horario generado exitosamente">
            <strong className="font-medium text-foreground">{assigned}</strong> clases asignadas ·{" "}
            {conflicts > 0 ? (
              <>
                <strong className="font-medium text-foreground">{conflicts}</strong> conflictos
                encontrados
              </>
            ) : (
              "Sin conflictos"
            )}
          </Callout>
          <div>
            <ScreenLinkButton
              screenId="SCH-11"
              variant="default"
              search={phase.gradeId ? { grade: String(phase.gradeId) } : undefined}
            >
              Ver Horario
            </ScreenLinkButton>
          </div>
        </>
      )}
    </SectionCard>
  );
}

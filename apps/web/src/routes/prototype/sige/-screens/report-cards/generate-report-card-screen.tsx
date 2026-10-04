import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Eye, FilePlus2, RefreshCw } from "lucide-react";

import { ConfirmActionButton } from "../../-components/confirm-action";
import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { NoStudentBlock, StudentStrip, StudentSwitcher } from "../../-components/student-strip";
import { ToneBadge } from "../../-components/tone-badge";
import { formatDate, formatDateTime } from "../../-lib/format";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useRole } from "../../-lib/use-role";
import { useSchool, type School } from "../../-lib/use-school";
import { useStudentScope } from "../../-lib/use-student-scope";
import { currentUserFor, generateReportCard, mockAction, mockError } from "../../-mock";
import type { AcademicStudent, Institution } from "../../-mock/types";

/** RPT-02: generate (or regenerate) the report card of one student for a period (`?student=`). */
export function GenerateReportCardScreen() {
  const role = useRole();
  const manager = role === "root" || role === "admin" || role === "coordinator";
  return (
    <ScopedPage
      screenId="RPT-02"
      title="Generar Boletín de Calificaciones"
      description="Elige el periodo y genera el boletín del estudiante"
      target="Boletines"
      banner={false}
      actions={manager ? <BackButton screenId="RPT-01" label="Volver a Gestión" /> : undefined}
    >
      {(institution) => <GenerateView institution={institution} />}
    </ScopedPage>
  );
}

function GenerateView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const scope = useStudentScope(school);

  return (
    <>
      <StudentSwitcher screenId="RPT-02" scope={scope} school={school} />
      {scope.selected ? (
        <PeriodTiles student={scope.selected} school={school} grading={grading} />
      ) : (
        <NoStudentBlock scope={scope} />
      )}
    </>
  );
}

function PeriodTiles({
  student,
  school,
  grading,
}: {
  student: AcademicStudent;
  school: School;
  grading: Grading;
}) {
  const role = useRole();
  const userId = currentUserFor(role).id;

  const generate = (periodId: number) => {
    const result = generateReportCard({ studentId: student.id, periodId, generatedBy: userId });
    if (result.ok) {
      mockAction(result.regenerated ? "Boletín regenerado" : "Boletín generado exitosamente.");
    } else {
      mockError("No se pudo generar el boletín", result.reason);
    }
  };

  return (
    <>
      <StudentStrip
        student={student}
        school={school}
        actions={
          <ScreenLinkButton screenId="RPT-03" search={{ student: String(student.id) }}>
            Ver Historial
          </ScreenLinkButton>
        }
      />
      <SectionCard title="Seleccionar Periodo">
        {grading.periods.length === 0 ? (
          <EmptyBlock
            title="No hay periodos académicos configurados"
            description="Contacte al administrador para configurar los periodos académicos."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {grading.periods.map((period) => {
              const card = grading.cards.find(
                (entry) => entry.studentId === student.id && entry.periodId === period.id,
              );
              return (
                <div key={period.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{period.name}</span>
                      <span className="text-xs text-muted-foreground">{period.academicYear}</span>
                    </div>
                    {period.isActive ? <Badge variant="info">Activo</Badge> : null}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(period.startDate)} - {formatDate(period.endDate)}
                  </span>
                  {card ? (
                    <div className="flex flex-col gap-2 text-[13px]">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Estado:</span>
                        <ToneBadge
                          tone={card.deliveryStatus === "entregado" ? "success" : "warning"}
                        >
                          {card.deliveryStatus === "entregado" ? "Entregado" : "Pendiente"}
                        </ToneBadge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Generado: {formatDateTime(card.generatedAt)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <ScreenLinkButton
                          screenId="RPT-04"
                          search={{ id: String(card.id) }}
                          size="sm"
                        >
                          <Eye data-icon="inline-start" />
                          Ver
                        </ScreenLinkButton>
                        <ConfirmActionButton
                          size="sm"
                          title="¿Regenerar este boletín?"
                          description="Se recalcula con las notas actuales y se actualiza la fecha de generación."
                          confirmLabel="Regenerar"
                          onConfirm={() => generate(period.id)}
                        >
                          <RefreshCw data-icon="inline-start" />
                          Regenerar
                        </ConfirmActionButton>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => generate(period.id)}>
                      <FilePlus2 data-icon="inline-start" />
                      Generar Boletín
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}

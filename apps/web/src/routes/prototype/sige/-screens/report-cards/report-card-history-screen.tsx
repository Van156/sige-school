import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Download, Eye, FilePlus2 } from "lucide-react";

import { DetailList } from "../../-components/detail-list";
import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { IconLink } from "../../-components/icon-link";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { NoStudentBlock, StudentSwitcher } from "../../-components/student-strip";
import { ToneBadge } from "../../-components/tone-badge";
import { formatDate, formatDateTime } from "../../-lib/format";
import { truncate } from "../../-lib/list";
import { STUDENT_STATUS_LABEL } from "../../-lib/school-options";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useRole } from "../../-lib/use-role";
import { useSchool, type School } from "../../-lib/use-school";
import { useStudentScope } from "../../-lib/use-student-scope";
import { mockInfo } from "../../-mock";
import type { AcademicStudent, Institution, ReportCard } from "../../-mock/types";

/** RPT-03: report cards of one student by period (`?student=`; a student sees their own). */
export function ReportCardHistoryScreen() {
  const role = useRole();
  const manager = role === "root" || role === "admin" || role === "coordinator";
  return (
    <ScopedPage
      screenId="RPT-03"
      title="Historial de Boletines"
      description="Boletines generados y su estado de entrega"
      target="Boletines"
      banner={false}
      back={manager ? <BackButton screenId="RPT-01" label="Volver a Gestión" /> : undefined}
    >
      {(institution) => <HistoryView institution={institution} />}
    </ScopedPage>
  );
}

function HistoryView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const scope = useStudentScope(school);

  return (
    <>
      <StudentSwitcher screenId="RPT-03" scope={scope} school={school} />
      {scope.selected ? (
        <History student={scope.selected} school={school} grading={grading} />
      ) : (
        <NoStudentBlock scope={scope} />
      )}
    </>
  );
}

function History({
  student,
  school,
  grading,
}: {
  student: AcademicStudent;
  school: School;
  grading: Grading;
}) {
  const user = school.userOfStudent(student);
  const cards = grading.cards
    .filter((card) => card.studentId === student.id)
    .toSorted((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const periodOf = (card: ReportCard) => grading.periodById.get(card.periodId);
  const generateSearch = { student: String(student.id) };

  const columns: TableColumn<ReportCard>[] = [
    {
      key: "period",
      header: "Periodo",
      sortValue: (card) => periodOf(card)?.order,
      cell: (card) => <strong className="font-medium">{periodOf(card)?.shortName ?? "-"}</strong>,
    },
    {
      key: "year",
      header: "Año Académico",
      cell: (card) => periodOf(card)?.academicYear ?? "-",
    },
    {
      key: "generated",
      header: "Fecha Generación",
      sortValue: (card) => card.generatedAt,
      cell: (card) => <span className="tabular-nums">{formatDateTime(card.generatedAt)}</span>,
    },
    {
      key: "delivery",
      header: "Estado Entrega",
      sortValue: (card) => card.deliveryStatus,
      cell: (card) =>
        card.deliveryStatus === "entregado" ? (
          <div className="flex flex-col items-start gap-0.5">
            <ToneBadge tone="success">Entregado</ToneBadge>
            {card.deliveryDate ? (
              <span className="text-xs text-muted-foreground">{formatDate(card.deliveryDate)}</span>
            ) : null}
          </div>
        ) : (
          <ToneBadge tone="warning">Pendiente</ToneBadge>
        ),
    },
    {
      key: "observation",
      header: "Observación General",
      cell: (card) =>
        card.generalObservation ? (
          truncate(card.generalObservation, 50)
        ) : (
          <span className="text-muted-foreground italic">Sin observaciones</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-24",
      cell: (card) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconLink screenId="RPT-04" search={{ id: String(card.id) }} label="Ver PDF">
            <Eye />
          </IconLink>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Descargar PDF"
            title="Descargar PDF"
            onClick={() =>
              mockInfo(
                "Descargar PDF",
                "Abre la vista del boletín y usa Imprimir > Guardar como PDF.",
              )
            }
          >
            <Download />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <SectionCard
        title="Información del Estudiante"
        action={
          <ScreenLinkButton screenId="RPT-02" search={generateSearch} variant="default" size="sm">
            <FilePlus2 data-icon="inline-start" />
            Generar Nuevo Boletín
          </ScreenLinkButton>
        }
      >
        <DetailList
          items={[
            ["Nombre completo", school.userName(student.userId)],
            ["Documento", user ? `${user.documentType} ${user.documentNumber}` : undefined],
            ["Grado", school.gradeName(student.gradeId)],
            ["Estado", STUDENT_STATUS_LABEL[student.status]],
          ]}
        />
      </SectionCard>

      <SectionCard title="Boletines Generados">
        <SimpleTable
          columns={columns}
          rows={cards}
          getRowId={(card) => card.id}
          pageSize={10}
          empty={
            <EmptyBlock
              icon={<FilePlus2 />}
              title="No hay boletines generados para este estudiante"
              description="Los boletines generados aparecerán aquí."
              action={
                <ScreenLinkButton screenId="RPT-02" search={generateSearch} variant="default">
                  Generar Primer Boletín
                </ScreenLinkButton>
              }
            />
          }
        />
      </SectionCard>

      <SectionCard title="Todos los Periodos Académicos">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {grading.periods.map((period) => {
            const generated = cards.some((card) => card.periodId === period.id);
            return (
              <div
                key={period.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{period.shortName}</span>
                  <span className="text-xs text-muted-foreground">{period.academicYear}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={generated ? "success" : "secondary"}>
                    {generated ? "Generado" : "Sin generar"}
                  </Badge>
                  {period.isActive ? <Badge variant="info">Activo</Badge> : null}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </>
  );
}

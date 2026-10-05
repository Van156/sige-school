import { Badge } from "@base-template/ui/components/badge";
import { Download, FileText, NotebookPen } from "lucide-react";

import { EmptyBlock } from "../../-components/empty-block";
import { ScreenLinkButton } from "../../-components/link-button";
import { ParentChildPage, type ChildContext } from "../../-components/parent-frame";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { formatDate } from "../../-lib/format";
import type { ReportCardObservation } from "../../-mock/types";

/** PAR-05: report cards generated for the child, with delivery state and teacher remarks. */
export function ChildReportCardsScreen() {
  return (
    <ParentChildPage screenId="PAR-05" title="Boletines del hijo/a" section="Boletines">
      {(context) => <ReportCards {...context} />}
    </ParentChildPage>
  );
}

function ReportCards({ student, school, grading }: ChildContext) {
  const cards = grading.cards
    .filter((card) => card.studentId === student.id)
    .toSorted(
      (a, b) =>
        (grading.periodById.get(a.periodId)?.order ?? 0) -
        (grading.periodById.get(b.periodId)?.order ?? 0),
    );

  const remarkColumns: TableColumn<ReportCardObservation>[] = [
    {
      key: "subject",
      header: "Materia",
      cell: (row) => {
        const item = school.subjectGradeById.get(row.subjectGradeId);
        return item ? school.subjectName(item.subjectId) : "-";
      },
    },
    { key: "remark", header: "Observación", cell: (row) => row.observation },
  ];

  if (cards.length === 0) {
    return (
      <EmptyBlock
        icon={<FileText />}
        title="No hay boletines generados"
        description="Los boletines aparecerán cuando sean generados por el sistema."
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {cards.map((card) => {
        const period = grading.periodById.get(card.periodId);
        const remarks = grading.cardObservations.filter((row) => row.reportCardId === card.id);
        return (
          <SectionCard
            key={card.id}
            title={period?.name ?? "Periodo"}
            description={
              period ? `${formatDate(period.startDate)} – ${formatDate(period.endDate)}` : undefined
            }
            action={
              <Badge variant={card.deliveryStatus === "entregado" ? "success" : "warning"}>
                {card.deliveryStatus === "entregado" ? "Entregado" : "Pendiente"}
              </Badge>
            }
          >
            <p className="text-[13px] text-muted-foreground">
              Generado: {formatDate(card.generatedAt)} · Entregado:{" "}
              {card.deliveryDate ? formatDate(card.deliveryDate) : "N/A"}
            </p>
            {card.generalObservation ? (
              <div className="flex flex-col gap-1">
                <h3 className="text-[13px] font-medium">Observación General</h3>
                <p className="text-[13px] text-muted-foreground">{card.generalObservation}</p>
              </div>
            ) : null}
            {remarks.length > 0 ? (
              <div className="flex flex-col gap-1">
                <h3 className="text-[13px] font-medium">Observaciones por Materia</h3>
                <SimpleTable columns={remarkColumns} rows={remarks} getRowId={(row) => row.id} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {card.pdfPath ? (
                <ScreenLinkButton
                  screenId="RPT-04"
                  search={{ id: String(card.id) }}
                  variant="default"
                  size="sm"
                >
                  <Download data-icon="inline-start" />
                  Descargar PDF
                </ScreenLinkButton>
              ) : null}
              <ScreenLinkButton
                screenId="PAR-02"
                search={{ student: String(student.id) }}
                size="sm"
              >
                <NotebookPen data-icon="inline-start" />
                Ver Notas
              </ScreenLinkButton>
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

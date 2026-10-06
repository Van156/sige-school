import { Button } from "@base-template/ui/components/button";
import { Download, Printer } from "lucide-react";

import { NotFoundBlock } from "../../-components/not-found-block";
import { BackButton } from "../../-components/form-layout";
import { PrintStyles } from "../../-components/print-styles";
import { ScopedPage } from "../../-components/scoped-page";
import { useRole } from "../../-lib/use-role";
import { useGrading } from "../../-lib/use-grading";
import { useSchool } from "../../-lib/use-school";
import { useIdParam } from "../../-lib/use-search-params";
import { useStudentScope } from "../../-lib/use-student-scope";
import { dashboardScreenId } from "../../-screens";
import { mockInfo } from "../../-mock";
import type { Institution } from "../../-mock/types";
import { ReportCardDocument } from "./report-card-document";

/** RPT-04: report card print preview (`?id=` of the report card); "PDF" is the print dialog. */
export function ReportCardViewScreen() {
  const role = useRole();
  const staff = role === "root" || role === "admin" || role === "coordinator";
  return (
    <ScopedPage
      screenId="RPT-04"
      title="Boletín de Calificaciones"
      description="Vista de impresión del boletín"
      target="Boletines"
      banner={false}
      actions={
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              mockInfo("Descargar PDF", "Usa Imprimir y elige «Guardar como PDF» en el diálogo.")
            }
          >
            <Download data-icon="inline-start" />
            Descargar PDF
          </Button>
          {staff ? <BackButton screenId="RPT-01" label="Volver a Gestión" /> : null}
        </div>
      }
    >
      {(institution) => <ViewContent institution={institution} />}
    </ScopedPage>
  );
}

function ViewContent({ institution }: { institution: Institution }) {
  const id = useIdParam();
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const scope = useStudentScope(school);
  const role = useRole();
  const backScreenId =
    scope.mode === "staff" && role !== "teacher"
      ? "RPT-01"
      : role === "student"
        ? "RPT-03"
        : dashboardScreenId[role];

  const card = grading.cards.find((entry) => entry.id === id);
  const student = card ? school.studentById.get(card.studentId) : undefined;
  const period = card ? grading.periodById.get(card.periodId) : undefined;
  const allowed = student ? scope.allowed.some((entry) => entry.id === student.id) : false;

  if (!card || !student || !period || !allowed) {
    return <NotFoundBlock entity="Boletín" backScreenId={backScreenId} />;
  }
  return (
    <>
      <PrintStyles />
      <ReportCardDocument
        card={card}
        student={student}
        period={period}
        institution={institution}
        school={school}
        grading={grading}
      />
    </>
  );
}

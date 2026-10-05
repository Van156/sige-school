import { cn } from "@base-template/ui/lib/utils";
import type { ReactNode } from "react";

import { NoStudentBlock, StudentSwitcher } from "./student-strip";
import { ScopedPage } from "./scoped-page";
import { ScreenLinkButton } from "./link-button";
import { useGrading, type Grading } from "../-lib/use-grading";
import { useSchool, type School } from "../-lib/use-school";
import { useStudentScope } from "../-lib/use-student-scope";
import type { AcademicStudent, Institution } from "../-mock/types";

const TABS = [
  { screenId: "PAR-02", label: "Notas" },
  { screenId: "PAR-03", label: "Asistencia" },
  { screenId: "PAR-04", label: "Observaciones" },
  { screenId: "PAR-05", label: "Boletines" },
  { screenId: "PAR-06", label: "Logros" },
] as const;

export interface ChildContext {
  student: AcademicStudent;
  school: School;
  grading: Grading;
}

/**
 * Frame of the child pages of the parent portal: tab strip ("Portal" › Notas · Asistencia ·
 * Observaciones · Boletines · Logros), the child switcher and the section title. Everything below
 * only ever sees one of the guardian's linked children (`useStudentScope`).
 */
export function ParentChildPage({
  screenId,
  title,
  section,
  children,
}: {
  screenId: string;
  title: string;
  /** Section noun for the heading, e.g. "Notas" (-> "Notas de {nombre}"). */
  section: string;
  children: (context: ChildContext) => ReactNode;
}) {
  return (
    <ScopedPage
      screenId={screenId}
      title={title}
      description="Seguimiento académico de tus hijos"
      target="Portal de Acudientes"
      banner={false}
      actions={<ScreenLinkButton screenId="PAR-01">Volver al portal</ScreenLinkButton>}
    >
      {(institution) => (
        <ChildFrame institution={institution} screenId={screenId} section={section}>
          {children}
        </ChildFrame>
      )}
    </ScopedPage>
  );
}

function ChildFrame({
  institution,
  screenId,
  section,
  children,
}: {
  institution: Institution;
  screenId: string;
  section: string;
  children: (context: ChildContext) => ReactNode;
}) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const scope = useStudentScope(school);
  const { selected } = scope;
  const search = selected ? { student: String(selected.id) } : undefined;

  return (
    <>
      <nav aria-label="Secciones del portal" className="flex flex-wrap items-center gap-1.5">
        <ScreenLinkButton screenId="PAR-01" variant="ghost" size="sm">
          Portal
        </ScreenLinkButton>
        <span aria-hidden="true" className="text-muted-foreground">
          ›
        </span>
        {TABS.map((tab) => (
          <ScreenLinkButton
            key={tab.screenId}
            screenId={tab.screenId}
            search={search}
            variant={tab.screenId === screenId ? "default" : "outline"}
            size="sm"
            className={cn(tab.screenId === screenId && "pointer-events-none")}
          >
            {tab.label}
          </ScreenLinkButton>
        ))}
      </nav>
      <StudentSwitcher screenId={screenId} scope={scope} school={school} />
      {selected ? (
        <>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold">
              {section} de {school.studentName(selected.id)}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {school.gradeName(selected.gradeId) ?? "Sin grado"} - Sede:{" "}
              {school.campusName(selected.campusId)}
            </p>
          </div>
          {children({ student: selected, school, grading })}
        </>
      ) : (
        <NoStudentBlock scope={scope} />
      )}
    </>
  );
}

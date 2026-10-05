import { Badge } from "@base-template/ui/components/badge";
import { Card } from "@base-template/ui/components/card";
import { HeartHandshake, NotebookPen } from "lucide-react";

import { EmptyBlock } from "../../-components/empty-block";
import { ScreenLinkButton } from "../../-components/link-button";
import { SigePageHeader } from "../../-components/page-header";
import { useRole } from "../../-lib/use-role";
import { useSchool } from "../../-lib/use-school";
import { useStudentScope } from "../../-lib/use-student-scope";
import { INSTITUTION_ID, currentUserFor, fullName } from "../../-mock";

/**
 * DASH-06: generic parent dashboard (children as cards). The full portal is PAR-01; this view keeps
 * the legacy children list so the parent role has a landing page in the prototype.
 */
export function ParentDashboard() {
  const role = useRole();
  const user = currentUserFor(role);
  const school = useSchool(INSTITUTION_ID);
  const scope = useStudentScope(school);
  const children = scope.allowed.map((student) => {
    const child = school.userOfStudent(student);
    return {
      studentId: student.id,
      name: school.studentName(student.id),
      grade: school.gradeName(student.gradeId) ?? "Sin grado",
      document: child ? `${child.documentType} ${child.documentNumber}` : "",
      relationship:
        school.parentLinks.find(
          (link) => link.parentId === user.id && link.studentId === student.id,
        )?.relationship ?? "Acudiente",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <SigePageHeader
        title="Portal de Acudientes"
        description={`Bienvenido/a, ${fullName(user)}`}
        actions={
          <ScreenLinkButton screenId="PAR-01">
            <HeartHandshake />
            Ir al portal completo
          </ScreenLinkButton>
        }
      />

      {children.length === 0 ? (
        <EmptyBlock
          icon={<HeartHandshake />}
          title="No tienes estudiantes asignados"
          description="Contacta al administrador."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {children.map((child) => (
            <Card key={child.studentId} size="sm" className="gap-3">
              <div className="flex flex-col gap-3 px-(--card-spacing)">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-base font-semibold">{child.name}</span>
                    <span className="text-[13px] text-muted-foreground">{child.relationship}</span>
                  </div>
                  <Badge variant="info">{child.grade}</Badge>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                  <dt className="text-muted-foreground">Grado</dt>
                  <dd>{child.grade}</dd>
                  <dt className="text-muted-foreground">Documento</dt>
                  <dd className="tabular-nums">{child.document}</dd>
                </dl>
                <div>
                  <ScreenLinkButton
                    screenId="PAR-02"
                    size="sm"
                    search={{ student: String(child.studentId) }}
                  >
                    <NotebookPen />
                    Ver Notas
                  </ScreenLinkButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

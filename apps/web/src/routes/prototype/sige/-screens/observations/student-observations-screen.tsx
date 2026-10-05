import { ClipboardList, Plus, ThumbsUp, TriangleAlert, UserRound, ListChecks } from "lucide-react";

import { EmptyBlock } from "../../-components/empty-block";
import { ScreenLinkButton } from "../../-components/link-button";
import { ObservationCard } from "../../-components/observation-parts";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { NoStudentBlock, StudentStrip, StudentSwitcher } from "../../-components/student-strip";
import { countObservations } from "../../-lib/observations";
import { useSchool, type School } from "../../-lib/use-school";
import { useStudentScope } from "../../-lib/use-student-scope";
import { observationStore, useMockCollection } from "../../-mock";
import type { AcademicStudent, Institution } from "../../-mock/types";

/** OBS-05: observation timeline of one student (`?student=`; a student sees only their own). */
export function StudentObservationsScreen() {
  return (
    <ScopedPage
      screenId="OBS-05"
      title="Historial de Observaciones"
      description="Línea de tiempo de observaciones del estudiante"
      target="Observaciones"
      banner={false}
    >
      {(institution) => <HistoryView institution={institution} />}
    </ScopedPage>
  );
}

function HistoryView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const scope = useStudentScope(school);
  return (
    <>
      <StudentSwitcher screenId="OBS-05" scope={scope} school={school} />
      {scope.selected ? (
        <History student={scope.selected} school={school} staff={scope.mode === "staff"} />
      ) : (
        <NoStudentBlock scope={scope} />
      )}
    </>
  );
}

function History({
  student,
  school,
  staff,
}: {
  student: AcademicStudent;
  school: School;
  staff: boolean;
}) {
  const rows = useMockCollection(observationStore)
    .filter((row) => row.studentId === student.id)
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const counts = countObservations(rows);
  const guardians = school.parentLinks
    .filter((link) => link.studentId === student.id)
    .flatMap((link) => {
      const parent = school.userById.get(link.parentId);
      return parent ? [{ link, parent }] : [];
    });
  const search = { student: String(student.id) };

  return (
    <>
      <StudentStrip
        student={student}
        school={school}
        actions={
          staff ? (
            <div className="flex flex-wrap gap-2">
              <ScreenLinkButton screenId="OBS-04" search={search} variant="default">
                <Plus data-icon="inline-start" />
                Nueva Observación
              </ScreenLinkButton>
              <ScreenLinkButton screenId="STU-02" search={{ id: String(student.id) }}>
                <UserRound data-icon="inline-start" />
                Ver Perfil
              </ScreenLinkButton>
            </div>
          ) : undefined
        }
      />

      <StatGrid>
        <StatTile label="Total" value={counts.total} icon={ListChecks} />
        <StatTile label="Positivas" value={counts.positiva} icon={ThumbsUp} tone="success" />
        <StatTile
          label="Negativas"
          value={counts.negativa}
          icon={TriangleAlert}
          tone="destructive"
        />
        <StatTile
          label="Pendientes"
          value={counts.pending}
          icon={ClipboardList}
          tone="warning"
          hint="Notificación al acudiente"
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Línea de Tiempo" className="lg:col-span-2">
          {rows.length === 0 ? (
            <EmptyBlock
              icon={<ClipboardList />}
              title="Sin observaciones"
              description="Este estudiante aún no tiene observaciones registradas."
              action={
                staff ? (
                  <ScreenLinkButton screenId="OBS-04" search={search} variant="default">
                    Crear primera observación
                  </ScreenLinkButton>
                ) : undefined
              }
            />
          ) : (
            <ol className="flex flex-col gap-3">
              {rows.map((row) => (
                <li key={row.id}>
                  <ObservationCard
                    observation={row}
                    authorName={school.userName(row.authorId) ?? "-"}
                    detail={staff}
                  />
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        {guardians.length > 0 ? (
          <SectionCard title="Acudientes">
            <ul className="flex flex-col gap-3">
              {guardians.map(({ link, parent }) => (
                <li key={link.id} className="flex flex-col text-[13px]">
                  <span className="text-sm font-medium">
                    {school.userName(parent.id)}{" "}
                    <span className="font-normal text-muted-foreground">({link.relationship})</span>
                  </span>
                  <span className="text-muted-foreground">{parent.phone ?? "Sin teléfono"}</span>
                  <span className="truncate text-muted-foreground">
                    {parent.email ?? "Sin email"}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}

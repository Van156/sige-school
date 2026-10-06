import { Button } from "@base-template/ui/components/button";
import { Field, FieldLabel } from "@base-template/ui/components/field";
import { Textarea } from "@base-template/ui/components/textarea";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { AlertStatusBadge, AlertTypeBadge } from "../../-components/alert-parts";
import { ConfirmActionButton } from "../../-components/confirm-action";
import { DetailList } from "../../-components/detail-list";
import { BackButton } from "../../-components/form-layout";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SeverityBadge } from "../../-components/tone-badge";
import { StudentLink } from "../../-components/student-link";
import { formatDateTime } from "../../-lib/format";
import { useRole } from "../../-lib/use-role";
import { useSchool } from "../../-lib/use-school";
import { useIdParam } from "../../-lib/use-search-params";
import {
  alertStore,
  currentUserFor,
  mockAction,
  resolveAlert,
  useMockCollection,
} from "../../-mock";
import type { Institution } from "../../-mock/types";

/** ALR-02: one alert (`?id=`) with its student and the resolution form. */
export function AlertDetailScreen() {
  const id = useIdParam();
  return (
    <ScopedPage
      screenId="ALR-02"
      title={id === undefined ? "Detalle de Alerta" : `Alerta #${id}`}
      target="Alertas"
      banner={false}
      back={<BackButton screenId="ALR-01" label="Volver al listado" />}
    >
      {(institution) => <Detail institution={institution} id={id} />}
    </ScopedPage>
  );
}

function Detail({ institution, id }: { institution: Institution; id?: number }) {
  const school = useSchool(institution.id);
  const role = useRole();
  const alert = useMockCollection(alertStore).find((entry) => entry.id === id);
  const [notes, setNotes] = useState("");

  if (!alert || !school.studentById.has(alert.studentId)) {
    return <NotFoundBlock entity="Alerta" feminine backScreenId="ALR-01" />;
  }
  const student = school.studentById.get(alert.studentId);
  const user = student ? school.userOfStudent(student) : undefined;
  const resolve = () => {
    resolveAlert({ id: alert.id, resolvedBy: currentUserFor(role).id, notes });
    mockAction("Alerta marcada como resuelta", "El contador del menú se actualizó.");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <SectionCard
          title={alert.title}
          action={
            <div className="flex flex-wrap gap-1.5">
              <SeverityBadge severity={alert.severity} />
              <AlertTypeBadge type={alert.alertType} />
              <AlertStatusBadge resolved={alert.resolved} />
            </div>
          }
        >
          <p className="text-sm">{alert.description}</p>
        </SectionCard>

        <SectionCard title="Información">
          <DetailList
            items={[
              ["Fecha Detección", formatDateTime(alert.triggeredAt)],
              ["Tipo", <AlertTypeBadge key="type" type={alert.alertType} />],
              ["Severidad", <SeverityBadge key="severity" severity={alert.severity} />],
            ]}
          />
        </SectionCard>

        {alert.resolved ? (
          <SectionCard title="Resolución">
            <DetailList
              items={[
                [
                  "Fecha Resolución",
                  alert.resolvedAt ? formatDateTime(alert.resolvedAt) : undefined,
                ],
                ["Resuelto Por", school.userName(alert.resolvedBy) ?? "Desconocido"],
                ["Notas", alert.notes],
              ]}
            />
          </SectionCard>
        ) : (
          <SectionCard title="Resolver Alerta">
            <Field>
              <FieldLabel htmlFor="alert-notes">Notas de Resolución</FieldLabel>
              <Textarea
                id="alert-notes"
                rows={4}
                value={notes}
                placeholder="Describe las acciones tomadas para resolver esta alerta..."
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
            <div>
              {notes.trim() ? (
                <Button onClick={resolve}>
                  <CheckCircle2 data-icon="inline-start" />
                  Marcar como Resuelta
                </Button>
              ) : (
                <ConfirmActionButton
                  variant="default"
                  title="No has agregado notas de resolución"
                  description="¿Deseas continuar de todas formas?"
                  confirmLabel="Marcar como Resuelta"
                  onConfirm={resolve}
                >
                  <CheckCircle2 data-icon="inline-start" />
                  Marcar como Resuelta
                </ConfirmActionButton>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      <SectionCard title="Estudiante">
        <div className="flex flex-col gap-1 text-[13px]">
          <StudentLink screenId="STU-02" studentId={alert.studentId}>
            {school.studentName(alert.studentId)}
          </StudentLink>
          <span className="text-muted-foreground">
            {user ? `${user.documentType} ${user.documentNumber}` : "Sin documento"}
          </span>
          <span className="text-muted-foreground">
            Grado: {school.gradeName(student?.gradeId) ?? "Sin grado"}
          </span>
        </div>
      </SectionCard>
    </div>
  );
}

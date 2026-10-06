import { Badge } from "@base-template/ui/components/badge";
import { BellRing, History, Pencil, Trash2 } from "lucide-react";

import { ConfirmActionButton } from "../../-components/confirm-action";
import { DetailList } from "../../-components/detail-list";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { NotFoundBlock } from "../../-components/not-found-block";
import { NotificationBadge, ObservationTypeBadge } from "../../-components/observation-parts";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { ToneBadge } from "../../-components/tone-badge";
import { formatDateTime } from "../../-lib/format";
import { isPending, requiresNotification, useObservationAccess } from "../../-lib/observations";
import { ROLE_LABEL } from "../../-lib/roles";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSchool } from "../../-lib/use-school";
import { useIdParam } from "../../-lib/use-search-params";
import {
  markObservationNotified,
  mockAction,
  observationStore,
  useMockCollection,
} from "../../-mock";
import type { Institution } from "../../-mock/types";

/** OBS-02: one observation (`?id=`) with its notification state and the manual actions. */
export function ObservationDetailScreen() {
  const id = useIdParam();
  return (
    <ScopedPage
      screenId="OBS-02"
      title="Detalle de Observación"
      description={id === undefined ? undefined : `ID: #${id}`}
      target="Observaciones"
      banner={false}
      back={<BackButton screenId="OBS-01" label="Volver a la lista" />}
    >
      {(institution) => <DetailView institution={institution} id={id} />}
    </ScopedPage>
  );
}

function DetailView({ institution, id }: { institution: Institution; id?: number }) {
  const school = useSchool(institution.id);
  const access = useObservationAccess(school);
  const goTo = useGoToScreen();
  const observation = useMockCollection(observationStore).find((row) => row.id === id);

  if (!observation || !access.canSeeStudent(observation.studentId)) {
    return <NotFoundBlock entity="Observación" feminine backScreenId="OBS-01" />;
  }
  const student = school.studentById.get(observation.studentId);
  const author = school.userById.get(observation.authorId);
  const search = { student: String(observation.studentId) };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard
        title="Observación"
        className="lg:col-span-2"
        action={
          <div className="flex flex-wrap gap-2">
            <ScreenLinkButton screenId="OBS-05" search={search} size="sm">
              <History data-icon="inline-start" />
              Historial
            </ScreenLinkButton>
            {access.canEdit(observation) ? (
              <ScreenLinkButton
                screenId="OBS-03"
                search={{ id: String(observation.id) }}
                size="sm"
                variant="default"
              >
                <Pencil data-icon="inline-start" />
                Editar
              </ScreenLinkButton>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <ObservationTypeBadge type={observation.type} />
          {observation.category ? <Badge variant="outline">{observation.category}</Badge> : null}
        </div>
        <DetailList
          items={[
            [
              "Estudiante",
              <span className="flex flex-wrap items-center gap-2">
                {school.studentName(observation.studentId)}
                <Badge variant="secondary">
                  {school.gradeName(student?.gradeId) ?? "Sin grado"}
                </Badge>
              </span>,
            ],
          ]}
        />
        <div className="flex flex-col gap-1">
          <h3 className="text-xs text-muted-foreground">Descripción</h3>
          <p className="text-sm">{observation.description}</p>
        </div>
        {observation.commitments ? (
          <div className="flex flex-col gap-1">
            <h3 className="text-xs text-muted-foreground">Compromisos</h3>
            <p className="text-sm">{observation.commitments}</p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Información">
        <DetailList
          items={[
            ["Fecha", formatDateTime(observation.date)],
            [
              "Autor",
              author ? (
                <span className="flex flex-col">
                  {school.userName(author.id)}
                  <span className="text-xs text-muted-foreground">{ROLE_LABEL[author.role]}</span>
                </span>
              ) : undefined,
            ],
            [
              "Notificación a Acudientes",
              <span className="flex flex-wrap items-center gap-1.5">
                <NotificationBadge observation={observation} />
                {requiresNotification(observation.type) ? (
                  <ToneBadge tone="info">Requerida</ToneBadge>
                ) : null}
              </span>,
            ],
          ]}
        />
        <div className="flex flex-col gap-2">
          {isPending(observation) ? (
            <ConfirmActionButton
              title="¿Marcar esta observación como notificada a los acudientes?"
              description="Se registrará que los acudientes ya fueron informados."
              confirmLabel="Marcar como Notificada"
              onConfirm={() => {
                markObservationNotified(observation.id);
                mockAction("Observación marcada como notificada");
              }}
            >
              <BellRing data-icon="inline-start" />
              Marcar como Notificada
            </ConfirmActionButton>
          ) : null}
          {access.canDelete ? (
            <ConfirmActionButton
              destructive
              variant="outline"
              title="¿Está seguro de eliminar esta observación?"
              description="Esta acción no se puede deshacer."
              confirmLabel="Sí, eliminar"
              onConfirm={() => {
                observationStore.remove(observation.id);
                mockAction("Observación eliminada");
                goTo("OBS-01");
              }}
            >
              <Trash2 data-icon="inline-start" />
              Eliminar
            </ConfirmActionButton>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

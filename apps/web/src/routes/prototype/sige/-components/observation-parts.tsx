import { cn } from "@base-template/ui/lib/utils";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { ScreenLink } from "./sige-link";
import { ToneBadge } from "./tone-badge";
import { OBSERVATION_TONE, formatDateTime } from "../-lib/format";
import {
  OBSERVATION_EMOJI,
  OBSERVATION_LABEL,
  isPending,
  requiresNotification,
} from "../-lib/observations";
import type { Observation, ObservationType } from "../-mock/types";

export function ObservationTypeBadge({ type }: { type: ObservationType }) {
  return (
    <ToneBadge tone={OBSERVATION_TONE[type]}>
      <span aria-hidden="true">{OBSERVATION_EMOJI[type]}</span>
      {OBSERVATION_LABEL[type]}
    </ToneBadge>
  );
}

/** "Notificada" / "Pendiente" / "No requerida" according to the type and the manual flag. */
export function NotificationBadge({ observation }: { observation: Observation }) {
  if (!requiresNotification(observation.type)) {
    return <span className="text-muted-foreground">No requerida</span>;
  }
  return observation.notified ? (
    <ToneBadge tone="success">
      <Check />
      Notificada
    </ToneBadge>
  ) : (
    <ToneBadge tone="warning">Pendiente</ToneBadge>
  );
}

const BAR: Record<ObservationType, string> = {
  positiva: "border-l-success",
  negativa: "border-l-destructive",
  seguimiento: "border-l-info",
  convivencia: "border-l-warning",
};

/**
 * One observation as a card with a coloured left bar (timeline entry of OBS-05, card of PAR-04).
 * `detail` adds the "Ver detalle" link; guardians only see the notification state.
 */
export function ObservationCard({
  observation,
  authorName,
  detail = false,
  extra,
}: {
  observation: Observation;
  authorName: string;
  detail?: boolean;
  extra?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-l-4 bg-card p-3",
        BAR[observation.type],
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ObservationTypeBadge type={observation.type} />
        {observation.category ? (
          <span className="rounded-full border px-2 py-0.5 text-xs">{observation.category}</span>
        ) : null}
        <span className="text-xs text-muted-foreground">{formatDateTime(observation.date)}</span>
        {detail ? (
          <ScreenLink
            screenId="OBS-02"
            search={{ id: String(observation.id) }}
            className="ml-auto text-[13px] underline-offset-4 hover:underline"
          >
            Ver detalle
          </ScreenLink>
        ) : (
          <span className="ml-auto">
            <NotificationBadge observation={observation} />
          </span>
        )}
      </div>
      <p className="text-sm">{observation.description}</p>
      {observation.commitments ? (
        <p className="text-[13px]">
          <strong className="font-medium">Compromisos:</strong>{" "}
          <span className="text-muted-foreground">{observation.commitments}</span>
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Por: {authorName}
        {detail && isPending(observation) ? " · Pendiente de notificación" : null}
        {detail && observation.notified ? " · Notificada al acudiente" : null}
      </p>
      {extra}
    </article>
  );
}

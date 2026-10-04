import { SearchX } from "lucide-react";

import { EmptyBlock } from "./empty-block";
import { ScreenLinkButton } from "./link-button";

/** Shown by edit forms and per-institution screens when `?id=` points at nothing. */
export function NotFoundBlock({ entity, backScreenId }: { entity: string; backScreenId: string }) {
  return (
    <EmptyBlock
      icon={<SearchX />}
      title={`${entity} no encontrado`}
      description="El registro no existe o fue eliminado de los datos en memoria."
      action={<ScreenLinkButton screenId={backScreenId}>Volver al listado</ScreenLinkButton>}
    />
  );
}

import { Badge } from "@base-template/ui/components/badge";
import { Construction } from "lucide-react";

import { MODULE_LABEL, screenById } from "../-screens";
import { ROLES } from "../-lib/roles";
import { EmptyBlock } from "./empty-block";
import { SigePageHeader } from "./page-header";
import { SigeLinkButton } from "./link-button";
import { RoleBadge } from "./tone-badge";

/**
 * Shared placeholder for screens that are not built yet. Later tasks replace a screen by flipping
 * its row in `-screens.ts`; nothing else points at this component.
 */
export function PendingScreen({ screenId }: { screenId: string }) {
  const screen = screenById.get(screenId);

  if (!screen) {
    return (
      <EmptyBlock
        icon={<Construction />}
        title="Pantalla no encontrada"
        description={`El identificador ${screenId} no existe en el inventario.`}
        action={<SigeLinkButton to="/prototype/sige">Ver índice de pantallas</SigeLinkButton>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SigePageHeader
        title={screen.title}
        description={`${MODULE_LABEL[screen.module]} · ${screen.id}`}
      />
      <EmptyBlock
        icon={<Construction />}
        title="Pantalla pendiente"
        description="Esta pantalla del sistema legado aún no está construida en el prototipo."
        action={
          <div className="flex flex-col items-center gap-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-left text-[13px]">
              <dt className="text-muted-foreground">Pantalla</dt>
              <dd>
                <Badge variant="outline" className="font-mono">
                  {screen.id}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">Título</dt>
              <dd className="font-medium">{screen.title}</dd>
              <dt className="text-muted-foreground">Roles</dt>
              <dd className="flex flex-wrap gap-1">
                {ROLES.filter((role) => screen.roles.includes(role)).map((role) => (
                  <RoleBadge key={role} role={role} />
                ))}
              </dd>
            </dl>
            <SigeLinkButton to="/prototype/sige">Ver índice de pantallas</SigeLinkButton>
          </div>
        }
      />
    </div>
  );
}

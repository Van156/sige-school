import { ShieldOff } from "lucide-react";
import type { ReactNode } from "react";

import { useCan } from "../-lib/permissions";
import { EmptyBlock } from "./empty-block";
import { ScreenLinkButton } from "./link-button";
import { useRole } from "../-lib/use-role";
import { dashboardScreenId } from "../-screens";

/** Renders `children` only when the active role is allowed on the screen (legacy `@role_required`). */
export function RoleGate({ screenId, children }: { screenId: string; children: ReactNode }) {
  const role = useRole();
  if (useCan(screenId)) return <>{children}</>;
  return (
    <EmptyBlock
      icon={<ShieldOff />}
      title="Acceso prohibido"
      description="Tu rol no tiene permiso para ver esta pantalla. Cambia de rol desde el selector del encabezado."
      action={
        <ScreenLinkButton screenId={dashboardScreenId[role]}>Volver al dashboard</ScreenLinkButton>
      }
    />
  );
}

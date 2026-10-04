import { createFileRoute } from "@tanstack/react-router";

import { InstitutionConfigScreen } from "../-screens/institution/institution-config-screen";

/** INS-06 */
export const Route = createFileRoute("/prototype/sige/_shell/configuracion-institucion")({
  component: InstitutionConfigScreen,
});

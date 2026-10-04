import { createFileRoute } from "@tanstack/react-router";

import { InstitutionUserFormScreen } from "../-screens/institution/institution-user-form-screen";

/** INS-05 */
export const Route = createFileRoute("/prototype/sige/_shell/instituciones/nuevo-usuario")({
  component: InstitutionUserFormScreen,
});

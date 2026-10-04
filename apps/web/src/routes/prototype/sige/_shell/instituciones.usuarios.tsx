import { createFileRoute } from "@tanstack/react-router";

import { InstitutionUsersScreen } from "../-screens/institution/institution-users-screen";

/** INS-04 */
export const Route = createFileRoute("/prototype/sige/_shell/instituciones/usuarios")({
  component: InstitutionUsersScreen,
});

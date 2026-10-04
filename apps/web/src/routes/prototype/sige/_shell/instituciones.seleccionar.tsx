import { createFileRoute } from "@tanstack/react-router";

import { SelectInstitutionScreen } from "../-screens/institution/select-institution-screen";

/** INS-03 */
export const Route = createFileRoute("/prototype/sige/_shell/instituciones/seleccionar")({
  component: SelectInstitutionScreen,
});

import { createFileRoute } from "@tanstack/react-router";

import { InstitutionFormScreen } from "../-screens/institution/institution-form-screen";

/** INS-02 */
export const Route = createFileRoute("/prototype/sige/_shell/instituciones/formulario")({
  component: InstitutionFormScreen,
});

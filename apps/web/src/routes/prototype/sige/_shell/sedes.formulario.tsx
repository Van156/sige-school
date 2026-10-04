import { createFileRoute } from "@tanstack/react-router";

import { CampusFormScreen } from "../-screens/institution/campus-form-screen";

/** INS-08 */
export const Route = createFileRoute("/prototype/sige/_shell/sedes/formulario")({
  component: CampusFormScreen,
});

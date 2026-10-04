import { createFileRoute } from "@tanstack/react-router";

import { AssignmentFormScreen } from "../-screens/school/assignment-form-screen";

/** SCH-04 */
export const Route = createFileRoute("/prototype/sige/_shell/asignaciones/formulario")({
  component: AssignmentFormScreen,
});

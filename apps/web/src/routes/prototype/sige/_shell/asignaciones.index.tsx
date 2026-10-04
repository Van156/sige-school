import { createFileRoute } from "@tanstack/react-router";

import { AssignmentsScreen } from "../-screens/school/assignments-screen";

/** SCH-03 */
export const Route = createFileRoute("/prototype/sige/_shell/asignaciones/")({
  component: AssignmentsScreen,
});

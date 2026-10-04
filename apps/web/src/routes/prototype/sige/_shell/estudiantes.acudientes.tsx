import { createFileRoute } from "@tanstack/react-router";

import { AssignGuardiansScreen } from "../-screens/students/assign-guardians-screen";

/** STU-04 */
export const Route = createFileRoute("/prototype/sige/_shell/estudiantes/acudientes")({
  component: AssignGuardiansScreen,
});
